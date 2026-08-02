import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { RequestStatusBadge, ReceiptStatusBadge } from '@/components/status-badges';
import { formatDateTime, formatIDR } from '@/lib/format';

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  await requireRole(['admin', 'bos']);
  const { project } = await searchParams;
  const supabase = await createClient();

  const [{ data: requests }, { data: purchases }, { data: usages }, { data: projects }] =
    await Promise.all([
      supabase
        .from('material_requests')
        .select(
          'id, requested_qty, notes, status, is_flagged_duplicate, created_at, project_id, requester_id, material_name, materials(name, unit)'
        )
        .order('created_at', { ascending: false }),
      supabase
        .from('purchases')
        .select(
          'id, store_name, qty, unit_price, total_price, receipt_status, purchased_at, project_id, materials(name, unit)'
        )
        .order('purchased_at', { ascending: false }),
      supabase
        .from('material_usages')
        .select('id, qty_used, used_for, used_at, project_id, materials(name, unit)')
        .order('used_at', { ascending: false }),
      supabase.from('projects').select('id, name, location, status').order('name'),
    ]);

  const projectRows = (projects ?? []) as {
    id: string;
    name: string;
    location: string | null;
    status: string;
  }[];

  const requesterIds = Array.from(
    new Set(
      (requests ?? [])
        .map((r) => (r as { requester_id: string | null }).requester_id)
        .filter(Boolean) as string[]
    )
  );
  const { data: profiles } = requesterIds.length
    ? await supabase.from('users_profile').select('user_id, full_name').in('user_id', requesterIds)
    : { data: [] };
  const nameMap = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p.full_name as string])
  );

  const grouped: Record<
    string,
    {
      project: { id: string; name: string; location: string | null; status: string };
      requests: unknown[];
      purchases: unknown[];
      usages: unknown[];
    }
  > = {};

  for (const p of projectRows) {
    grouped[p.id] = { project: p, requests: [], purchases: [], usages: [] };
  }

  for (const r of requests ?? []) {
    const row = r as unknown as {
      project_id: string;
      id: string;
      requested_qty: number;
      notes: string | null;
      status: string;
      is_flagged_duplicate: boolean;
      created_at: string;
      requester_id: string | null;
      material_name: string;
      materials: { name: string; unit: string } | null;
    };
    if (!grouped[row.project_id]) {
      grouped[row.project_id] = {
        project: { id: row.project_id, name: 'Proyek', location: null, status: 'active' },
        requests: [],
        purchases: [],
        usages: [],
      };
    }
    grouped[row.project_id].requests.push({
      ...row,
      requester_name: row.requester_id ? nameMap.get(row.requester_id) ?? '-' : 'Publik',
    });
  }

  for (const p of purchases ?? []) {
    const row = p as unknown as {
      project_id: string;
      id: string;
      store_name: string;
      qty: number;
      unit_price: number;
      total_price: number;
      receipt_status: string;
      purchased_at: string;
      materials: { name: string; unit: string } | null;
    };
    if (!grouped[row.project_id]) {
      grouped[row.project_id] = {
        project: { id: row.project_id, name: 'Proyek', location: null, status: 'active' },
        requests: [],
        purchases: [],
        usages: [],
      };
    }
    grouped[row.project_id].purchases.push(row);
  }

  for (const u of usages ?? []) {
    const row = u as unknown as {
      project_id: string;
      id: string;
      qty_used: number;
      used_for: string;
      used_at: string;
      materials: { name: string; unit: string } | null;
    };
    if (!grouped[row.project_id]) {
      grouped[row.project_id] = {
        project: { id: row.project_id, name: 'Proyek', location: null, status: 'active' },
        requests: [],
        purchases: [],
        usages: [],
      };
    }
    grouped[row.project_id].usages.push(row);
  }

  const visible = Object.values(grouped).filter(
    (g) =>
      g.requests.length > 0 ||
      g.purchases.length > 0 ||
      g.usages.length > 0 ||
      !project // tampilkan semua proyek saat tanpa filter
  );

  const filtered = project
    ? visible.filter((g) => g.project.id === project)
    : visible;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        description="Jejak lengkap Pengajuan → Pembelian → Pemakaian per proyek."
      >
        <form className="flex items-center gap-2" method="get">
          <select
            name="project"
            defaultValue={project ?? ''}
            className="h-8 rounded-lg border bg-background px-2 text-sm outline-none"
          >
            <option value="">Semua Proyek</option>
            {projectRows.map((p) => (
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

      {filtered.length === 0 ? (
        <EmptyState title="Belum ada aktivitas" />
      ) : (
        <div className="space-y-6">
          {filtered.map((g) => (
            <div key={g.project.id} className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              <div className="border-b px-4 py-3">
                <h2 className="font-semibold">{g.project.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {g.project.location ?? '-'} · {g.project.status === 'active' ? 'Berjalan' : 'Selesai'}
                </p>
              </div>

              <div className="grid gap-6 p-4 lg:grid-cols-3">
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pengajuan
                  </h3>
                  {g.requests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">-</p>
                  ) : (
                    g.requests.map((r) => {
                      const row = r as {
                        id: string;
                        requested_qty: number;
                        notes: string | null;
                        status: string;
                        is_flagged_duplicate: boolean;
                        created_at: string;
                        requester_name: string;
                        material_name: string;
                        materials: { name: string; unit: string } | null;
                      };
                      return (
                        <div key={row.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {row.materials?.name ?? row.material_name} (
                              {row.requested_qty} {row.materials?.unit})
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
                      );
                    })
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pembelian
                  </h3>
                  {g.purchases.length === 0 ? (
                    <p className="text-sm text-muted-foreground">-</p>
                  ) : (
                    g.purchases.map((p) => {
                      const row = p as {
                        id: string;
                        store_name: string;
                        qty: number;
                        unit_price: number;
                        total_price: number;
                        receipt_status: string;
                        purchased_at: string;
                        materials: { name: string; unit: string } | null;
                      };
                      return (
                        <div key={row.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {row.materials?.name} ({row.qty} {row.materials?.unit})
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
                      );
                    })
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pemakaian
                  </h3>
                  {g.usages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">-</p>
                  ) : (
                    g.usages.map((u) => {
                      const row = u as {
                        id: string;
                        qty_used: number;
                        used_for: string;
                        used_at: string;
                        materials: { name: string; unit: string } | null;
                      };
                      return (
                        <div key={row.id} className="rounded-lg border p-3 text-sm">
                          <span className="font-medium">
                            {row.materials?.name}{' '}
                            <span className="text-muted-foreground">
                              (-{row.qty_used} {row.materials?.unit})
                            </span>
                          </span>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(row.used_at)}
                          </p>
                          <p className="mt-1 text-xs">{row.used_for}</p>
                        </div>
                      );
                    })
                  )}
                </section>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
