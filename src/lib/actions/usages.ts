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
 * Catat pemakaian material di lapangan. Semua field bebas teks.
 */
export async function createMaterialUsage(formData: FormData): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };

  const managed = await getManagedProject();
  const projectName = managed ?? String(formData.get('projectName') ?? '').trim();
  const materialName = String(formData.get('materialName') ?? '').trim();
  const qtyUsed = String(formData.get('qtyUsed') ?? '').trim();
  const usedFor = String(formData.get('usedFor') ?? '').trim();

  if (!projectName || !materialName || !qtyUsed) {
    return { error: 'Isi nama proyek, nama material, dan jumlah pemakaian.' };
  }
  if (usedFor.length < 3) {
    return { error: 'Detail pemakaian (digunakan untuk apa/di mana) wajib diisi.' };
  }

  const { error } = await ctx.supabase.from('material_usages').insert({
    project_id: null,
    project_name: projectName,
    material_id: null,
    material_name: materialName,
    qty_used: qtyUsed,
    used_for: usedFor,
    logged_by: ctx.user.id,
  });

  if (error) return { error: error.message };

  revalidatePath('/admin/usage');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/audit');
  return { success: true };
}

/** Hapus pemakaian. Stok otomatis dikembalikan via trigger. */
export async function deleteUsage(usageId: string): Promise<ActionResponse> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: 'Anda tidak punya akses admin.' };

  const { error } = await ctx.supabase
    .from('material_usages')
    .delete()
    .eq('id', usageId);
  if (error) return { error: error.message };

  revalidatePath('/admin/usage');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/audit');
  revalidatePath('/admin/stock');
  return { success: true };
}
