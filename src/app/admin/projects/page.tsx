import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { selectProject } from '@/lib/actions/projects';
import { DeleteProjectButton } from '@/components/admin/delete-project-button';
import { Layers, FolderOpen, Plus } from 'lucide-react';

export default async function AdminProjectsPage() {
  await requireRole(['admin', 'bos']);
  const supabase = await createClient();

  const [{ data: r1 }, { data: r2 }, { data: r3 }, { data: r4 }] = await Promise.all([
    supabase.from('material_requests').select('project_name'),
    supabase.from('purchases').select('project_name'),
    supabase.from('payments').select('project_name'),
    supabase.from('material_usages').select('project_name'),
  ]);

  const names = Array.from(
    new Set(
      [...(r1 ?? []), ...(r2 ?? []), ...(r3 ?? []), ...(r4 ?? [])]
        .map((x) => (x as { project_name: string }).project_name)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pilih Proyek"
        description="Pilih proyek yang ingin dikelola. Data pembelian, pembayaran, pengajuan, dan pemakaian akan disaring sesuai proyek ini."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <form action={selectProject}>
          <input type="hidden" name="project" value="" />
          <button
            type="submit"
            className="flex w-full flex-col items-start gap-3 rounded-xl bg-card p-4 text-left ring-1 ring-primary/40 transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <Layers className="size-6" />
            <div>
              <p className="font-semibold">Semua Proyek</p>
              <p className="text-sm opacity-80">Kelola semua proyek sekaligus.</p>
            </div>
          </button>
        </form>

        {names.map((name) => (
          <form key={name} action={selectProject}>
            <input type="hidden" name="project" value={name} />
            <div className="flex items-start justify-between gap-3">
              <button
                type="submit"
                className="flex min-w-0 flex-1 flex-col items-start gap-3 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <FolderOpen className="size-6" />
                <div>
                  <p className="font-semibold">{name}</p>
                  <p className="text-sm opacity-80">Kelola proyek ini saja.</p>
                </div>
              </button>
              <div className="pt-3 pr-2">
                <DeleteProjectButton projectName={name} />
              </div>
            </div>
          </form>
        ))}
      </div>

      <form
        action={selectProject}
        className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
      >
        <label className="text-sm font-medium">Atau kelola proyek baru</label>
        <div className="mt-2 flex gap-2">
          <input
            name="project"
            placeholder="Cth: Rumah Pak Haji Jamil"
            className="h-9 w-full max-w-sm rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            <Plus className="size-4" />
            Kelola
          </button>
        </div>
      </form>
    </div>
  );
}
