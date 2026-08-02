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

  return { supabase };
}

/**
 * Sesuaikan stok material secara manual (perbaikan / stok awal).
 * Upsert berdasarkan nama material.
 */
export async function adjustStock(
  materialName: string,
  newStock: number
): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };

  const name = materialName.trim();
  if (!name || !(newStock >= 0)) {
    return { error: 'Nama material dan jumlah stok tidak valid.' };
  }

  const { error } = await ctx.supabase.from('material_stocks').upsert(
    { material_name: name, current_stock: newStock, updated_at: new Date().toISOString() },
    { onConflict: 'material_name' }
  );
  if (error) return { error: error.message };

  revalidatePath('/admin/stock');
  revalidatePath('/admin/requests');
  return { success: true };
}
