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

/** Bayar satu/beberapa pembelian sekaligus. */
export async function payPurchases(
  items: { id: string; amount: number; paid_at: string }[]
): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };

  if (items.length === 0) {
    return { error: 'Pilih pembelian yang akan dibayar.' };
  }

  const ids = items.map((i) => i.id);
  const { data: rows } = await ctx.supabase
    .from('purchases')
    .select('id, project_name, material_name, total_price, paid')
    .in('id', ids);

  if (!rows) return { error: 'Pembelian tidak ditemukan.' };

  const paymentRows: {
    payment_type: 'purchase';
    purchase_id: string;
    description: string;
    project_name: string;
    material_name: string;
    amount: number;
    paid_at: string;
    paid_by: string;
  }[] = [];
  const paidIds: string[] = [];

  for (const it of items) {
    const p = rows.find((r) => r.id === it.id);
    if (!p) continue;
    if (p.paid) continue;
    const amount = Number(it.amount);
    if (!(amount >= 0)) continue;
    paymentRows.push({
      payment_type: 'purchase',
      purchase_id: p.id,
      description: `Pembayaran pembelian ${p.material_name}`,
      project_name: p.project_name,
      material_name: p.material_name,
      amount,
      paid_at: it.paid_at,
      paid_by: ctx.user.id,
    });
    paidIds.push(p.id);
  }

  if (paymentRows.length === 0) {
    return { error: 'Tidak ada pembelian yang bisa dibayar (mungkin sudah dibayar).' };
  }

  const { error: insErr } = await ctx.supabase.from('payments').insert(paymentRows);
  if (insErr) return { error: insErr.message };

  const { error: updErr } = await ctx.supabase
    .from('purchases')
    .update({ paid: true })
    .in('id', paidIds);
  if (updErr) return { error: updErr.message };

  revalidatePath('/admin/payments');
  revalidatePath('/admin/reports');
  revalidatePath('/admin/dashboard');
  return { success: true };
}

/** Input pengeluaran manual (tidak terkait pembelian). */
export async function createManualPayment(input: {
  description: string;
  project_name: string;
  material_name?: string;
  amount: number;
  paid_at: string;
}): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };

  const description = input.description.trim();
  const projectName = input.project_name.trim();
  const materialName = input.material_name?.trim() ?? '';
  const amount = Number(input.amount);

  if (!description || !projectName || !(amount >= 0) || !input.paid_at) {
    return { error: 'Data pengeluaran tidak lengkap. Periksa kembali input Anda.' };
  }

  const { error } = await ctx.supabase.from('payments').insert({
    payment_type: 'manual',
    purchase_id: null,
    description,
    project_name: projectName,
    material_name: materialName || null,
    amount,
    paid_at: input.paid_at,
    paid_by: ctx.user.id,
  });
  if (error) return { error: error.message };

  revalidatePath('/admin/payments');
  revalidatePath('/admin/reports');
  return { success: true };
}

/** Edit pembayaran (deskripsi, proyek, material, jumlah, tanggal). */
export async function updatePayment(
  paymentId: string,
  input: {
    description: string;
    project_name: string;
    material_name?: string;
    amount: number;
    paid_at: string;
  }
): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };

  const description = input.description.trim();
  const projectName = input.project_name.trim();
  const materialName = input.material_name?.trim() ?? '';
  const amount = Number(input.amount);

  if (!description || !projectName || !(amount >= 0) || !input.paid_at) {
    return { error: 'Data pembayaran tidak lengkap. Periksa kembali input Anda.' };
  }

  const { data: existing } = await ctx.supabase
    .from('payments')
    .select('id')
    .eq('id', paymentId)
    .maybeSingle();
  if (!existing) return { error: 'Pembayaran tidak ditemukan.' };

  const { error } = await ctx.supabase
    .from('payments')
    .update({
      description,
      project_name: projectName,
      material_name: materialName || null,
      amount,
      paid_at: input.paid_at,
    })
    .eq('id', paymentId);
  if (error) return { error: error.message };

  revalidatePath('/admin/payments');
  revalidatePath('/admin/reports');
  revalidatePath('/admin/dashboard');
  return { success: true };
}

/** Hapus pembayaran. Jika terkait pembelian, pembelian dikembalikan ke belum dibayar. */
export async function deletePayment(paymentId: string): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };

  const { data: existing } = await ctx.supabase
    .from('payments')
    .select('id, purchase_id')
    .eq('id', paymentId)
    .maybeSingle();
  if (!existing) return { error: 'Pembayaran tidak ditemukan.' };

  if (existing.purchase_id) {
    await ctx.supabase
      .from('purchases')
      .update({ paid: false })
      .eq('id', existing.purchase_id);
  }

  const { error } = await ctx.supabase.from('payments').delete().eq('id', paymentId);
  if (error) return { error: error.message };

  revalidatePath('/admin/payments');
  revalidatePath('/admin/reports');
  revalidatePath('/admin/dashboard');
  return { success: true };
}
