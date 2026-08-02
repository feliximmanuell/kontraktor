import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { UsageManager } from '@/components/admin/usage-manager';
import type { UsageJoined } from '@/lib/types';

export default async function AdminUsagePage() {
  const profile = await requireRole(['admin', 'bos']);
  const supabase = await createClient();

  const [{ data: usages }, { data: projects }, { data: materials }] = await Promise.all([
    supabase
      .from('material_usages')
      .select(
        'id, project_id, material_id, qty_used, used_for, logged_by, used_at, projects(name, location), materials(name, unit)'
      )
      .order('used_at', { ascending: false }),
    supabase.from('projects').select('id, name, status').order('name'),
    supabase.from('materials').select('id, name, unit').order('name'),
  ]);

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
      project_id: string;
      material_id: string;
      qty_used: number;
      used_for: string;
      logged_by: string | null;
      used_at: string;
      projects: { name: string; location: string | null } | null;
      materials: { name: string; unit: string } | null;
    };
    return {
      ...row,
      logged_by_name: nameMap.get(row.logged_by ?? '') ?? '-',
    };
  });

  return (
    <UsageManager
      projects={(projects ?? []) as { id: string; name: string }[]}
      materials={(materials ?? []) as { id: string; name: string; unit: string }[]}
      usages={usageRows}
      isAdmin={profile.role === 'admin'}
    />
  );
}
