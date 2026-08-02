'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  payPurchases,
  createManualPayment,
  updatePayment,
  deletePayment,
} from '@/lib/actions/payments';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Wallet, Plus, Pencil, Trash2, Save } from 'lucide-react';
import type { PaymentJoined, UnpaidPurchase } from '@/lib/types';
import { formatIDR, formatDateTime } from '@/lib/format';

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

const manualSchema = z.object({
  description: z.string().min(1, 'Keterangan wajib diisi'),
  projectName: z.string().min(1, 'Nama proyek wajib diisi'),
  materialName: z.string().optional(),
  amount: z.number().min(0, 'Jumlah tidak boleh negatif'),
  paidAt: z.string().min(1, 'Tanggal wajib diisi'),
});

type ManualValues = z.infer<typeof manualSchema>;

export function PaymentsManager({
  unpaid,
  payments,
  isAdmin,
}: {
  unpaid: UnpaidPurchase[];
  payments: PaymentJoined[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [payTarget, setPayTarget] = useState<UnpaidPurchase | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(todayInput());
  const [payBusy, setPayBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaymentJoined | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [editTarget, setEditTarget] = useState<PaymentJoined | null>(null);
  const [editForm, setEditForm] = useState({
    description: '',
    projectName: '',
    materialName: '',
    amount: '',
    paidAt: todayInput(),
  });
  const [editBusy, setEditBusy] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ManualValues>({
    resolver: zodResolver(manualSchema),
    defaultValues: {
      description: '',
      projectName: '',
      materialName: '',
      amount: undefined as unknown as number,
      paidAt: todayInput(),
    },
  });

  function openPay(p: UnpaidPurchase) {
    setPayTarget(p);
    setPayAmount(String(p.total_price));
    setPayDate(todayInput());
  }

  function openEdit(p: PaymentJoined) {
    setEditTarget(p);
    setEditForm({
      description: p.description,
      projectName: p.project_name,
      materialName: p.material_name ?? '',
      amount: String(p.amount),
      paidAt: p.paid_at.slice(0, 10),
    });
  }

  async function confirmEdit() {
    if (!editTarget) return;
    const description = editForm.description.trim();
    const projectName = editForm.projectName.trim();
    const amount = Number(editForm.amount);
    if (!description || !projectName || !(amount >= 0) || !editForm.paidAt) {
      toast.error('Data pembayaran tidak lengkap.');
      return;
    }
    setEditBusy(true);
    const res = await updatePayment(editTarget.id, {
      description,
      project_name: projectName,
      material_name: editForm.materialName.trim() || undefined,
      amount,
      paid_at: new Date(editForm.paidAt + 'T00:00:00').toISOString(),
    });
    setEditBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Pembayaran diperbarui.');
    setEditTarget(null);
    router.refresh();
  }

  async function confirmPay() {
    if (!payTarget) return;
    const amount = Number(payAmount);
    if (!(amount >= 0)) {
      toast.error('Jumlah pembayaran tidak valid.');
      return;
    }
    setPayBusy(true);
    const res = await payPurchases([
      { id: payTarget.id, amount, paid_at: new Date(payDate + 'T00:00:00').toISOString() },
    ]);
    setPayBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Pembayaran tercatat.');
    setPayTarget(null);
    router.refresh();
  }

  async function onManual(values: ManualValues) {
    setManualBusy(true);
    const res = await createManualPayment({
      description: values.description,
      project_name: values.projectName,
      material_name: values.materialName || undefined,
      amount: values.amount,
      paid_at: new Date(values.paidAt + 'T00:00:00').toISOString(),
    });
    setManualBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Pengeluaran manual dicatat.');
    reset({
      description: '',
      projectName: '',
      materialName: '',
      amount: undefined as unknown as number,
      paidAt: todayInput(),
    });
    router.refresh();
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    const res = await deletePayment(deleteTarget.id);
    setDeleteBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Pembayaran dihapus.');
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pembayaran</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bayar pembelian yang belum dibayar, atau catat pengeluaran manual.
        </p>
      </div>

      {isAdmin ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Bayar Pembelian</CardTitle>
              <CardDescription>
                Daftar pembelian yang belum dibayar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unpaid.length === 0 ? (
                <EmptyState title="Semua pembelian sudah dibayar" />
              ) : (
                <div className="space-y-3">
                  {unpaid.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          {p.material_name}{' '}
                          <span className="font-normal text-muted-foreground">({p.qty})</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {p.project_name} · {p.store_name} · {formatDateTime(p.purchased_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{formatIDR(p.total_price)}</span>
                        <Button size="sm" onClick={() => openPay(p)}>
                          <Wallet />
                          Bayar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Input Pengeluaran Manual</CardTitle>
              <CardDescription>
                Catat pengeluaran di luar pembelian (mis. upah, sewa alat, dll).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onManual)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="description">Keterangan</Label>
                    <Input
                      id="description"
                      placeholder="Cth: Sewa molen, Upah harian"
                      {...register('description')}
                    />
                    {errors.description ? (
                      <p className="text-xs text-destructive">{errors.description.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="projectName">Nama Proyek</Label>
                    <Input
                      id="projectName"
                      placeholder="Cth: Rumah Pak Haji Jamil"
                      {...register('projectName')}
                    />
                    {errors.projectName ? (
                      <p className="text-xs text-destructive">{errors.projectName.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="materialName">Material (opsional)</Label>
                    <Input
                      id="materialName"
                      placeholder="Cth: Semen 50kg"
                      {...register('materialName')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Jumlah (Rp)</Label>
                    <Input
                      id="amount"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="50000"
                      {...register('amount', { valueAsNumber: true })}
                    />
                    {errors.amount ? (
                      <p className="text-xs text-destructive">{errors.amount.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paidAt">Tanggal</Label>
                    <Input id="paidAt" type="date" {...register('paidAt')} />
                    {errors.paidAt ? (
                      <p className="text-xs text-destructive">{errors.paidAt.message}</p>
                    ) : null}
                  </div>
                </div>
                <Button type="submit" disabled={manualBusy}>
                  {manualBusy ? <Loader2 className="animate-spin" /> : <Plus />}
                  {manualBusy ? 'Menyimpan...' : 'Catat Pengeluaran'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Anda masuk sebagai Bos (read-only). Tidak dapat menginput pembayaran.
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Riwayat Pembayaran</h2>
        {payments.length === 0 ? (
          <EmptyState title="Belum ada pembayaran" />
        ) : (
          <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Proyek</th>
                  <th className="px-4 py-3 font-medium">Keterangan</th>
                  <th className="px-4 py-3 text-right font-medium">Jumlah</th>
                  <th className="px-4 py-3 font-medium">Tipe</th>
                  {isAdmin ? (
                    <th className="px-4 py-3 font-medium">Aksi</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDateTime(p.paid_at)}
                    </td>
                    <td className="px-4 py-3 font-medium">{p.project_name}</td>
                    <td className="px-4 py-3">
                      <p>{p.description}</p>
                      {p.material_name ? (
                        <p className="text-xs text-muted-foreground">{p.material_name}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatIDR(p.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          p.payment_type === 'purchase'
                            ? 'border-blue-300 bg-blue-50 text-blue-700'
                            : 'border-purple-300 bg-purple-50 text-purple-700'
                        }`}
                      >
                        {p.payment_type === 'purchase' ? 'Pembelian' : 'Manual'}
                      </span>
                    </td>
                    {isAdmin ? (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(p)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(p)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!payTarget} onOpenChange={(open) => !open && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bayar Pembelian</DialogTitle>
            <DialogDescription>
              {payTarget
                ? `${payTarget.material_name} (${payTarget.qty}) — ${payTarget.project_name}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payAmount">Jumlah Dibayar (Rp)</Label>
              <Input
                id="payAmount"
                type="number"
                min="0"
                step="any"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payDate">Tanggal Bayar</Label>
              <Input
                id="payDate"
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)}>
              Batal
            </Button>
            <Button onClick={confirmPay} disabled={payBusy}>
              {payBusy ? <Loader2 className="animate-spin" /> : <Wallet />}
              Konfirmasi Bayar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pembayaran</DialogTitle>
            <DialogDescription>
              {editTarget
                ? editTarget.payment_type === 'purchase'
                  ? 'Pembayaran terkait pembelian. Ubah jumlah atau tanggal sesuai kebutuhan.'
                  : 'Perbarui detail pengeluaran manual.'
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editDescription">Keterangan</Label>
              <Input
                id="editDescription"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editProjectName">Nama Proyek</Label>
                <Input
                  id="editProjectName"
                  value={editForm.projectName}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, projectName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editMaterialName">Material (opsional)</Label>
                <Input
                  id="editMaterialName"
                  value={editForm.materialName}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, materialName: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editAmount">Jumlah (Rp)</Label>
                <Input
                  id="editAmount"
                  type="number"
                  min="0"
                  step="any"
                  value={editForm.amount}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPaidAt">Tanggal (Tahun-Bulan-Tanggal)</Label>
                <Input
                  id="editPaidAt"
                  type="date"
                  value={editForm.paidAt}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, paidAt: e.target.value }))
                  }
                />
              </div>
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

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Pembayaran?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Hapus pembayaran "${deleteTarget.description}" (${formatIDR(deleteTarget.amount)})? Jika terkait pembelian, statusnya dikembalikan ke belum dibayar.`
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
    </div>
  );
}
