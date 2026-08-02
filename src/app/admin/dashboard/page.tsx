import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getManagedProject } from '@/lib/projects';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { RequestStatusBadge } from '@/components/status-badges';
import { formatIDR, formatDateTime } from '@/lib/format';
import { Banknote, Boxes, ClipboardList, FileWarning } from 'lucide-react';

export default async function AdminDashboardPage() {
  await requireRole(['admin', 'bos']);
  const supabase = await createClient();
  const managed = await getManagedProject();

  let purchasesQ = supabase.from('purchases').select('project_name, total_price, receipt_status');
  let pendingReqQ = supabase.from('material_requests').select('id').eq('status', 'pending');
  let recentReqQ = supabase
    .from('material_requests')
    .select('id, project_name, material_name, requested_qty, notes, status, created_at')
    .order('created_at', { ascending: false })
    .limit(6);
  if (managed) {
    purchasesQ = purchasesQ.eq('project_name', managed);
    pendingReqQ = pendingReqQ.eq('project_name', managed);
    recentReqQ = recentReqQ.eq('project_name', managed);
  }

  const [{ data: purchases }, { data: pendingReq }, { data: recentReq }] =
    await Promise.all([purchasesQ, pendingReqQ, recentReqQ]);

  const totalSpent = (purchases ?? []).reduce(
    (acc, p) => acc + Number((p as { total_price: number }).total_price ?? 0),
    0
  );
  const missingReceipts = (purchases ?? []).filter(
    (p) => (p as { receipt_status: string }).receipt_status === 'pending'
  ).length;

  const spendingPerProject = new Map<string, number>();
  for (const p of purchases ?? []) {
    const row = p as unknown as { project_name: string; total_price: number };
    const name = row.project_name || 'Tanpa proyek';
    spendingPerProject.set(name, (spendingPerProject.get(name) ?? 0) + Number(row.total_price ?? 0));
  }
  const spendingRows = Array.from(spendingPerProject.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  const kpis = [
    { label: 'Total Belanja Material', value: formatIDR(totalSpent), icon: Banknote },
    { label: 'Total Pembelian', value: String(purchases?.length ?? 0), icon: Boxes },
    { label: 'Pengajuan Menunggu', value: String(pendingReq?.length ?? 0), icon: ClipboardList },
    { label: 'Bon Belum Diterima', value: String(missingReceipts), icon: FileWarning },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Audit"
        description="Ringkasan belanja material dan pengajuan terbaru."
      >
        {managed ? (
          <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            Proyek: <span className="ml-1 font-semibold text-foreground">{managed}</span>
          </span>
        ) : null}
      </PageHeader>

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
            <h2 className="font-semibold">Pengajuan Terbaru</h2>
          </div>
          <div className="divide-y">
            {recentReq === null || recentReq.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Belum ada pengajuan" />
              </div>
            ) : (
              recentReq.map((r) => {
                const row = r as unknown as {
                  id: string;
                  project_name: string;
                  material_name: string;
                  requested_qty: string;
                  notes: string | null;
                  status: string;
                  created_at: string;
                };
                return (
                  <div key={row.id} className="space-y-1.5 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">
                        {row.material_name}{' '}
                        <span className="text-muted-foreground">({row.requested_qty})</span>
                      </p>
                      <RequestStatusBadge
                        status={row.status as 'pending' | 'approved' | 'rejected'}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">{row.project_name}</p>
                    {row.notes ? (
                      <p className="text-xs text-muted-foreground">{row.notes}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
