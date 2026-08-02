import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getManagedProject } from '@/lib/projects';
import { UsageManager } from '@/components/admin/usage-manager';
import type { UsageJoined } from '@/lib/types';

export default async function AdminUsagePage() {
  const profile = await requireRole(['admin', 'bos']);
  const supabase = await createClient();
  const managed = await getManagedProject();

  let query = supabase
    .from('material_usages')
    .select('id, project_name, material_name, qty_used, used_for, logged_by, used_at')
    .order('used_at', { ascending: false });
  if (managed) query = query.eq('project_name', managed);
  const { data: usages } = await query;

  const loggedByIds = Array.from(
    new Set(
      (usages ?? [])
        .map((u) => (u as { logged_by: string | null }).logged_by)
        .filter(Boolean) as string[]
    )
  );
  const { data: profiles } = loggedByIds.length
    ? await supabase.from('users_profile').select('user_id, full_name').in('user_id', loggedByIds)
    : { data: [] };
  const nameMap = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p.full_name as string])
  );

  const usageRows: UsageJoined[] = (usages ?? []).map((u) => {
    const row = u as unknown as {
      id: string;
      project_name: string;
      material_name: string;
      qty_used: string;
      used_for: string;
      logged_by: string | null;
      used_at: string;
    };
    return {
      ...row,
      logged_by_name: nameMap.get(row.logged_by ?? '') ?? '-',
    };
  });

  return <UsageManager usages={usageRows} isAdmin={profile.role === 'admin'} managedProject={managed} />;
}
