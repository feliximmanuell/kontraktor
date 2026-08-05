'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { createPurchase, deletePurchase, updatePurchase } from '@/lib/actions/purchases';
import { ReceiptStatusBadge } from '@/components/status-badges';
import { UploadReceiptDialog } from '@/components/admin/upload-receipt-dialog';
import { MaterialAutocomplete } from '@/components/material-autocomplete';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Plus, Save, Trash2, UploadCloud, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computePurchaseTotal } from '@/lib/utils';
import type { PurchaseJoined } from '@/lib/types';
import { formatIDR, formatDateTime } from '@/lib/format';
interface ApprovedRequestOption {
  id: string;
  project_name: string;
  material_name: string;
  requested_qty: string;
  unit: string;
}

const schema = z.object({
  mode: z.enum(['request', 'manual']),
  requestId: z.string(),
  projectName: z.string().min(1, 'Nama proyek wajib diisi'),
  storeName: z.string().min(1, 'Nama toko wajib diisi'),
  items: z
    .array(
      z.object({
        materialName: z.string().min(1, 'Nama material wajib diisi'),
        qty: z.string().min(1, 'Jumlah wajib diisi'),
        unit: z.string().min(1, 'Satuan wajib diisi'),
        unitPrice: z.number().min(0, 'Harga satuan tidak boleh negatif'),
        discountPercent: z.string().optional(),
      })
    )
    .min(1, 'Minimal satu barang'),
});

type FormValues = z.infer<typeof schema>;

