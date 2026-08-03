import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getManagedProject } from '@/lib/projects';
import { RequestsBoard } from '@/components/admin/requests-board';
import type { RequestJoined } from '@/lib/types';

export default async function AdminRequestsPage() {
  const profile = await requireRole(['admin', 'bos']);
  const supabase = await createClient();
  const managed = await getManagedProject();

  let query = supabase
    .from('material_requests')
    .select(
      'id, project_name, requester_id, requester_name, material_name, requested_qty, notes, status, is_flagged_duplicate, created_at'
    )
    .order('created_at', { ascending: false });
  if (managed) query = query.eq('project_name', managed);
  const { data } = await query;

  const rows = data ?? [];

  const requesterIds = Array.from(
    new Set(
      rows.map((r) => (r as { requester_id: string | null }).requester_id).filter(Boolean) as string[]
    )
  );
  const { data: profiles } = requesterIds.length
    ? await supabase
        .from('users_profile')
        .select('user_id, full_name')
        .in('user_id', requesterIds)
    : { data: [] };
  const nameMap = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p.full_name as string])
  );

  const joined: RequestJoined[] = rows.map((r) => {
    const row = r as unknown as {
      id: string;
      project_name: string;
      requester_id: string | null;
      requester_name: string | null;
      material_name: string;
      requested_qty: string;
      notes: string | null;
      status: RequestJoined['status'];
      is_flagged_duplicate: boolean;
      created_at: string;
    };
    return {
      id: row.id,
      project_name: row.project_name,
      requester_id: row.requester_id,
      material_name: row.material_name,
      requested_qty: row.requested_qty,
      notes: row.notes,
      status: row.status,
      is_flagged_duplicate: row.is_flagged_duplicate,
      created_at: row.created_at,
      requester_name:
        row.requester_name?.trim() ||
        (row.requester_id ? nameMap.get(row.requester_id) ?? 'Pengguna' : 'Tanpa nama'),
    };
  });

  return <RequestsBoard initialRequests={joined} isAdmin={profile.role === 'admin'} />;
}
