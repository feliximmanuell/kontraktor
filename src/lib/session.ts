export const PROFILE_COOKIE = 'ma_profile';

export interface SessionProfile {
  id: string | null;
  user_id: string;
  full_name: string | null;
  role: 'tukang' | 'admin' | 'bos';
}

/**
 * Cookie profil hanya berisi data yang sudah divalidasi middleware (getUser +
 * query users_profile) pada tiap request. Dipakai server component agar tidak
 * perlu round-trip getUser() + query DB ulang per navigasi navbar.
 */
export function encodeProfile(p: SessionProfile): string {
  return encodeURIComponent(JSON.stringify(p));
}

export function decodeProfile(raw: string): SessionProfile | null {
  try {
    const p = JSON.parse(decodeURIComponent(raw)) as SessionProfile;
    if (!p || !p.user_id) return null;
    if (!['tukang', 'admin', 'bos'].includes(p.role)) return null;
    return p;
  } catch {
    return null;
  }
}