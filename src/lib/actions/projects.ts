'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { MANAGED_PROJECT_COOKIE, ALL_PROJECTS_VALUE } from '@/lib/projects';

/** Pilih proyek yang dikelola. FormData berisi 'project' (kosong = semua). */
export async function selectProject(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin' && profile?.role !== 'bos') {
    redirect('/request');
  }

  const project = String(formData.get('project') ?? '').trim();
  const store = await cookies();
  // Kosong = "Semua Proyek". Simpan nilai sentinel, bukan hapus cookie, agar
  // middleware tahu bahwa pengguna SUDAH memilih (bukan belum memilih).
  store.set(MANAGED_PROJECT_COOKIE, project || ALL_PROJECTS_VALUE, { path: '/' });
  redirect('/admin/dashboard');
}

/** Hapus proyek beserta seluruh datanya (pengajuan, pembelian, pembayaran, pemakaian, cashflow). */
export async function deleteProject(projectName: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin' && profile?.role !== 'bos') {
    redirect('/request');
  }

  const name = projectName.trim();
  if (!name) {
    redirect('/admin/projects');
  }

  const tables = ['material_requests', 'purchases', 'material_usages', 'payments', 'cashflow'];
  for (const table of tables) {
    await supabase.from(table).delete().eq('project_name', name);
  }

  const store = await cookies();
  if (store.get(MANAGED_PROJECT_COOKIE)?.value === name) {
    store.set(MANAGED_PROJECT_COOKIE, ALL_PROJECTS_VALUE, { path: '/' });
  }

  revalidatePath('/admin/projects');
  revalidatePath('/admin/dashboard');
  redirect('/admin/projects');
}
