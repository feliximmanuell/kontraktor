import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getManagedProject } from '@/lib/projects';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { RequestStatusBadge, ReceiptStatusBadge } from '@/components/status-badges';
import { formatDateTime, formatIDR } from '@/lib/format';

type RequestRow = {
  id: string;
  project_name: string;
  material_name: string;
  requested_qty: string;
  notes: string | null;
  status: string;
  created_at: string;
  requester_name: string;
};

type PurchaseRow = {
  id: string;
  project_name: string;
  material_name: string;
  store_name: string;
  qty: string;
  total_price: number;
  receipt_status: string;
  purchased_at: string;
};

type UsageRow = {
  id: string;
  project_name: string;
  material_name: string;
  qty_used: string;
  used_for: string;
  used_at: string;
};

type ProjectGroup = {
  requests: RequestRow[];
  purchases: PurchaseRow[];
  usages: UsageRow[];
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  await requireRole(['admin', 'bos']);
  const { project } = await searchParams;
  const supabase = await createClient();
  const managed = await getManagedProject();
  const effectiveProject = managed ?? project ?? '';

  const [{ data: requests }, { data: purchases }, { data: usages }] = await Promise.all([
    supabase
      .from('material_requests')
      .select(
        'id, project_name, material_name, requested_qty, notes, status, created_at, requester_id, requester_name'
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('purchases')
      .select(
        'id, project_name, material_name, store_name, qty, total_price, receipt_status, purchased_at, purchased_by'
      )
      .order('purchased_at', { ascending: false }),
    supabase
      .from('material_usages')
      .select('id, project_name, material_name, qty_used, used_for, used_at, logged_by')
      .order('used_at', { ascending: false }),
  ]);

  const userIds = Array.from(
    new Set(
      [
        ...(requests ?? []).map((r) => (r as { requester_id: string | null }).requester_id),
        ...(purchases ?? []).map((p) => (p as { purchased_by: string | null }).purchased_by),
        ...(usages ?? []).map((u) => (u as { logged_by: string | null }).logged_by),
      ].filter(Boolean) as string[]
    )
  );
  const { data: profiles } = userIds.length
    ? await supabase.from('users_profile').select('user_id, full_name').in('user_id', userIds)
    : { data: [] };
  const nameMap = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p.full_name as string])
  );

  const grouped: Record<string, ProjectGroup> = {};

  for (const r of requests ?? []) {
    const row = r as unknown as {
      id: string;
      project_name: string;
      material_name: string;
      requested_qty: string;
      notes: string | null;
      status: string;
      created_at: string;
      requester_id: string | null;
    };
    const key = row.project_name || 'Tanpa proyek';
    if (!grouped[key]) grouped[key] = { requests: [], purchases: [], usages: [] };
    grouped[key].requests.push({
      ...row,
      requester_name:
        (row as { requester_name?: string | null }).requester_name?.trim() ||
        (row.requester_id ? nameMap.get(row.requester_id) ?? '-' : 'Publik'),
    });
  }

  for (const p of purchases ?? []) {
    const row = p as unknown as {
      id: string;
      project_name: string;
      material_name: string;
      store_name: string;
      qty: string;
      total_price: number;
      receipt_status: string;
      purchased_at: string;
      purchased_by: string | null;
    };
    const key = row.project_name || 'Tanpa proyek';
    if (!grouped[key]) grouped[key] = { requests: [], purchases: [], usages: [] };
    grouped[key].purchases.push(row);
  }

  for (const u of usages ?? []) {
    const row = u as unknown as {
      id: string;
      project_name: string;
      material_name: string;
      qty_used: string;
      used_for: string;
      used_at: string;
    };
    const key = row.project_name || 'Tanpa proyek';
    if (!grouped[key]) grouped[key] = { requests: [], purchases: [], usages: [] };
    grouped[key].usages.push(row);
  }

  const projectNames = Object.keys(grouped);
  const visible = effectiveProject
    ? projectNames.filter((name) => name === effectiveProject)
    : projectNames;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        description="Jejak lengkap Pengajuan → Pembelian → Pemakaian per proyek."
      >
        {managed ? (
          <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            Proyek: <span className="ml-1 font-semibold text-foreground">{managed}</span>
          </span>
        ) : (
          <form className="flex items-center gap-2" method="get">
            <select
              name="project"
              defaultValue={project ?? ''}
              className="h-8 rounded-lg border bg-background px-2 text-sm outline-none"
            >
              <option value="">Semua Proyek</option>
              {projectNames.map((name) => (
                <option key={name} value={name}>
                  {name}
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
        )}
      </PageHeader>

      {visible.length === 0 ? (
        <EmptyState title="Belum ada aktivitas" />
      ) : (
        <div className="space-y-6">
          {visible.map((name) => {
            const g = grouped[name];
            return (
              <div
                key={name}
                className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
              >
                <div className="border-b px-4 py-3">
                  <h2 className="font-semibold">{name}</h2>
                </div>

                <div className="grid gap-6 p-4 lg:grid-cols-3">
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pengajuan
                    </h3>
                    {g.requests.length === 0 ? (
                      <p className="text-sm text-muted-foreground">-</p>
                    ) : (
                      g.requests.map((row) => (
                        <div key={row.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {row.material_name} ({row.requested_qty})
                            </span>
                            <RequestStatusBadge
                              status={row.status as 'pending' | 'approved' | 'rejected'}
                            />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {row.requester_name} · {formatDateTime(row.created_at)}
                          </p>
                          {row.notes ? (
                            <p className="mt-1 text-xs text-muted-foreground">{row.notes}</p>
                          ) : null}
                        </div>
                      ))
                    )}
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pembelian
                    </h3>
                    {g.purchases.length === 0 ? (
                      <p className="text-sm text-muted-foreground">-</p>
                    ) : (
                      g.purchases.map((row) => (
                        <div key={row.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {row.material_name} ({row.qty})
                            </span>
                            <span className="font-semibold">{formatIDR(row.total_price)}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {row.store_name} · {formatDateTime(row.purchased_at)}
                          </p>
                          <div className="mt-1">
                            <ReceiptStatusBadge
                              status={row.receipt_status as 'pending' | 'received'}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pemakaian
                    </h3>
                    {g.usages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">-</p>
                    ) : (
                      g.usages.map((row) => (
                        <div key={row.id} className="rounded-lg border p-3 text-sm">
                          <span className="font-medium">
                            {row.material_name}{' '}
                            <span className="text-muted-foreground">(-{row.qty_used})</span>
                          </span>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(row.used_at)}
                          </p>
                          <p className="mt-1 text-xs">{row.used_for}</p>
                        </div>
                      ))
                    )}
                  </section>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
