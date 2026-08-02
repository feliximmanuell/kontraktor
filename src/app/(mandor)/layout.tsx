import { requireRole } from '@/lib/auth';
import { MandorNav } from '@/components/mandor/mandor-nav';

export default async function MandorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(['tukang']);
  return (
    <div className="min-h-svh bg-muted/30">
      <MandorNav fullName={profile.full_name} />
      <main className="mx-auto w-full max-w-lg px-4 py-6">{children}</main>
    </div>
  );
}
