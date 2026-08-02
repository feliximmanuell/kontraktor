'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ActionResponse = {
  success?: boolean;
  error?: string;
};

/**
 * Tukang/Mandor mengajukan permintaan material.
 * Trigger `flag_duplicate_request` otomatis menandai is_flagged_duplicate
 * jika stok proyek masih tersisa.
 */
export async function createMaterialRequest(
  formData: FormData
): Promise<ActionResponse & { is_flagged_duplicate?: boolean; current_stock?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Harap login terlebih dahulu.' };

  const projectId = String(formData.get('projectId') ?? '');
  const materialId = String(formData.get('materialId') ?? '');
  const requestedQty = Number(formData.get('requestedQty'));
  const notes = String(formData.get('notes') ?? '').trim();

  if (!projectId || !materialId || !(requestedQty > 0)) {
    return { error: 'Data pengajuan tidak lengkap. Pilih proyek, material, dan jumlah yang valid.' };
  }

  // Cek sisa stok untuk menampilkan peringatan seketika di layar tukang.
  const { data: stock } = await supabase
    .from('project_stocks')
    .select('current_stock')
    .eq('project_id', projectId)
    .eq('material_id', materialId)
    .maybeSingle();
  const currentStock = Number(stock?.current_stock ?? 0);

  const { data, error } = await supabase
    .from('material_requests')
    .insert({
      project_id: projectId,
      material_id: materialId,
      requester_id: user.id,
      requested_qty: requestedQty,
      notes: notes || null,
    })
    .select('id, is_flagged_duplicate')
    .single();

  if (error) return { error: error.message };

  revalidatePath('/request/history');
  revalidatePath('/admin/requests');
  revalidatePath('/admin/dashboard');

  return {
    success: true,
    is_flagged_duplicate: data.is_flagged_duplicate ?? currentStock > 0,
    current_stock: currentStock,
  };
}

/** Setujui / tolak pengajuan (khusus admin). */
export async function setRequestStatus(
  requestId: string,
  status: 'approved' | 'rejected'
): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Harap login terlebih dahulu.' };

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') return { error: 'Anda tidak punya akses.' };

  const { error } = await supabase
    .from('material_requests')
    .update({ status })
    .eq('id', requestId);
  if (error) return { error: error.message };

  revalidatePath('/admin/requests');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/audit');
  return { success: true };
}
