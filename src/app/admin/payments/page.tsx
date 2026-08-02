import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getManagedProject } from '@/lib/projects';
import { PaymentsManager } from '@/components/admin/payments-manager';
import type { PaymentJoined, UnpaidPurchase } from '@/lib/types';

export default async function AdminPaymentsPage() {
  const profile = await requireRole(['admin', 'bos']);
  const supabase = await createClient();
  const managed = await getManagedProject();

  let unpaidQ = supabase
    .from('purchases')
    .select(
      'id, purchase_group, project_name, material_name, store_name, qty, total_price, purchased_at'
    )
    .eq('paid', false)
    .order('purchased_at', { ascending: false });
  let paymentsQ = supabase
    .from('payments')
    .select('id, payment_type, purchase_id, description, project_name, material_name, amount, paid_at, paid_by')
    .order('paid_at', { ascending: false })
    .limit(50);
  if (managed) {
    unpaidQ = unpaidQ.eq('project_name', managed);
    paymentsQ = paymentsQ.eq('project_name', managed);
  }

  const [{ data: unpaid }, { data: payments }] = await Promise.all([unpaidQ, paymentsQ]);

  const payerIds = Array.from(
    new Set(
      (payments ?? [])
        .map((p) => (p as { paid_by: string | null }).paid_by)
        .filter(Boolean) as string[]
    )
  );
  const { data: profiles } = payerIds.length
    ? await supabase.from('users_profile').select('user_id, full_name').in('user_id', payerIds)
    : { data: [] };
  const nameMap = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p.full_name as string])
  );

  const paymentRows: PaymentJoined[] = (payments ?? []).map((p) => {
    const row = p as unknown as {
      id: string;
      payment_type: 'purchase' | 'manual';
      purchase_id: string | null;
      description: string;
      project_name: string;
      material_name: string | null;
      amount: number;
      paid_at: string;
      paid_by: string | null;
      created_at: string;
    };
    return { ...row, paid_by_name: nameMap.get(row.paid_by ?? '') ?? '-' };
  });

  return (
    <PaymentsManager
      unpaid={(unpaid ?? []) as unknown as UnpaidPurchase[]}
      payments={paymentRows}
      isAdmin={profile.role === 'admin'}
      managedProject={managed}
    />
  );
}
