import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { RequestsBoard } from '@/components/admin/requests-board';
import type { RequestJoined } from '@/lib/types';

export default async function AdminRequestsPage() {
  const profile = await requireRole(['admin', 'bos']);
  const supabase = await createClient();

  const { data } = await supabase
    .from('material_requests')
    .select(
      'id, project_id, requester_id, material_id, requested_qty, notes, status, is_flagged_duplicate, created_at, projects(name, location), materials(name, unit)'
    )
    .order('created_at', { ascending: false });

  const rows = data ?? [];

  const requesterIds = Array.from(new Set(rows.map((r) => r.requester_id)));
  const { data: profiles } = requesterIds.length
    ? await supabase
        .from('users_profile')
        .select('user_id, full_name')
        .in('user_id', requesterIds)
    : { data: [] };
  const nameMap = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p.full_name as string])
  );

  const { data: stocks } = await supabase
    .from('project_stocks')
    .select('project_id, material_id, current_stock');
  const stockMap = new Map(
    (stocks ?? []).map((s) => [
      `${(s as { project_id: string }).project_id}:${(s as { material_id: string }).material_id}`,
      Number((s as { current_stock: number }).current_stock ?? 0),
    ])
  );

  const joined: RequestJoined[] = rows.map((r) => {
    const row = r as unknown as {
      id: string;
      project_id: string;
      requester_id: string;
      material_id: string;
      requested_qty: number;
      notes: string | null;
      status: RequestJoined['status'];
      is_flagged_duplicate: boolean;
      created_at: string;
      projects: { name: string; location: string | null } | null;
      materials: { name: string; unit: string } | null;
    };
    return {
      id: row.id,
      project_id: row.project_id,
      requester_id: row.requester_id,
      material_id: row.material_id,
      requested_qty: row.requested_qty,
      notes: row.notes,
      status: row.status,
      is_flagged_duplicate: row.is_flagged_duplicate,
      created_at: row.created_at,
      projects: row.projects,
      materials: row.materials,
      requester_name: nameMap.get(row.requester_id) ?? 'Pengguna',
      current_stock: stockMap.get(`${row.project_id}:${row.material_id}`) ?? 0,
    };
  });

  return <RequestsBoard initialRequests={joined} isAdmin={profile.role === 'admin'} />;
}
