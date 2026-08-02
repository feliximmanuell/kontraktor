import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getManagedProject } from '@/lib/projects';
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

export default async function AdminCashflowPage() {
  const profile = await requireRole(['admin', 'bos']);
  const supabase = await createClient();
  const managed = await getManagedProject();

  let incomeQ = supabase
    .from('cashflow')
    .select('id, description, project_name, amount, entry_date, created_by');
  let expenseQ = supabase
    .from('payments')
    .select('id, description, project_name, amount, paid_at, paid_by');
  if (managed) {
    incomeQ = incomeQ.eq('project_name', managed);
    expenseQ = expenseQ.eq('project_name', managed);
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
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <CashflowManager
      rows={rows}
      isAdmin={profile.role === 'admin'}
      managedProject={managed}
    />
  );
}
