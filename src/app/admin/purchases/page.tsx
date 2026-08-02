import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PurchaseManager } from '@/components/admin/purchase-manager';
import type { PurchaseJoined } from '@/lib/types';

export default async function AdminPurchasesPage() {
  const profile = await requireRole(['admin', 'bos']);
  const supabase = await createClient();
  const isAdmin = profile.role === 'admin';

  const [{ data: purchases }, { data: approved }, { data: projects }, { data: materials }] =
    await Promise.all([
      supabase
        .from('purchases')
        .select(
          'id, request_id, project_id, material_id, store_name, qty, unit_price, total_price, receipt_status, receipt_image_url, purchased_by, purchased_at, projects(name, location), materials(name, unit)'
        )
        .order('purchased_at', { ascending: false }),
      supabase
        .from('material_requests')
        .select(
          'id, project_id, material_id, requested_qty, status, projects(name), materials(name, unit)'
        )
        .eq('status', 'approved'),
      supabase.from('projects').select('id, name').eq('status', 'active').order('name'),
      supabase.from('materials').select('id, name, unit').order('name'),
    ]);

  // Pengajuan disetujui yang belum memiliki catatan pembelian (cegah double buying).
  const purchasedRequestIds = new Set(
    (purchases ?? []).map((p) => (p as { request_id: string | null }).request_id).filter(Boolean)
  );
  const requestOptions = (approved ?? [])
    .filter((r) => !purchasedRequestIds.has(r.id))
    .map((r) => {
      const row = r as unknown as {
        id: string;
        project_id: string;
        material_id: string;
        requested_qty: number;
        projects: { name: string } | null;
        materials: { name: string; unit: string } | null;
      };
      return {
        id: row.id,
        project_id: row.project_id,
        material_id: row.material_id,
        requested_qty: row.requested_qty,
        material: row.materials?.name ?? '',
        unit: row.materials?.unit ?? '',
        project: row.projects?.name ?? '',
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

  const purchaseRows: PurchaseJoined[] = [];
  for (const p of purchases ?? []) {
    const row = p as unknown as {
      id: string;
      request_id: string | null;
      project_id: string;
      material_id: string;
      store_name: string;
      qty: number;
      unit_price: number;
      total_price: number;
      receipt_status: PurchaseJoined['receipt_status'];
      receipt_image_url: string | null;
      purchased_by: string | null;
      purchased_at: string;
      projects: { name: string; location: string | null } | null;
      materials: { name: string; unit: string } | null;
    };
    let receiptUrl: string | null = null;
    if (row.receipt_image_url) {
      const { data: signed } = await supabase.storage
        .from('receipts')
        .createSignedUrl(row.receipt_image_url, 3600);
      receiptUrl = signed?.signedUrl ?? null;
    }
    purchaseRows.push({
      ...row,
      receipt_url: receiptUrl,
      purchased_by_name: nameMap.get(row.purchased_by ?? '') ?? '-',
    });
  }

  return (
    <PurchaseManager
      requests={requestOptions}
      purchases={purchaseRows}
      projects={(projects ?? []) as { id: string; name: string }[]}
      materials={(materials ?? []) as { id: string; name: string; unit: string }[]}
      isAdmin={isAdmin}
    />
  );
}
