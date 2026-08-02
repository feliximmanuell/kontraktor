'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { createPurchase } from '@/lib/actions/purchases';
import { ReceiptStatusBadge } from '@/components/status-badges';
import { UploadReceiptDialog } from '@/components/admin/upload-receipt-dialog';
import { EmptyState } from '@/components/empty-state';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PurchaseJoined } from '@/lib/types';
import { formatIDR, formatDateTime } from '@/lib/format';

interface ApprovedRequestOption {
  id: string;
  project_id: string;
  material_id: string | null;
  requested_qty: number;
  material: string;
  unit: string;
  project: string;
}

interface ProjectOption {
  id: string;
  name: string;
}
interface MaterialOption {
  id: string;
  name: string;
  unit: string;
}

const schema = z.object({
  mode: z.enum(['request', 'manual']),
  requestId: z.string(),
  projectId: z.string().min(1, 'Pilih proyek'),
  materialId: z.string().min(1, 'Pilih material'),
  qty: z.number().min(0.01, 'Jumlah harus lebih dari 0'),
  unitPrice: z.number().min(0, 'Harga tidak boleh negatif'),
  storeName: z.string().min(1, 'Nama toko wajib diisi'),
});

type FormValues = z.infer<typeof schema>;

export function PurchaseManager({
  requests,
  purchases,
  projects,
  materials,
  isAdmin,
}: {
  requests: ApprovedRequestOption[];
  purchases: PurchaseJoined[];
  projects: ProjectOption[];
  materials: MaterialOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: 'request',
      requestId: '',
      projectId: '',
      materialId: '',
      qty: undefined,
      unitPrice: undefined,
      storeName: '',
    },
  });

  const mode = useWatch({ control, name: 'mode' });
  const requestId = useWatch({ control, name: 'requestId' });

  const selectedRequest = requests.find((r) => r.id === requestId);
  const lockMaterial = mode === 'request' && !!selectedRequest?.material_id;

  useEffect(() => {
    if (mode === 'request' && requestId) {
      const req = requests.find((r) => r.id === requestId);
      if (req) {
        setValue('projectId', req.project_id, { shouldValidate: true });
        setValue('materialId', req.material_id ?? '', { shouldValidate: true });
        setValue('qty', req.requested_qty, { shouldValidate: true });
      }
    }
    if (mode === 'manual') {
      setValue('requestId', '');
    }
  }, [mode, requestId, requests, setValue]);

  async function onSubmit(values: FormValues) {
    setBusy(true);
    const formData = new FormData();
    formData.set('requestId', values.mode === 'request' ? values.requestId : '');
    formData.set('projectId', values.projectId);
    formData.set('materialId', values.materialId);
    formData.set('storeName', values.storeName);
    formData.set('qty', String(values.qty));
    formData.set('unitPrice', String(values.unitPrice));
    if (receiptFile) formData.set('receipt', receiptFile);

    const res = await createPurchase(formData);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Pembelian dicatat. Stok proyek otomatis bertambah.');
    reset({ mode: 'request', requestId: '', projectId: '', materialId: '', qty: undefined, unitPrice: undefined, storeName: '' });
    setReceiptFile(null);
    router.refresh();
  }

  const receiptFilters = [
    { value: 'all' as const, label: 'Semua' },
    { value: 'pending' as const, label: 'Bon Belum Diterima' },
    { value: 'received' as const, label: 'Bon Sudah Diterima' },
  ];
  const [receiptFilter, setReceiptFilter] =
    useState<(typeof receiptFilters)[number]['value']>('all');

  const filteredPurchases = purchases.filter((p) =>
    receiptFilter === 'all' ? true : p.receipt_status === receiptFilter
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Manajemen Pembelian</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catat pembelian material, unggah bon, dan pantau status bon/nota.
        </p>
      </div>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Catat Pembelian Baru</CardTitle>
            <CardDescription>
              Pilih pengajuan yang disetujui, atau catat manual dari pembelian toko.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={mode === 'request' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setValue('mode', 'request')}
                >
                  Dari Pengajuan
                </Button>
                <Button
                  type="button"
                  variant={mode === 'manual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setValue('mode', 'manual')}
                >
                  Catat Manual
                </Button>
              </div>

              {mode === 'request' ? (
                <div className="space-y-2">
                  <Label>Pilih Pengajuan (Disetujui)</Label>
                  <Controller
                    control={control}
                    name="requestId"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="-- Pilih Pengajuan --" />
                        </SelectTrigger>
                        <SelectContent>
                          {requests.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              Tidak ada pengajuan disetujui yang belum dibeli
                            </div>
                          ) : (
                            requests.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.material} ({r.requested_qty} {r.unit}) - {r.project}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Proyek</Label>
                  <Controller
                    control={control}
                    name="projectId"
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                        disabled={mode === 'request'}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="-- Pilih Proyek --" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.projectId ? (
                    <p className="text-xs text-destructive">{errors.projectId.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Material</Label>
                  <Controller
                    control={control}
                    name="materialId"
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                        disabled={lockMaterial}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="-- Pilih Material --" />
                        </SelectTrigger>
                        <SelectContent>
                          {materials.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name} ({m.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.materialId ? (
                    <p className="text-xs text-destructive">{errors.materialId.message}</p>
                  ) : null}
                  {mode === 'request' && selectedRequest && !selectedRequest.material_id ? (
                    <p className="text-xs text-muted-foreground">
                      Pengajuan ini tidak terhubung ke material master — pilih material yang sesuai.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="storeName">Nama Toko</Label>
                  <Input
                    id="storeName"
                    placeholder="Cth: TB Bangun Jaya"
                    {...register('storeName')}
                  />
                  {errors.storeName ? (
                    <p className="text-xs text-destructive">{errors.storeName.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qty">Jumlah ({mode === 'request' ? 'dari pengajuan' : 'Qty'})</Label>
                  <Input
                    id="qty"
                    type="number"
                    step="any"
                    min="0"
                    disabled={mode === 'request'}
                    {...register('qty', { valueAsNumber: true })}
                  />
                  {errors.qty ? (
                    <p className="text-xs text-destructive">{errors.qty.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unitPrice">Harga Satuan (Rp)</Label>
                  <Input
                    id="unitPrice"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="50000"
                    {...register('unitPrice', { valueAsNumber: true })}
                  />
                  {errors.unitPrice ? (
                    <p className="text-xs text-destructive">{errors.unitPrice.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receipt">Foto Bon / Nota (opsional)</Label>
                <Input
                  id="receipt"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  {receiptFile
                    ? `File terpilih: ${receiptFile.name}`
                    : 'Jika bon belum ada, biarkan kosong.'}
                </p>
              </div>

              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Save />}
                {busy ? 'Menyimpan & Uploading...' : 'Simpan Pembelian'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Anda masuk sebagai Bos (read-only). Tidak dapat menginput pembelian.
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Daftar Pembelian</h2>
          <div className="flex rounded-lg border bg-card p-1">
            {receiptFilters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setReceiptFilter(f.value)}
                className={cn(
                  'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                  receiptFilter === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredPurchases.length === 0 ? (
          <EmptyState title="Tidak ada pembelian" />
        ) : (
          <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Proyek</th>
                  <th className="px-4 py-3 font-medium">Material</th>
                  <th className="px-4 py-3 font-medium">Toko</th>
                  <th className="px-4 py-3 text-right font-medium">Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Bon</th>
                  <th className="px-4 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDateTime(p.purchased_at)}
                    </td>
                    <td className="px-4 py-3 font-medium">{p.projects?.name}</td>
                    <td className="px-4 py-3">
                      {p.materials?.name} ({p.qty} {p.materials?.unit})
                    </td>
                    <td className="px-4 py-3">{p.store_name}</td>
                    <td className="px-4 py-3 text-right">{p.qty}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatIDR(p.total_price)}
                    </td>
                    <td className="px-4 py-3">
                      <ReceiptStatusBadge status={p.receipt_status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.receipt_url ? (
                          <a
                            href={p.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-blue-600 hover:bg-muted"
                          >
                            <UploadCloud className="size-3.5" />
                            Lihat Bon
                          </a>
                        ) : null}
                        {p.receipt_status === 'pending' && isAdmin ? (
                          <UploadReceiptDialog purchaseId={p.id} />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
