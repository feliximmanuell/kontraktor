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
 * Catat pemakaian material di lapangan.
 * Trigger `reduce_stock_on_usage` otomatis mengurangi stok proyek
 * dan menolak jika stok tidak mencukupi.
 */
export async function createMaterialUsage(formData: FormData): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };

  const projectId = String(formData.get('projectId') ?? '');
  const materialId = String(formData.get('materialId') ?? '');
  const qtyUsed = Number(formData.get('qtyUsed'));
  const usedFor = String(formData.get('usedFor') ?? '').trim();

  if (!projectId || !materialId || !(qtyUsed > 0)) {
    return { error: 'Pilih proyek, material, dan jumlah yang valid.' };
  }
  if (usedFor.length < 3) {
    return { error: 'Detail pemakaian (digunakan untuk apa/di mana) wajib diisi.' };
  }

  const { error } = await ctx.supabase.from('material_usages').insert({
    project_id: projectId,
    material_id: materialId,
    qty_used: qtyUsed,
    used_for: usedFor,
    logged_by: ctx.user.id,
  });

  if (error) return { error: error.message };

  revalidatePath('/admin/usage');
  revalidatePath('/admin/inventory');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/audit');
  return { success: true };
}
