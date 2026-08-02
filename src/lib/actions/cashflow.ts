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

/** Catat pemasukan (income) di jurnal cashflow. */
export async function createCashflowIncome(input: {
  description: string;
  project_name: string;
  amount: number;
  entry_date: string;
}): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };

  const managed = await getManagedProject();
  const description = input.description.trim();
  const projectName = managed ?? input.project_name.trim();
  const amount = Number(input.amount);

  if (!description || !projectName || !(amount >= 0) || !input.entry_date) {
    return { error: 'Data pemasukan tidak lengkap. Periksa kembali input Anda.' };
  }

  const { error } = await ctx.supabase.from('cashflow').insert({
    description,
    project_name: projectName,
    amount,
    entry_date: input.entry_date,
    created_by: ctx.user.id,
  });
  if (error) return { error: error.message };

  revalidatePath('/admin/cashflow');
  revalidatePath('/admin/reports');
  return { success: true };
}

/** Edit pemasukan yang sudah tercatat. */
export async function updateCashflowIncome(
  id: string,
  input: {
    description: string;
    project_name: string;
    amount: number;
    entry_date: string;
  }
): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };

  const managed = await getManagedProject();
  const description = input.description.trim();
  const projectName = managed ?? input.project_name.trim();
  const amount = Number(input.amount);

  if (!description || !projectName || !(amount >= 0) || !input.entry_date) {
    return { error: 'Data pemasukan tidak lengkap. Periksa kembali input Anda.' };
  }

  const { data: existing } = await ctx.supabase
    .from('cashflow')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (!existing) return { error: 'Catatan pemasukan tidak ditemukan.' };

  const { error } = await ctx.supabase
    .from('cashflow')
    .update({
      description,
      project_name: projectName,
      amount,
      entry_date: input.entry_date,
    })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/admin/cashflow');
  revalidatePath('/admin/reports');
  return { success: true };
}

/** Hapus pemasukan dari jurnal cashflow. */
export async function deleteCashflowIncome(id: string): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };

  const { error } = await ctx.supabase.from('cashflow').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/admin/cashflow');
  return { success: true };
}
