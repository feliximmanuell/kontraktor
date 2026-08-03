import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PROFILE_COOKIE, decodeProfile } from '@/lib/session';

export type Role = 'tukang' | 'admin' | 'bos';

export interface AuthProfile {
  id: string;
  user_id: string;
  full_name: string;
  role: Role;
}

/**
 * Ambil profil pengguna yang login. Dibungkus React `cache()` agar dalam satu
 * request (layout + halaman + komponen server) auth hanya dipanggil sekali,
 * bukan berulang kali (menghemat beberapa round-trip jaringan ke Supabase).
 */
export const getAuthProfile = cache(async (): Promise<AuthProfile | null> => {
  // Profil sudah divalidasi middleware pada tiap request (getUser + query DB).
  // Baca dari cookie untuk menghindari round-trip jaringan berulang.
  const store = await cookies();
  const raw = store.get(PROFILE_COOKIE)?.value;
  if (raw) {
    const p = decodeProfile(raw);
    if (p) {
      return {
        id: p.id ?? '',
        user_id: p.user_id,
        full_name: p.full_name ?? '',
        role: p.role,
      };
    }
  }

  // Fallback: cookie belum ada (mis. request pertama setelah login).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('users_profile')
    .select('id, user_id, full_name, role')
    .eq('user_id', user.id)
    .maybeSingle();

  return (data as AuthProfile | null) ?? null;
});

/** Wajib login. Redirect ke /login jika tidak. */
export async function requireAuth(): Promise<AuthProfile> {
  const profile = await getAuthProfile();
  if (!profile) redirect('/login');
  return profile;
}

/** Wajib login + role tertentu. Redirect ke portal yang sesuai jika tidak berhak. */
export async function requireRole(roles: Role[]): Promise<AuthProfile> {
  const profile = await requireAuth();
  if (!roles.includes(profile.role)) {
    redirect(profile.role === 'tukang' ? '/request' : '/admin/dashboard');
  }
  return profile;
}

export function homePathForRole(role: Role): string {
  return role === 'tukang' ? '/request' : '/admin/dashboard';
}
