'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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
 * Catat pembelian material. Jika file bon diunggah, status bon = 'received'
 * dan file disimpan ke bucket storage 'receipts'. Trigger `add_stock_on_purchase`
 * otomatis menambah stok proyek.
 */
export async function createPurchase(formData: FormData): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };

  const projectId = String(formData.get('projectId') ?? '');
  const materialId = String(formData.get('materialId') ?? '');
  const storeName = String(formData.get('storeName') ?? '').trim();
  const qty = Number(formData.get('qty'));
  const unitPrice = Number(formData.get('unitPrice'));
  const requestId = String(formData.get('requestId') ?? '') || null;
  const file = (formData.get('receipt') as File | null) ?? null;

  if (!projectId || !materialId || !storeName || !(qty > 0) || !(unitPrice >= 0)) {
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

  const { error } = await ctx.supabase.from('purchases').insert({
    request_id: requestId,
    project_id: projectId,
    material_id: materialId,
    store_name: storeName,
    qty,
    unit_price: unitPrice,
    receipt_status: receiptStatus,
    receipt_image_url: receiptPath,
    purchased_by: ctx.user.id,
  });

  if (error) return { error: error.message };

  revalidatePath('/admin/purchases');
  revalidatePath('/admin/inventory');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/audit');
  return { success: true };
}

/** Unggah bon/nota untuk pembelian yang bonnya belum diterima. */
export async function uploadReceipt(formData: FormData): Promise<ActionResponse> {
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

  const { error } = await ctx.supabase
    .from('purchases')
    .update({ receipt_image_url: receiptPath, receipt_status: 'received' })
    .eq('id', purchaseId);
  if (error) return { error: error.message };

  revalidatePath('/admin/purchases');
  revalidatePath('/admin/dashboard');
  return { success: true };
}

/** Perbaikan/penyesuaian stok manual oleh admin (verifikasi stok). */
export async function adjustStock(stockId: string, newStock: number): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };
  if (!(newStock >= 0)) return { error: 'Jumlah stok tidak valid.' };

  const { error } = await ctx.supabase
    .from('project_stocks')
    .update({ current_stock: newStock })
    .eq('id', stockId);
  if (error) return { error: error.message };

  revalidatePath('/admin/inventory');
  revalidatePath('/admin/requests');
  revalidatePath('/admin/dashboard');
  return { success: true };
}
