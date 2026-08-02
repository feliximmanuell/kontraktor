import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getManagedProject } from '@/lib/projects';
import { PageHeader } from '@/components/page-header';
import { CashflowManager } from '@/components/admin/cashflow-manager';

export interface JournalRow {
  id: string;
  date: string;
  description: string;
  project_name: string;
  kind: 'pemasukan' | 'pengeluaran';
  source: 'cashflow' | 'payment';
  amount: number;
  by_name: string;
}

const SORTS = ['date', 'project_name', 'amount'] as const;
type SortCol = (typeof SORTS)[number];

export default async function AdminCashflowPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireRole(['admin', 'bos']);
  const sp = await searchParams;
  const managed = await getManagedProject();
  const project = managed ?? sp.project?.trim() ?? '';
  const from = sp.from ?? '';
  const to = sp.to ?? '';
  const type = sp.type ?? '';
  const sort = (SORTS as readonly string[]).includes(sp.sort ?? '') ? (sp.sort as SortCol) : 'date';
  const dir = sp.dir === 'asc' ? 'asc' : 'desc';

  const supabase = await createClient();

  let incomeQ = supabase
    .from('cashflow')
    .select('id, description, project_name, amount, entry_date, created_by');
  let expenseQ = supabase
    .from('payments')
    .select('id, description, project_name, amount, paid_at, paid_by');

  if (project) {
    incomeQ = incomeQ.ilike('project_name', `%${project}%`);
    expenseQ = expenseQ.ilike('project_name', `%${project}%`);
  }
  if (from) {
    incomeQ = incomeQ.gte('entry_date', `${from}T00:00:00`);
    expenseQ = expenseQ.gte('paid_at', `${from}T00:00:00`);
  }
  if (to) {
    incomeQ = incomeQ.lte('entry_date', `${to}T23:59:59`);
    expenseQ = expenseQ.lte('paid_at', `${to}T23:59:59`);
  }
  if (type === 'pemasukan') {
    expenseQ = expenseQ.eq('project_name', '__none__');
  } else if (type === 'pengeluaran') {
    incomeQ = incomeQ.eq('project_name', '__none__');
  }

  const [{ data: income }, { data: expenses }] = await Promise.all([incomeQ, expenseQ]);

  const userIds = Array.from(
    new Set([
      ...(income ?? []).map((r) => (r as { created_by: string | null }).created_by),
      ...(expenses ?? []).map((r) => (r as { paid_by: string | null }).paid_by),
    ].filter(Boolean) as string[])
  );
  const { data: profiles } = userIds.length
    ? await supabase.from('users_profile').select('user_id, full_name').in('user_id', userIds)
    : { data: [] };
  const nameMap = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p.full_name as string])
  );

  const rows: JournalRow[] = [
    ...(income ?? []).map((r) => {
      const row = r as unknown as {
        id: string;
        description: string;
        project_name: string;
        amount: number;
        entry_date: string;
        created_by: string | null;
      };
      return {
        id: `in-${row.id}`,
        date: row.entry_date,
        description: row.description,
        project_name: row.project_name,
        kind: 'pemasukan' as const,
        source: 'cashflow' as const,
        amount: Number(row.amount ?? 0),
        by_name: row.created_by ? nameMap.get(row.created_by) ?? '-' : '-',
      };
    }),
    ...(expenses ?? []).map((r) => {
      const row = r as unknown as {
        id: string;
        description: string;
        project_name: string;
        amount: number;
        paid_at: string;
        paid_by: string | null;
      };
      return {
        id: `out-${row.id}`,
        date: row.paid_at,
        description: row.description,
        project_name: row.project_name,
        kind: 'pengeluaran' as const,
        source: 'payment' as const,
        amount: Number(row.amount ?? 0),
        by_name: row.paid_by ? nameMap.get(row.paid_by) ?? '-' : '-',
      };
    }),
  ];

  rows.sort((a, b) => {
    if (sort === 'project_name') {
      return dir === 'asc' ? a.project_name.localeCompare(b.project_name) : b.project_name.localeCompare(a.project_name);
    }
    if (sort === 'amount') {
      return dir === 'asc' ? a.amount - b.amount : b.amount - a.amount;
    }
    return dir === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cashflow"
        description="Jurnal keuangan: catat pemasukan, dan pantau pengeluaran yang sudah tercatat (pembelian & pengeluaran manual)."
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
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tipe</label>
            <select
              name="type"
              defaultValue={type}
              className="h-9 w-full rounded-lg border bg-background px-2 text-sm outline-none"
            >
              <option value="">Semua</option>
              <option value="pemasukan">Pemasukan</option>
              <option value="pengeluaran">Pengeluaran</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Urutkan</label>
            <select
              name="sort"
              defaultValue={sort}
              className="h-9 w-full rounded-lg border bg-background px-2 text-sm outline-none"
            >
              <option value="date">Tanggal</option>
              <option value="project_name">Proyek (A-Z)</option>
              <option value="amount">Jumlah</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Arah</label>
            <select
              name="dir"
              defaultValue={dir}
              className="h-9 w-full rounded-lg border bg-background px-2 text-sm outline-none"
            >
              <option value="desc">Terbaru</option>
              <option value="asc">Terlama</option>
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

      <CashflowManager
        rows={rows}
        isAdmin={profile.role === 'admin'}
        managedProject={managed}
      />
    </div>
  );
}
