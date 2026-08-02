import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { StockAdjustDialog } from '@/components/admin/stock-adjust-dialog';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { formatDateTime } from '@/lib/format';
import type { StockJoined } from '@/lib/types';

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const profile = await requireRole(['admin', 'bos']);
  const isAdmin = profile.role === 'admin';
  const { project } = await searchParams;

  const supabase = await createClient();

  const query = supabase
    .from('project_stocks')
    .select(
      'id, project_id, material_id, current_stock, updated_at, projects(name, location), materials(name, unit)'
    )
    .order('current_stock', { ascending: true });

  const [stockRes, projectRes] = await Promise.all([
    project ? query.eq('project_id', project) : query,
    supabase.from('projects').select('id, name, status'),
  ]);

  const projects = (projectRes.data ?? []) as { id: string; name: string; status: string }[];
  const stocks = (stockRes.data ?? []) as unknown as StockJoined[];

  function stockClass(stock: number) {
    if (stock <= 0) return 'text-red-600 font-bold';
    if (stock < 5) return 'text-amber-600 font-semibold';
    return 'text-slate-900';
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stok Material per Proyek"
        description="Sisa stok aktual setiap proyek. Merah = habis, kuning = menipis."
      >
        <form className="flex items-center gap-2" method="get">
          <select
            name="project"
            defaultValue={project ?? ''}
            className="h-8 rounded-lg border bg-background px-2 text-sm outline-none"
          >
            <option value="">Semua Proyek</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-8 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            Filter
          </button>
        </form>
      </PageHeader>

      {stocks.length === 0 ? (
        <EmptyState
          title="Belum ada data stok"
          description="Stok akan tercatat otomatis saat pembelian pertama dilakukan."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Proyek</th>
                <th className="px-4 py-3 font-medium">Material</th>
                <th className="px-4 py-3 text-right font-medium">Sisa Stok</th>
                <th className="px-4 py-3 font-medium">Terakhir Update</th>
                {isAdmin ? <th className="px-4 py-3 font-medium">Aksi</th> : null}
              </tr>
            </thead>
            <tbody>
              {stocks.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{s.projects?.name}</td>
                  <td className="px-4 py-3">
                    {s.materials?.name}{' '}
                    <span className="text-muted-foreground">({s.materials?.unit})</span>
                  </td>
                  <td className={`px-4 py-3 text-right ${stockClass(s.current_stock)}`}>
                    {s.current_stock}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDateTime(s.updated_at)}
                  </td>
                  {isAdmin ? (
                    <td className="px-4 py-3">
                      <StockAdjustDialog stockId={s.id} currentStock={s.current_stock} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
