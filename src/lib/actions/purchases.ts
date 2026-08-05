'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getManagedProject } from '@/lib/projects';
import { computePurchaseTotal } from '@/lib/utils';

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
 * Semua field bebas teks (nama proyek, nama material, satuan). Qty berupa angka,
 * harga satuan & diskon (persen) diinput, lalu total dihitung otomatis
 * (qty x harga) - diskon. Jika file bon diunggah, status bon = 'received'.
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
  const units = formData.getAll('unit').map((v) => String(v).trim());
  const unitPrices = formData.getAll('unitPrice').map((v) => Number(v));
  const discounts = formData.getAll('discountPercent').map((v) => Number(v));

  if (
    !projectName ||
    !storeName ||
    materialNames.length === 0 ||
    qtys.length !== materialNames.length ||
    units.length !== materialNames.length ||
    unitPrices.length !== materialNames.length ||
    discounts.length !== materialNames.length ||
    materialNames.some((m) => !m) ||
    qtys.some((q) => !q) ||
    units.some((u) => !u) ||
    unitPrices.some((p) => !(p >= 0)) ||
    discounts.some((d) => !(d >= 0) || d > 100)
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

  const rows = materialNames.map((materialName, i) => {
    const total = computePurchaseTotal(Number(qtys[i]), unitPrices[i], discounts[i]);
    return {
      purchase_group: groupId,
      request_id: i === 0 ? requestId : null,
      project_id: null,
      project_name: projectName,
      material_id: null,
      material_name: materialName,
      store_name: storeName,
      qty: qtys[i],
      unit: units[i],
      unit_price: unitPrices[i],
      discount_percent: discounts[i],
      total_price: total,
      receipt_status: receiptStatus,
      receipt_image_url: receiptPath,
      purchased_by: ctx.user.id,
    };
  });

  const { error } = await ctx.supabase.from('purchases').insert(rows);

  if (error) return { error: error.message };

  revalidatePath('/admin/purchases');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/audit');
  revalidatePath('/admin/requests');
  return { success: true };
}

/**
 * Edit pembelian (proyek, toko, material, qty, satuan, harga, diskon, total, tanggal).
 * Stok otomatis disesuaikan via trigger saat material/qty berubah.
 */
export async function updatePurchase(
  purchaseId: string,
  input: {
    project_name: string;
    store_name: string;
    material_name: string;
    qty: string;
    unit: string;
    unit_price: number;
    discount_percent: number;
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
  const unit = input.unit.trim();
  const unitPrice = Number(input.unit_price);
  const discount = Number(input.discount_percent);

  if (
    !projectName ||
    !storeName ||
    !materialName ||
    !qty ||
    !unit ||
    !(unitPrice >= 0) ||
    !(discount >= 0) ||
    discount > 100 ||
    !input.purchased_at
  ) {
    return { error: 'Data pembelian tidak lengkap. Periksa kembali input Anda.' };
  }

  const { data: existing } = await ctx.supabase
    .from('purchases')
    .select('id')
    .eq('id', purchaseId)
    .maybeSingle();
  if (!existing) return { error: 'Pembelian tidak ditemukan.' };

  const total = computePurchaseTotal(Number(qty), unitPrice, discount);

  const { error } = await ctx.supabase
    .from('purchases')
    .update({
      project_name: projectName,
      store_name: storeName,
      material_name: materialName,
      qty,
      unit,
      unit_price: unitPrice,
      discount_percent: discount,
      total_price: total,
      purchased_at: input.purchased_at,
    })
    .eq('id', purchaseId);
  if (error) return { error: error.message };

  // Sinkronkan nama toko ke pembayaran terkait agar laporan/cashflow konsisten.
  await ctx.supabase
    .from('payments')
    .update({ store_name: storeName })
    .eq('purchase_id', purchaseId);

  revalidatePath('/admin/purchases');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/audit');
  revalidatePath('/admin/stock');
  revalidatePath('/admin/reports');
  revalidatePath('/admin/payments');
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

  // Hapus bukti pembayaran terkait agar tidak tersisa sebagai pengeluaran yatim.
  const { error: payErr } = await ctx.supabase
    .from('payments')
    .delete()
    .eq('purchase_id', purchaseId);
  if (payErr) return { error: payErr.message };

  const { error } = await ctx.supabase.from('purchases').delete().eq('id', purchaseId);
  if (error) return { error: error.message };

  revalidatePath('/admin/purchases');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/audit');
  revalidatePath('/admin/stock');
  revalidatePath('/admin/requests');
  revalidatePath('/admin/payments');
  revalidatePath('/admin/reports');
  revalidatePath('/admin/cashflow');
  return { success: true };
}
