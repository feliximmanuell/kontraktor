'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ActionResponse = {
  success?: boolean;
  error?: string;
};

/**
 * Pengajuan material PUBLIK — tanpa perlu akun.
 * Nama material bebas (free text). Jika nama cocok dengan master material,
 * material_id otomatis diisi sehingga cek stok & deteksi pembelian ganda tetap jalan.
 */
export async function createMaterialRequest(
  formData: FormData
): Promise<ActionResponse> {
  const supabase = await createClient();

  const projectId = String(formData.get('projectId') ?? '');
  const materialName = String(formData.get('materialName') ?? '').trim();
  const requestedQty = Number(formData.get('requestedQty'));
  const notes = String(formData.get('notes') ?? '').trim();

  if (!projectId || !materialName || !(requestedQty > 0)) {
    return { error: 'Data pengajuan tidak lengkap. Isi proyek, nama material, dan jumlah yang valid.' };
  }

  // Coba samakan dengan master material (ignore-case) agar terhubung ke stok.
  const { data: matched } = await supabase
    .from('materials')
    .select('id')
    .ilike('name', materialName)
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('material_requests').insert({
    project_id: projectId,
    material_id: matched?.id ?? null,
    material_name: materialName,
    requester_id: null,
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
