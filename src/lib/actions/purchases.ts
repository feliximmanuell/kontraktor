'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getManagedProject } from '@/lib/projects';

export type ActionResponse = {
  success?: boolean;
  error?: string;
};

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') return null;

  return { supabase, user };
}

/**
 * Catat pembelian material — bisa beberapa barang sekaligus dalam satu transaksi.
 * Semua field bebas teks (nama proyek, nama material, qty). Total harga per barang
 * diisi manual. Jika file bon diunggah, status bon = 'received'.
 */
export async function createPurchase(formData: FormData): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };

  const managed = await getManagedProject();
  const projectName = managed ?? String(formData.get('projectName') ?? '').trim();
  const storeName = String(formData.get('storeName') ?? '').trim();
  const requestId = String(formData.get('requestId') ?? '') || null;
  const file = (formData.get('receipt') as File | null) ?? null;
  const groupId = crypto.randomUUID();

  const materialNames = formData.getAll('materialName').map((v) => String(v).trim());
  const qtys = formData.getAll('qty').map((v) => String(v).trim());
  const totalPrices = formData.getAll('totalPrice').map((v) => Number(v));

  if (
    !projectName ||
    !storeName ||
    materialNames.length === 0 ||
    qtys.length !== materialNames.length ||
    totalPrices.length !== materialNames.length ||
    materialNames.some((m) => !m) ||
    qtys.some((q) => !q) ||
    totalPrices.some((t) => !(t >= 0))
  ) {
    return { error: 'Data pembelian tidak lengkap. Periksa kembali input Anda.' };
  }

  let receiptPath: string | null = null;
  let receiptStatus: 'pending' | 'received' = 'pending';

  if (file && file.size > 0) {
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    receiptPath = `purchases/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await ctx.supabase.storage
      .from('receipts')
      .upload(receiptPath, file, { contentType: file.type });
    if (upErr) return { error: 'Gagal mengunggah bon: ' + upErr.message };
    receiptStatus = 'received';
  }

  const rows = materialNames.map((materialName, i) => ({
    purchase_group: groupId,
    request_id: i === 0 ? requestId : null,
    project_id: null,
    project_name: projectName,
    material_id: null,
    material_name: materialName,
    store_name: storeName,
    qty: qtys[i],
    total_price: totalPrices[i],
    receipt_status: receiptStatus,
    receipt_image_url: receiptPath,
    purchased_by: ctx.user.id,
  }));

  const { error } = await ctx.supabase.from('purchases').insert(rows);

  if (error) return { error: error.message };

  revalidatePath('/admin/purchases');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/audit');
  revalidatePath('/admin/requests');
  return { success: true };
}

/**
 * Edit pembelian (proyek, toko, material, qty, total, tanggal).
 * Stok otomatis disesuaikan via trigger saat material/qty berubah.
 */
export async function updatePurchase(
  purchaseId: string,
  input: {
    project_name: string;
    store_name: string;
    material_name: string;
    qty: string;
    total_price: number;
    purchased_at: string;
  }
): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };

  const managed = await getManagedProject();
  const projectName = managed ?? input.project_name.trim();
  const storeName = input.store_name.trim();
  const materialName = input.material_name.trim();
  const qty = input.qty.trim();
  const totalPrice = Number(input.total_price);

  if (!projectName || !storeName || !materialName || !qty || !(totalPrice >= 0) || !input.purchased_at) {
    return { error: 'Data pembelian tidak lengkap. Periksa kembali input Anda.' };
  }

  const { data: existing } = await ctx.supabase
    .from('purchases')
    .select('id')
    .eq('id', purchaseId)
    .maybeSingle();
  if (!existing) return { error: 'Pembelian tidak ditemukan.' };

  const { error } = await ctx.supabase
    .from('purchases')
    .update({
      project_name: projectName,
      store_name: storeName,
      material_name: materialName,
      qty,
      total_price: totalPrice,
      purchased_at: input.purchased_at,
    })
    .eq('id', purchaseId);
  if (error) return { error: error.message };

  revalidatePath('/admin/purchases');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/audit');
  revalidatePath('/admin/stock');
  revalidatePath('/admin/reports');
  return { success: true };
}

/** Unggah bon/nota untuk pembelian yang bonnya belum diterima. */export async function uploadReceipt(formData: FormData): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };

  const purchaseId = String(formData.get('purchaseId') ?? '');
  const file = (formData.get('receipt') as File | null) ?? null;

  if (!purchaseId || !file || file.size === 0) {
    return { error: 'Pilih file foto bon terlebih dahulu.' };
  }

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const receiptPath = `purchases/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await ctx.supabase.storage
    .from('receipts')
    .upload(receiptPath, file, { contentType: file.type });
  if (upErr) return { error: 'Gagal mengunggah bon: ' + upErr.message };

  // Hapus bon lama bila ada (ganti dengan yang baru).
  const { data: existing } = await ctx.supabase
    .from('purchases')
    .select('receipt_image_url')
    .eq('id', purchaseId)
    .maybeSingle();
  if (existing?.receipt_image_url && existing.receipt_image_url !== receiptPath) {
    await ctx.supabase.storage.from('receipts').remove([existing.receipt_image_url]);
  }

  const { error } = await ctx.supabase
    .from('purchases')
    .update({ receipt_image_url: receiptPath, receipt_status: 'received' })
    .eq('id', purchaseId);
  if (error) return { error: error.message };

  revalidatePath('/admin/purchases');
  revalidatePath('/admin/dashboard');
  return { success: true };
}

/**
 * Ubah status bon. 'pending' = tandai belum diterima + hapus file bon lama.
 * 'received' = tandai sudah diterima (tanpa file).
 */
export async function setReceiptStatus(
  purchaseId: string,
  status: 'pending' | 'received'
): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };

  if (status === 'pending') {
    const { data: existing } = await ctx.supabase
      .from('purchases')
      .select('receipt_image_url')
      .eq('id', purchaseId)
      .maybeSingle();
    if (existing?.receipt_image_url) {
      await ctx.supabase.storage.from('receipts').remove([existing.receipt_image_url]);
    }
  }

  const { error } = await ctx.supabase
    .from('purchases')
    .update({
      receipt_image_url: status === 'pending' ? null : undefined,
      receipt_status: status,
    })
    .eq('id', purchaseId);
  if (error) return { error: error.message };

  revalidatePath('/admin/purchases');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/audit');
  return { success: true };
}

/** Hapus pembelian. Stok otomatis dikurangi via trigger. */
export async function deletePurchase(purchaseId: string): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };

  const { data: existing } = await ctx.supabase
    .from('purchases')
    .select('receipt_image_url')
    .eq('id', purchaseId)
    .maybeSingle();
  if (!existing) return { error: 'Pembelian tidak ditemukan.' };

  if (existing.receipt_image_url) {
    await ctx.supabase.storage.from('receipts').remove([existing.receipt_image_url]);
  }

  const { error } = await ctx.supabase.from('purchases').delete().eq('id', purchaseId);
  if (error) return { error: error.message };

  revalidatePath('/admin/purchases');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/audit');
  revalidatePath('/admin/stock');
  revalidatePath('/admin/requests');
  return { success: true };
}
