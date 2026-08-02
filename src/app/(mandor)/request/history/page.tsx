import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { RequestStatusBadge } from '@/components/status-badges';
import { EmptyState } from '@/components/empty-state';
import { formatDateTime } from '@/lib/format';
import { AlertTriangle, Info } from 'lucide-react';

export default async function RequestHistoryPage() {
  const profile = await requireRole(['tukang']);
  const supabase = await createClient();

  const { data } = await supabase
    .from('material_requests')
    .select(
      'id, requested_qty, notes, status, is_flagged_duplicate, created_at, projects(name), materials(name, unit)'
    )
    .eq('requester_id', profile.user_id)
    .order('created_at', { ascending: false });

  const requests = data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Riwayat Pengajuan</h1>
        <p className="text-sm text-muted-foreground">
          Status pengajuan material yang Anda kirim.
        </p>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="Belum ada pengajuan"
          description="Ajukan kebutuhan material melalui menu Minta Material."
        />
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const reqAny = req as unknown as {
              id: string;
              requested_qty: number;
              notes: string | null;
              status: 'pending' | 'approved' | 'rejected';
              is_flagged_duplicate: boolean;
              created_at: string;
              projects: { name: string } | null;
              materials: { name: string; unit: string } | null;
            };
            return (
              <div
                key={reqAny.id}
                className="rounded-xl border bg-card p-4 shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <RequestStatusBadge status={reqAny.status} />
                  {reqAny.is_flagged_duplicate ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      <AlertTriangle className="size-3" />
                      Ada sisa stok di proyek
                    </span>
                  ) : null}
                </div>
                <p className="text-base font-semibold">
                  {reqAny.materials?.name}{' '}
                  <span className="font-normal text-muted-foreground">
                    ({reqAny.requested_qty} {reqAny.materials?.unit})
                  </span>
                </p>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <Info className="size-3.5" />
                  {reqAny.projects?.name}
                </p>
                {reqAny.notes ? (
                  <p className="mt-1 text-sm text-muted-foreground">{reqAny.notes}</p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDateTime(reqAny.created_at)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
