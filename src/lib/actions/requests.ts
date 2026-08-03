'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ActionResponse = {
  success?: boolean;
  error?: string;
};

/**
 * Pengajuan material PUBLIK — tanpa perlu akun.
 * Nama proyek, nama material, dan jumlah semuanya bebas (free text).
 */
export async function createMaterialRequest(
  formData: FormData
): Promise<ActionResponse> {
  const supabase = await createClient();

  const projectName = String(formData.get('projectName') ?? '').trim();
  const materialName = String(formData.get('materialName') ?? '').trim();
  const requestedQty = String(formData.get('requestedQty') ?? '').trim();
  const requesterName = String(formData.get('requesterName') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();

  if (!projectName || !materialName || !requestedQty) {
    return { error: 'Data pengajuan tidak lengkap. Isi nama proyek, nama material, dan jumlah.' };
  }

  const { error } = await supabase.from('material_requests').insert({
    project_id: null,
    project_name: projectName,
    material_id: null,
    material_name: materialName,
    requester_id: null,
    requester_name: requesterName || null,
    requested_qty: requestedQty,
    notes: notes || null,
  });

  if (error) return { error: error.message };

  revalidatePath('/admin/requests');
  revalidatePath('/admin/dashboard');

  return { success: true };
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
