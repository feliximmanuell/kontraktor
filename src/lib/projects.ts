import { cookies } from 'next/headers';

export const MANAGED_PROJECT_COOKIE = 'managed_project';

// Nilai cookie untuk "kelola semua proyek". Dipakai agar middleware tidak
// menganggap user "belum memilih proyek" (yang akan diarahkan ke chooser lagi).
export const ALL_PROJECTS_VALUE = '__all__';

/** Proyek yang sedang dikelola (null = semua proyek). */
export async function getManagedProject(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(MANAGED_PROJECT_COOKIE)?.value;
  return value && value.trim() && value !== ALL_PROJECTS_VALUE ? value : null;
}
