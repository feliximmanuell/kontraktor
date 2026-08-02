import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { StockAlertBadge } from '@/components/stock-alert-badge';
import { formatIDR, formatDateTime } from '@/lib/format';
import { Banknote, Boxes, ClipboardList, FileWarning } from 'lucide-react';

export default async function AdminDashboardPage() {
  await requireRole(['admin', 'bos']);
  const supabase = await createClient();

  const [{ data: purchases }, { data: projects }, { data: pendingReq }, { data: flaggedReq }, { data: stocks }] =
    await Promise.all([
      supabase
        .from('purchases')
        .select('id, total_price, receipt_status, project_id, projects(name)'),
      supabase.from('projects').select('id, status'),
      supabase.from('material_requests').select('id').eq('status', 'pending'),
      supabase
        .from('material_requests')
        .select(
          'id, requested_qty, created_at, project_id, material_id, material_name, is_flagged_duplicate, projects(name), materials(name, unit)'
        )
        .eq('status', 'pending')
        .eq('is_flagged_duplicate', true)
        .order('created_at', { ascending: false }),
      supabase.from('project_stocks').select('project_id, material_id, current_stock'),
    ]);

  const totalSpent = (purchases ?? []).reduce(
    (acc, p) => acc + Number((p as { total_price: number }).total_price ?? 0),
    0
  );
  const missingReceipts = (purchases ?? []).filter(
    (p) => (p as { receipt_status: string }).receipt_status === 'pending'
  ).length;
  const activeProjects = (projects ?? []).filter(
    (p) => (p as { status: string }).status === 'active'
  ).length;

  const spendingPerProject = new Map<string, number>();
  for (const p of purchases ?? []) {
    const row = p as unknown as {
      total_price: number;
      projects: { name: string } | null;
    };
    const name = row.projects?.name ?? 'Tanpa proyek';
    spendingPerProject.set(name, (spendingPerProject.get(name) ?? 0) + Number(row.total_price ?? 0));
  }
  const spendingRows = Array.from(spendingPerProject.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  const stockMap = new Map<string, number>();
  for (const s of stocks ?? []) {
    const row = s as unknown as {
      project_id: string;
      material_id: string;
      current_stock: number;
    };
    stockMap.set(`${row.project_id}:${row.material_id}`, Number(row.current_stock ?? 0));
  }

  const alerts = (flaggedReq ?? []).map((r) => {
    const row = r as unknown as {
      id: string;
      requested_qty: number;
      created_at: string;
      project_id: string;
      material_id: string | null;
      material_name: string;
      projects: { name: string } | null;
      materials: { name: string; unit: string } | null;
    };
    return {
      ...row,
      current_stock:
        row.material_id && row.project_id
          ? stockMap.get(`${row.project_id}:${row.material_id}`) ?? 0
          : 0,
    };
  });

  const kpis = [
    { label: 'Total Belanja Material', value: formatIDR(totalSpent), icon: Banknote },
    { label: 'Proyek Aktif', value: String(activeProjects), icon: Boxes },
    { label: 'Pengajuan Menunggu', value: String(pendingReq?.length ?? 0), icon: ClipboardList },
    { label: 'Bon Belum Diterima', value: String(missingReceipts), icon: FileWarning },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Audit"
        description="Ringkasan belanja, pengajuan, dan peringatan pembelian ganda."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
              <k.icon className="size-4 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold lg:text-2xl">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Rekap Belanja per Proyek</h2>
          </div>
          <div className="p-4">
            {spendingRows.length === 0 ? (
              <EmptyState title="Belum ada pembelian" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Proyek</th>
                    <th className="pb-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {spendingRows.map((row) => (
                    <tr key={row.name} className="border-t">
                      <td className="py-2.5">{row.name}</td>
                      <td className="py-2.5 text-right font-semibold">
                        {formatIDR(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Alert Pembelian Ganda</h2>
            <p className="text-xs text-muted-foreground">
              Pengajuan pending yang masih memiliki sisa stok di proyek.
            </p>
          </div>
          <div className="divide-y">
            {alerts.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Tidak ada alert" description="Semua pengajuan aman." />
              </div>
            ) : (
              alerts.map((a) => (
                <div key={a.id} className="space-y-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">
                      {a.materials?.name ?? a.material_name}{' '}
                      <span className="text-muted-foreground">
                        ({a.requested_qty} {a.materials?.unit})
                      </span>
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(a.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{a.projects?.name}</p>
                  <StockAlertBadge
                    currentStock={a.current_stock}
                    unit={a.materials?.unit ?? ''}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
