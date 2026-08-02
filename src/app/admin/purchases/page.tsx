import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getManagedProject } from '@/lib/projects';
import { PurchaseManager } from '@/components/admin/purchase-manager';
import type { PurchaseJoined } from '@/lib/types';

export default async function AdminPurchasesPage() {
  const profile = await requireRole(['admin', 'bos']);
  const supabase = await createClient();
  const isAdmin = profile.role === 'admin';
  const managed = await getManagedProject();

  let purchasesQ = supabase
    .from('purchases')
    .select(
      'id, request_id, project_name, material_name, store_name, qty, total_price, paid, receipt_status, receipt_image_url, purchased_by, purchased_at'
    )
    .order('purchased_at', { ascending: false });
  let approvedQ = supabase
    .from('material_requests')
    .select('id, project_name, material_name, requested_qty, status')
    .eq('status', 'approved');
  if (managed) {
    purchasesQ = purchasesQ.eq('project_name', managed);
    approvedQ = approvedQ.eq('project_name', managed);
  }

  const [{ data: purchases }, { data: approved }] = await Promise.all([
    purchasesQ,
    approvedQ,
  ]);

  // Pengajuan disetujui yang belum memiliki catatan pembelian (cegah double buying).
  const purchasedRequestIds = new Set(
    (purchases ?? [])
      .map((p) => (p as { request_id: string | null }).request_id)
      .filter(Boolean)
  );
  const requestOptions = (approved ?? [])
    .filter((r) => !purchasedRequestIds.has(r.id))
    .map((r) => {
      const row = r as unknown as {
        id: string;
        project_name: string;
        material_name: string;
        requested_qty: string;
      };
      return {
        id: row.id,
        project_name: row.project_name,
        material_name: row.material_name,
        requested_qty: row.requested_qty,
      };
    });

  const purchaserIds = Array.from(
    new Set(
      (purchases ?? [])
        .map((p) => (p as { purchased_by: string | null }).purchased_by)
        .filter(Boolean) as string[]
    )
  );
  const { data: profiles } = purchaserIds.length
    ? await supabase
        .from('users_profile')
        .select('user_id, full_name')
        .in('user_id', purchaserIds)
    : { data: [] };
  const nameMap = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p.full_name as string])
  );

  const purchaseRows: PurchaseJoined[] = await Promise.all(
    (purchases ?? []).map(async (p) => {
      const row = p as unknown as {
        id: string;
        request_id: string | null;
        project_name: string;
        material_name: string;
        store_name: string;
        qty: string;
        total_price: number;
        paid: boolean;
        receipt_status: PurchaseJoined['receipt_status'];
        receipt_image_url: string | null;
        purchased_by: string | null;
        purchased_at: string;
      };
      let receiptUrl: string | null = null;
      if (row.receipt_image_url) {
        const { data: signed } = await supabase.storage
          .from('receipts')
          .createSignedUrl(row.receipt_image_url, 3600);
        receiptUrl = signed?.signedUrl ?? null;
      }
      return {
        ...row,
        receipt_url: receiptUrl,
        purchased_by_name: nameMap.get(row.purchased_by ?? '') ?? '-',
      };
    })
  );

  return (
    <PurchaseManager
      requests={requestOptions}
      purchases={purchaseRows}
      isAdmin={isAdmin}
      managedProject={managed}
    />
  );
}
