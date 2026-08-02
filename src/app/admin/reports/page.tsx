import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { formatIDR, formatDateTime } from '@/lib/format';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const SORTS = ['paid_at', 'project_name', 'material_name'] as const;
type SortCol = (typeof SORTS)[number];

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(['admin', 'bos']);
  const sp = await searchParams;
  const project = sp.project?.trim() ?? '';
  const material = sp.material?.trim() ?? '';
  const from = sp.from ?? '';
  const to = sp.to ?? '';
  const type = sp.type ?? '';
  const sort = (SORTS as readonly string[]).includes(sp.sort ?? '') ? (sp.sort as SortCol) : 'paid_at';
  const dir = sp.dir === 'asc' ? 'asc' : 'desc';

  const supabase = await createClient();

  let query = supabase
    .from('payments')
    .select('id, payment_type, description, project_name, material_name, amount, paid_at, paid_by');

  if (project) query = query.ilike('project_name', `%${project}%`);
  if (material) query = query.ilike('material_name', `%${material}%`);
  if (from) query = query.gte('paid_at', `${from}T00:00:00`);
  if (to) query = query.lte('paid_at', `${to}T23:59:59`);
  if (type === 'purchase' || type === 'manual') query = query.eq('payment_type', type);

  query = query.order(sort, { ascending: dir === 'asc' });

  const { data } = await query;
  const rows = (data ?? []) as unknown as {
    id: string;
    payment_type: 'purchase' | 'manual';
    description: string;
    project_name: string;
    material_name: string | null;
    amount: number;
    paid_at: string;
    paid_by: string | null;
  }[];

  const total = rows.reduce((acc, r) => acc + Number(r.amount ?? 0), 0);
  const totalPurchase = rows
    .filter((r) => r.payment_type === 'purchase')
    .reduce((acc, r) => acc + Number(r.amount ?? 0), 0);
  const totalManual = rows
    .filter((r) => r.payment_type === 'manual')
    .reduce((acc, r) => acc + Number(r.amount ?? 0), 0);

  function hrefFor(col: SortCol) {
    const p = new URLSearchParams();
    if (project) p.set('project', project);
    if (material) p.set('material', material);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (type) p.set('type', type);
    p.set('sort', col);
    p.set('dir', sort === col && dir === 'asc' ? 'desc' : 'asc');
    return `?${p.toString()}`;
  }

  function sortLink(col: SortCol, children: React.ReactNode) {
    const active = sort === col;
    return (
      <a
        href={hrefFor(col)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${
          active ? 'text-foreground' : ''
        }`}
      >
        {children}
        {active ? (
          dir === 'asc' ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : (
          <ArrowUpDown className="size-3.5 opacity-40" />
        )}
      </a>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Pengeluaran"
        description="Filter dan urutkan pengeluaran berdasarkan proyek, material, atau tanggal."
      />

      <form
        method="get"
        className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1 lg:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Proyek</label>
            <input
              name="project"
              defaultValue={project}
              placeholder="Cth: Rumah Pak Haji Jamil"
              className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
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

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs font-medium text-muted-foreground">Total Pengeluaran</p>
          <p className="text-lg font-semibold">{formatIDR(total)}</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs font-medium text-muted-foreground">Pembelian</p>
          <p className="text-lg font-semibold">{formatIDR(totalPurchase)}</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs font-medium text-muted-foreground">Manual</p>
          <p className="text-lg font-semibold">{formatIDR(totalManual)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Tidak ada data" description="Sesuaikan filter atau catat pengeluaran terlebih dahulu." />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">
                  {sortLink('paid_at', 'Tanggal')}
                </th>
                <th className="px-4 py-3 font-medium">
                  {sortLink('project_name', 'Proyek')}
                </th>
                <th className="px-4 py-3 font-medium">
                  {sortLink('material_name', 'Material')}
                </th>
                <th className="px-4 py-3 font-medium">Keterangan</th>
                <th className="px-4 py-3 font-medium">Tipe</th>
                <th className="px-4 py-3 text-right font-medium">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDateTime(r.paid_at)}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.project_name}</td>
                  <td className="px-4 py-3">{r.material_name ?? '-'}</td>
                  <td className="px-4 py-3">{r.description}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                        r.payment_type === 'purchase'
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-purple-300 bg-purple-50 text-purple-700'
                      }`}
                    >
                      {r.payment_type === 'purchase' ? 'Pembelian' : 'Manual'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatIDR(r.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
