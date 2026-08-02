'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { MANAGED_PROJECT_COOKIE } from '@/lib/projects';

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const store = await cookies();
  store.delete(MANAGED_PROJECT_COOKIE);
  redirect('/login');
}
