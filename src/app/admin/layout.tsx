import { requireRole } from '@/lib/auth';
import { getManagedProject } from '@/lib/projects';
import { AdminNav } from '@/components/admin/admin-nav';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(['admin', 'bos']);
  const managedProject = await getManagedProject();
  return (
    <div className="min-h-svh bg-muted/30">
      <AdminNav
        role={profile.role}
        fullName={profile.full_name}
        managedProject={managedProject}
      />
      <main className="px-4 pb-24 pt-6 sm:px-6 lg:pb-10 lg:pl-[264px] lg:pr-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