export function PurchaseManager({
  requests,
  purchases,
  isAdmin,
  managedProject,
}: {
  requests: ApprovedRequestOption[];
  purchases: PurchaseJoined[];
  isAdmin: boolean;
  managedProject: string | null;
}) {
  const router = useRouter();
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseJoined | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [editTarget, setEditTarget] = useState<PurchaseJoined | null>(null);
  const [editForm, setEditForm] = useState({
    projectName: '',
    storeName: '',
    materialName: '',
    qty: '',
    unit: '',
    unitPrice: '',
    discountPercent: '',
    purchasedAt: '',
  });
  const [editBusy, setEditBusy] = useState(false);

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
      projectName: '',
      storeName: '',
      items: [
        {
          materialName: '',
          qty: '',
          unit: '',
          unitPrice: undefined as unknown as number,
          discountPercent: '',
        },
      ],
    },
  });

  useEffect(() => {
    if (managedProject) setValue('projectName', managedProject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managedProject]);

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const mode = useWatch({ control, name: 'mode' });
  const requestId = useWatch({ control, name: 'requestId' });
  const itemsWatch = useWatch({ control, name: 'items' });

  const selectedRequest = requests.find((r) => r.id === requestId);

  function itemTotal(i: number): { subtotal: number; discount: number; total: number } {
    const it = itemsWatch?.[i];
    if (!it) return { subtotal: 0, discount: 0, total: 0 };
    const subtotal = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
    const total = computePurchaseTotal(
      Number(it.qty) || 0,
      Number(it.unitPrice) || 0,
      Number(it.discountPercent) || 0
    );
    return { subtotal, discount: subtotal - total, total };
  }

  function fillFromRequest() {
    if (mode === 'request' && selectedRequest) {
      setValue('projectName', selectedRequest.project_name);
      setValue('items.0.materialName', selectedRequest.material_name);
      setValue('items.0.qty', selectedRequest.requested_qty);
      setValue('items.0.unit', selectedRequest.unit);
    }
  }

  async function onSubmit(values: FormValues) {
    setBusy(true);
    const formData = new FormData();
    formData.set('requestId', values.mode === 'request' ? values.requestId : '');
    formData.set('projectName', values.projectName);
    formData.set('storeName', values.storeName);
    values.items.forEach((it) => {
      formData.append('materialName', it.materialName);
      formData.append('qty', it.qty);
      formData.append('unit', it.unit);
      formData.append('unitPrice', String(it.unitPrice));
      formData.append('discountPercent', String(it.discountPercent ?? 0));
    });
    if (receiptFile) formData.set('receipt', receiptFile);

    const res = await createPurchase(formData);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Pembelian dicatat.');
    reset({
      mode: 'request',
      requestId: '',
      projectName: '',
      storeName: '',
      items: [
        {
          materialName: '',
          qty: '',
          unit: '',
          unitPrice: undefined as unknown as number,
          discountPercent: '',
        },
      ],
    });
    setReceiptFile(null);
    router.refresh();
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    const res = await deletePurchase(deleteTarget.id);
    setDeleteBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Pembelian dihapus. Stok otomatis dikurangi.');
    setDeleteTarget(null);
    router.refresh();
  }

  function openEdit(p: PurchaseJoined) {
    setEditTarget(p);
    setEditForm({
      projectName: managedProject ?? p.project_name,
      storeName: p.store_name,
      materialName: p.material_name,
      qty: p.qty,
      unit: p.unit,
      unitPrice: String(p.unit_price),
      discountPercent: String(p.discount_percent),
      purchasedAt: p.purchased_at.slice(0, 10),
    });
  }

  async function confirmEdit() {
    if (!editTarget) return;
    const projectName = editForm.projectName.trim();
    const storeName = editForm.storeName.trim();
    const materialName = editForm.materialName.trim();
    const qty = editForm.qty.trim();
    const unit = editForm.unit.trim();
    const unitPrice = Number(editForm.unitPrice);
    const discountPercent = Number(editForm.discountPercent || 0);
    if (
      !projectName ||
      !storeName ||
      !materialName ||
      !qty ||
      !unit ||
      !(unitPrice >= 0) ||
      !(discountPercent >= 0) ||
      discountPercent > 100 ||
      !editForm.purchasedAt
    ) {
      toast.error('Data pembelian tidak lengkap.');
      return;
    }
    setEditBusy(true);
    const res = await updatePurchase(editTarget.id, {
      project_name: projectName,
      store_name: storeName,
      material_name: materialName,
      qty,
      unit,
      unit_price: unitPrice,
      discount_percent: discountPercent,
      purchased_at: new Date(editForm.purchasedAt + 'T00:00:00').toISOString(),
    });
    setEditBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Pembelian diperbarui.');
    setEditTarget(null);
    router.refresh();
  }

  const receiptFilters = [
    { value: 'all' as const, label: 'Semua' },
    { value: 'pending' as const, label: 'Bon Belum Diterima' },
    { value: 'received' as const, label: 'Bon Sudah Diterima' },
  ];
  const [receiptFilter, setReceiptFilter] =
    useState<(typeof receiptFilters)[number]['value']>('all');

  const paymentFilters = [
    { value: 'all' as const, label: 'Semua' },
    { value: 'paid' as const, label: 'Sudah Dibayar' },
    { value: 'unpaid' as const, label: 'Belum Dibayar' },
  ];
  const [paymentFilter, setPaymentFilter] =
    useState<(typeof paymentFilters)[number]['value']>('all');

  const sortOptions = [
    { value: 'newest', label: 'Tanggal Terbaru' },
    { value: 'oldest', label: 'Tanggal Terlama' },
    { value: 'project_az', label: 'Proyek (A-Z)' },
    { value: 'project_za', label: 'Proyek (Z-A)' },
    { value: 'unpaid_first', label: 'Belum Dibayar Dulu' },
    { value: 'paid_first', label: 'Sudah Dibayar Dulu' },
  ];
  const [sortKey, setSortKey] = useState<string>('newest');

  const visiblePurchases = purchases.filter(
    (p) =>
      (receiptFilter === 'all' ? true : p.receipt_status === receiptFilter) &&
      (paymentFilter === 'all'
        ? true
        : paymentFilter === 'paid'
          ? p.paid
          : !p.paid)
  );

  const sortedPurchases = [...visiblePurchases].sort((a, b) => {
    switch (sortKey) {
      case 'oldest':
        return a.purchased_at.localeCompare(b.purchased_at);
      case 'project_az':
        return a.project_name.localeCompare(b.project_name);
      case 'project_za':
        return b.project_name.localeCompare(a.project_name);
      case 'unpaid_first':
        return Number(a.paid) - Number(b.paid) ||
          b.purchased_at.localeCompare(a.purchased_at);
      case 'paid_first':
        return Number(b.paid) - Number(a.paid) ||
          b.purchased_at.localeCompare(a.purchased_at);
      default:
        return b.purchased_at.localeCompare(a.purchased_at);
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Manajemen Pembelian</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catat pembelian material (bisa lebih dari satu barang), unggah bon, dan
          pantau status bon/nota.
        </p>
      </div>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Catat Pembelian Baru</CardTitle>
            <CardDescription>
              Pilih pengajuan yang disetujui (otomatis terisi), atau catat manual.
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
                  <div className="flex gap-2">
                    <Controller
                      control={control}
                      name="requestId"
                      render={({ field }) => (
                        <Select
                          onValueChange={(v) => {
                            field.onChange(v);
                            setTimeout(fillFromRequest, 0);
                          }}
                          value={field.value || undefined}
                        >
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
                                  {r.material_name} ({r.requested_qty} {r.unit}) - {r.project_name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={fillFromRequest}
                      disabled={!selectedRequest}
                    >
                      Isi
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="projectName">Nama Proyek</Label>
                  <Input
                    id="projectName"
                    placeholder="Cth: Rumah Pak Haji Jamil"
                    readOnly={!!managedProject}
                    className={managedProject ? 'opacity-70' : undefined}
                    {...register('projectName')}
                  />
                  {managedProject ? (
                    <p className="text-xs text-muted-foreground">
                      Terkunci ke proyek: {managedProject}
                    </p>
                  ) : null}
                  {errors.projectName ? (
                    <p className="text-xs text-destructive">{errors.projectName.message}</p>
                  ) : null}
                </div>
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
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Barang yang Dibeli</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({
                        materialName: '',
                        qty: '',
                        unit: '',
                        unitPrice: undefined as unknown as number,
                        discountPercent: '',
                      })
                    }
                  >
                    <Plus />
                    Tambah Barang
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="rounded-lg border p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">
                        Barang {index + 1}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive"
                        disabled={fields.length === 1}
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="space-y-1 sm:col-span-2">
                        <Controller
                          control={control}
                          name={`items.${index}.materialName`}
                          render={({ field }) => (
                            <MaterialAutocomplete
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Nama material"
                            />
                          )}
                        />
                        {errors.items?.[index]?.materialName ? (
                          <p className="text-xs text-destructive">
                            {errors.items[index].materialName.message}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Qty"
                          {...register(`items.${index}.qty` as const)}
                        />
                        {errors.items?.[index]?.qty ? (
                          <p className="text-xs text-destructive">
                            {errors.items[index].qty.message}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <Input
                          placeholder="Satuan (mis. sak)"
                          {...register(`items.${index}.unit` as const)}
                        />
                        {errors.items?.[index]?.unit ? (
                          <p className="text-xs text-destructive">
                            {errors.items[index].unit.message}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Harga satuan (Rp)"
                          {...register(`items.${index}.unitPrice` as const, { valueAsNumber: true })}
                        />
                        {errors.items?.[index]?.unitPrice ? (
                          <p className="text-xs text-destructive">
                            {errors.items[index].unitPrice.message}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          placeholder="Diskon % (opsional)"
                          {...register(`items.${index}.discountPercent` as const)}
                        />
                        {errors.items?.[index]?.discountPercent ? (
                          <p className="text-xs text-destructive">
                            {errors.items[index].discountPercent.message}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-md bg-muted/40 px-3 py-1.5 text-xs">
                      <span className="text-muted-foreground">
                        Subtotal: {formatIDR(itemTotal(index).subtotal)}
                        {itemTotal(index).discount > 0 ? (
                          <span className="text-destructive">
                            {' '}
                            − Diskon {formatIDR(itemTotal(index).discount)}
                          </span>
                        ) : null}
                      </span>
                      <span className="font-semibold">
                        Total: {formatIDR(itemTotal(index).total)}
                      </span>
                    </div>
                  </div>
                ))}
                {errors.items?.message ? (
                  <p className="text-xs text-destructive">{errors.items.message}</p>
                ) : null}
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
                {busy ? 'Menyimpan...' : 'Simpan Pembelian'}
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
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="h-9 rounded-lg border bg-card px-2 text-sm outline-none"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="flex rounded-lg border bg-card p-1">
              {paymentFilters.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setPaymentFilter(f.value)}
                  className={cn(
                    'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                    paymentFilter === f.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
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
        </div>

        {sortedPurchases.length === 0 ? (
          <EmptyState title="Tidak ada pembelian" />
        ) : (
          <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Proyek</th>
                  <th className="px-4 py-3 font-medium">Material</th>
                  <th className="px-4 py-3 font-medium">Toko</th>
                  <th className="px-4 py-3 text-right font-medium">Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Pembayaran</th>
                  <th className="px-4 py-3 font-medium">Bon</th>
                  <th className="px-4 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sortedPurchases.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDateTime(p.purchased_at)}
                    </td>
                    <td className="px-4 py-3 font-medium">{p.project_name}</td>
                    <td className="px-4 py-3">
                      {p.material_name} ({p.qty} {p.unit})
                    </td>
                    <td className="px-4 py-3">{p.store_name}</td>
                    <td className="px-4 py-3 text-right">
                      {p.qty} {p.unit}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatIDR(p.total_price)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
                          p.paid
                            ? 'border-green-300 bg-green-50 text-green-700'
                            : 'border-amber-300 bg-amber-50 text-amber-700'
                        )}
                      >
                        {p.paid ? 'Sudah Dibayar' : 'Belum Dibayar'}
                      </span>
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
                        {isAdmin ? (
                          <>
                            <UploadReceiptDialog
                              purchaseId={p.id}
                              hasReceipt={p.receipt_status === 'received'}
                            />
                            <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                              <Pencil className="size-4" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(p)}
                            >
                              <Trash2 className="size-4" />
                              Hapus
                            </Button>
                          </>
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

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Pembelian?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Hapus "${deleteTarget.material_name}" (${deleteTarget.qty}) di ${deleteTarget.project_name}? Stok akan dikurangi.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={deleteBusy}>
              {deleteBusy ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pembelian</DialogTitle>
            <DialogDescription>
              Perbarui detail pembelian. Jika material atau jumlah berubah, stok
              akan disesuaikan otomatis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editProjectName">Nama Proyek</Label>
                <Input
                  id="editProjectName"
                  value={editForm.projectName}
                  readOnly={!!managedProject}
                  className={managedProject ? 'opacity-70' : undefined}
                  onChange={(e) => setEditForm((f) => ({ ...f, projectName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editStoreName">Nama Toko</Label>
                <Input
                  id="editStoreName"
                  value={editForm.storeName}
                  onChange={(e) => setEditForm((f) => ({ ...f, storeName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editMaterialName">Nama Material</Label>
              <Input
                id="editMaterialName"
                value={editForm.materialName}
                onChange={(e) => setEditForm((f) => ({ ...f, materialName: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="editQty">Qty</Label>
                <Input
                  id="editQty"
                  type="number"
                  min="0"
                  step="any"
                  value={editForm.qty}
                  onChange={(e) => setEditForm((f) => ({ ...f, qty: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editUnit">Satuan</Label>
                <Input
                  id="editUnit"
                  value={editForm.unit}
                  onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editUnitPrice">Harga Satuan (Rp)</Label>
                <Input
                  id="editUnitPrice"
                  type="number"
                  min="0"
                  step="any"
                  value={editForm.unitPrice}
                  onChange={(e) => setEditForm((f) => ({ ...f, unitPrice: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="editDiscount">Diskon % (opsional)</Label>
                <Input
                  id="editDiscount"
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={editForm.discountPercent}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, discountPercent: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Total Setelah Diskon</Label>
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm font-semibold">
                  {formatIDR(
                    computePurchaseTotal(
                      Number(editForm.qty) || 0,
                      Number(editForm.unitPrice) || 0,
                      Number(editForm.discountPercent) || 0
                    )
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPurchasedAt">Tanggal</Label>
              <Input
                id="editPurchasedAt"
                type="date"
                value={editForm.purchasedAt}
                onChange={(e) => setEditForm((f) => ({ ...f, purchasedAt: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Batal
            </Button>
            <Button onClick={confirmEdit} disabled={editBusy}>
              {editBusy ? <Loader2 className="animate-spin" /> : <Save />}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
