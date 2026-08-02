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

/** Bayar satu transaksi pembelian (bisa berisi banyak item) sekaligus. */
export async function payPurchaseGroup(
  ids: string[],
  input: { amount: number; paid_at: string }
): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };

  if (ids.length === 0) {
    return { error: 'Pilih pembelian yang akan dibayar.' };
  }
  const amount = Number(input.amount);
  if (!(amount >= 0) || !input.paid_at) {
    return { error: 'Data pembayaran tidak valid.' };
  }

  const { data: rows } = await ctx.supabase
    .from('purchases')
    .select('id, project_name, material_name, total_price, paid')
    .in('id', ids);

  if (!rows) return { error: 'Pembelian tidak ditemukan.' };

  const unpaid = rows.filter((r) => !r.paid);
  if (unpaid.length === 0) {
    return { error: 'Semua pembelian ini sudah dibayar.' };
  }

  // Distribusikan jumlah yang dibayar secara proporsional per item.
  const sum = unpaid.reduce((acc, r) => acc + Number(r.total_price), 0);
  const shares = unpaid.map((p) => {
    const raw = sum > 0 ? (amount * Number(p.total_price)) / sum : amount / unpaid.length;
    return Math.floor(raw * 100) / 100;
  });
  const totalShare = shares.reduce((a, b) => a + b, 0);
  shares[shares.length - 1] =
    Math.round((shares[shares.length - 1] + (amount - totalShare)) * 100) / 100;

  const paymentRows: {
    payment_type: 'purchase';
    purchase_id: string;
    description: string;
    project_name: string;
    material_name: string;
    amount: number;
    paid_at: string;
    paid_by: string;
  }[] = unpaid.map((p, i) => ({
    payment_type: 'purchase',
    purchase_id: p.id,
    description: `Pembayaran pembelian ${p.material_name}`,
    project_name: p.project_name,
    material_name: p.material_name,
    amount: shares[i],
    paid_at: input.paid_at,
    paid_by: ctx.user.id,
  }));

  const { error: insErr } = await ctx.supabase.from('payments').insert(paymentRows);
  if (insErr) return { error: insErr.message };

  const { error: updErr } = await ctx.supabase
    .from('purchases')
    .update({ paid: true })
    .in('id', unpaid.map((p) => p.id));
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
