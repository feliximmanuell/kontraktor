import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getManagedProject } from '@/lib/projects';
import { PageHeader } from '@/components/page-header';
import { ReportsManager } from '@/components/admin/reports-manager';
import type { ReportGroupRow, ReportRow } from '@/lib/types';

const SORTS = ['paid_at', 'project_name', 'material_name'] as const;
type SortCol = (typeof SORTS)[number];

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(['admin', 'bos']);
  const sp = await searchParams;
  const managed = await getManagedProject();
  const project = managed ?? sp.project?.trim() ?? '';
  const material = sp.material?.trim() ?? '';
  const from = sp.from ?? '';
  const to = sp.to ?? '';
  const type = sp.type ?? '';
  const sort = (SORTS as readonly string[]).includes(sp.sort ?? '') ? (sp.sort as SortCol) : 'paid_at';
  const dir = sp.dir === 'asc' ? 'asc' : 'desc';

  const supabase = await createClient();

  let paymentQuery = supabase
    .from('payments')
    .select(
      'id, payment_type, purchase_id, description, project_name, material_name, amount, paid_at'
    );

  if (project) paymentQuery = paymentQuery.ilike('project_name', `%${project}%`);
  if (material) paymentQuery = paymentQuery.ilike('material_name', `%${material}%`);
  if (from) paymentQuery = paymentQuery.gte('paid_at', `${from}T00:00:00`);
  if (to) paymentQuery = paymentQuery.lte('paid_at', `${to}T23:59:59`);
  if (type === 'purchase' || type === 'manual') paymentQuery = paymentQuery.eq('payment_type', type);

  let incomeQuery = supabase
    .from('cashflow')
    .select('id, description, project_name, amount, entry_date');

  if (project) incomeQuery = incomeQuery.ilike('project_name', `%${project}%`);
  if (from) incomeQuery = incomeQuery.gte('entry_date', `${from}T00:00:00`);
  if (to) incomeQuery = incomeQuery.lte('entry_date', `${to}T23:59:59`);
  if (type === 'pemasukan') {
    // biarkan incomeQuery apa adanya (semua pemasukan)
  } else if (type === 'purchase' || type === 'manual') {
    incomeQuery = incomeQuery.eq('project_name', '__none__'); // saring habis
  }

  const [{ data: paymentsData }, { data: incomesData }] = await Promise.all([
    paymentQuery,
    incomeQuery,
  ]);
  const payments = (paymentsData ?? []) as unknown as {
    id: string;
    payment_type: 'purchase' | 'manual';
    purchase_id: string | null;
    description: string;
    project_name: string;
    material_name: string | null;
    amount: number;
    paid_at: string;
  }[];

  // Ambil purchase_group + detail item dari pembelian yang terkait.
  const purchaseIds = Array.from(
    new Set(
      payments
        .filter((p) => p.payment_type === 'purchase' && p.purchase_id)
        .map((p) => p.purchase_id as string)
    )
  );
  const purchaseMap = new Map<
    string,
    { purchase_group: string; material_name: string; qty: string }
  >();
  if (purchaseIds.length > 0) {
    const { data: purchases } = await supabase
      .from('purchases')
      .select('id, purchase_group, material_name, qty')
      .in('id', purchaseIds);
    for (const p of purchases ?? []) {
      const row = p as unknown as {
        id: string;
        purchase_group: string;
        material_name: string;
        qty: string;
      };
      purchaseMap.set(row.id, {
        purchase_group: row.purchase_group,
        material_name: row.material_name,
        qty: row.qty,
      });
    }
  }

  // Gabungkan pembayaran pembelian dalam satu transaksi (purchase_group).
  const groupMap = new Map<string, ReportGroupRow>();
  const rows: ReportRow[] = [];

  for (const p of payments) {
    if (p.payment_type === 'purchase' && p.purchase_id) {
      const purchase = purchaseMap.get(p.purchase_id);
      const gid = purchase?.purchase_group ?? p.purchase_id;
      let group = groupMap.get(gid);
      if (!group) {
        group = {
          kind: 'group',
          id: gid,
          paid_at: p.paid_at,
          project_name: p.project_name,
          description: '',
          items: [],
          total: 0,
        };
        groupMap.set(gid, group);
      }
      group.items.push({
        material_name: purchase?.material_name ?? p.material_name ?? '',
        qty: purchase?.qty ?? '',
        amount: Number(p.amount ?? 0),
      });
      group.total += Number(p.amount ?? 0);
      if (p.paid_at < group.paid_at) group.paid_at = p.paid_at;
    } else {
      rows.push({
        kind: 'manual',
        id: p.id,
        paid_at: p.paid_at,
        project_name: p.project_name,
        material_name: p.material_name,
        description: p.description,
        amount: Number(p.amount ?? 0),
      });
    }
  }
  for (const g of groupMap.values()) {
    g.description = `Pembayaran pembelian (${g.items.length} item)`;
    rows.push(g);
  }

  // Pemasukan dari tabel cashflow masuk ke laporan.
  for (const i of incomesData ?? []) {
    const row = i as unknown as {
      id: string;
      description: string;
      project_name: string;
      amount: number;
      entry_date: string;
    };
    rows.push({
      kind: 'income',
      id: `in-${row.id}`,
      entry_date: row.entry_date,
      project_name: row.project_name,
      description: row.description,
      amount: Number(row.amount ?? 0),
    });
  }

  rows.sort((a, b) => {
    let av: string;
    let bv: string;
    if (sort === 'project_name') {
      av = a.project_name;
      bv = b.project_name;
    } else if (sort === 'material_name') {
      av =
        a.kind === 'group'
          ? a.items[0]?.material_name ?? ''
          : a.kind === 'income'
            ? a.description
            : a.material_name ?? '';
      bv =
        b.kind === 'group'
          ? b.items[0]?.material_name ?? ''
          : b.kind === 'income'
            ? b.description
            : b.material_name ?? '';
    } else {
      av = a.kind === 'income' ? a.entry_date : a.paid_at;
      bv = b.kind === 'income' ? b.entry_date : b.paid_at;
    }
    return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Keuangan"
        description="Semua arus uang keluar masuk: pemasukan, pembayaran pembelian, dan pengeluaran manual. Klik panah untuk melihat rincian pembelian."
      />

      <form method="get" className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1 lg:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Proyek</label>
            <input
              name="project"
              defaultValue={project}
              readOnly={!!managed}
              placeholder="Cth: Rumah Pak Haji Jamil"
              className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-70"
              disabled={!!managed}
            />
          </div>
          <div className="space-y-1 lg:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Material</label>
            <input
              name="material"
              defaultValue={material}
              placeholder="Cth: Semen 50kg"
              className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tipe</label>
            <select
              name="type"
              defaultValue={type}
              className="h-9 w-full rounded-lg border bg-background px-2 text-sm outline-none"
            >
              <option value="">Semua</option>
              <option value="pemasukan">Pemasukan</option>
              <option value="purchase">Pembelian</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">&nbsp;</label>
            <button
              type="submit"
              className="h-9 w-full rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              Terapkan
            </button>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Dari</label>
            <input
              name="from"
              type="date"
              defaultValue={from}
              className="h-9 w-full rounded-lg border bg-background px-2 text-sm outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Sampai</label>
            <input
              name="to"
              type="date"
              defaultValue={to}
              className="h-9 w-full rounded-lg border bg-background px-2 text-sm outline-none"
            />
          </div>
        </div>
      </form>

      <ReportsManager rows={rows} />
    </div>
  );
}
