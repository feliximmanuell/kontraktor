'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { MANAGED_PROJECT_COOKIE } from '@/lib/projects';

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
  if (project) {
    store.set(MANAGED_PROJECT_COOKIE, project, { path: '/' });
  } else {
    store.delete(MANAGED_PROJECT_COOKIE);
  }
  redirect('/admin/dashboard');
}
