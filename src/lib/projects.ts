import { cookies } from 'next/headers';

export const MANAGED_PROJECT_COOKIE = 'managed_project';

/** Proyek yang sedang dikelola (null = semua proyek). */
export async function getManagedProject(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(MANAGED_PROJECT_COOKIE)?.value;
  return value && value.trim() ? value : null;
}
