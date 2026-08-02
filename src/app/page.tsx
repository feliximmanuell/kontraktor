import { redirect } from 'next/navigation';
import { getAuthProfile, homePathForRole } from '@/lib/auth';

export default async function Home() {
  const profile = await getAuthProfile();
  redirect(profile ? homePathForRole(profile.role) : '/request');
}
