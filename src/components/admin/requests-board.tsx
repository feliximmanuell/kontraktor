'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { setRequestStatus } from '@/lib/actions/requests';
import { RequestStatusBadge } from '@/components/status-badges';
import { StockAlertBadge } from '@/components/stock-alert-badge';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2 } from 'lucide-react';
import type { RequestJoined } from '@/lib/types';
import { formatDateTime } from '@/lib/format';

type Tab = 'pending' | 'approved' | 'rejected' | 'all';

export function RequestsBoard({
  initialRequests,
  isAdmin,
}: {
  initialRequests: RequestJoined[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleStatus(id: string, status: 'approved' | 'rejected') {
    setBusyId(id);
    const res = await setRequestStatus(id, status);
    setBusyId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(status === 'approved' ? 'Pengajuan disetujui' : 'Pengajuan ditolak');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verifikasi Pengajuan"
        description="Setujui atau tolak pengajuan material dari tukang."
      />

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Menunggu</TabsTrigger>
          <TabsTrigger value="approved">Disetujui</TabsTrigger>
          <TabsTrigger value="rejected">Ditolak</TabsTrigger>
          <TabsTrigger value="all">Semua</TabsTrigger>
        </TabsList>

        {(['pending', 'approved', 'rejected', 'all'] as Tab[]).map((tab) => {
          const rows = initialRequests.filter((r) =>
            tab === 'all' ? true : r.status === tab
          );
          return (
            <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
              {rows.length === 0 ? (
                <EmptyState title="Tidak ada pengajuan" />
              ) : (
                rows.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <RequestStatusBadge status={req.status} />
                      {req.is_flagged_duplicate ? (
                        <StockAlertBadge
                          currentStock={req.current_stock}
                          unit={req.materials?.unit ?? ''}
                        />
                      ) : null}
                    </div>
                    <p className="font-semibold">
                      {req.materials?.name}{' '}
                      <span className="font-normal text-muted-foreground">
                        ({req.requested_qty} {req.materials?.unit})
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Proyek: <span className="font-medium">{req.projects?.name}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Diminta oleh: <span className="font-medium">{req.requester_name}</span>
                    </p>
                    {req.notes ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Catatan: {req.notes}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(req.created_at)}
                    </p>

                    {req.status === 'pending' && isAdmin ? (
                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleStatus(req.id, 'rejected')}
                          disabled={busyId === req.id}
                        >
                          {busyId === req.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <X />
                          )}
                          Tolak
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleStatus(req.id, 'approved')}
                          disabled={busyId === req.id}
                        >
                          {busyId === req.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Check />
                          )}
                          Setujui
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
