'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  createCashflowIncome,
  updateCashflowIncome,
  deleteCashflowIncome,
} from '@/lib/actions/cashflow';
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
import { Loader2, Plus, Pencil, Trash2, Save } from 'lucide-react';
import { formatIDR, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { JournalRow } from '@/app/admin/cashflow/page';

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

const schema = z.object({
  description: z.string().min(1, 'Keterangan wajib diisi'),
  projectName: z.string().min(1, 'Nama proyek wajib diisi'),
  amount: z.number().min(0, 'Jumlah tidak boleh negatif'),
  entryDate: z.string().min(1, 'Tanggal wajib diisi'),
});

type FormValues = z.infer<typeof schema>;

export function CashflowManager({
  rows,
  isAdmin,
  managedProject,
}: {
  rows: JournalRow[];
  isAdmin: boolean;
  managedProject: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editTarget, setEditTarget] = useState<JournalRow | null>(null);
  const [editForm, setEditForm] = useState({
    description: '',
    projectName: '',
    amount: '',
    entryDate: todayInput(),
  });
  const [editBusy, setEditBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JournalRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: '',
      projectName: '',
      amount: undefined as unknown as number,
      entryDate: todayInput(),
    },
  });

  useEffect(() => {
    if (managedProject) setValue('projectName', managedProject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managedProject]);

  async function onCreate(values: FormValues) {
    setBusy(true);
    const res = await createCashflowIncome({
      description: values.description,
      project_name: values.projectName,
      amount: values.amount,
      entry_date: new Date(values.entryDate + 'T00:00:00').toISOString(),
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Pemasukan dicatat.');
    reset({
      description: '',
      projectName: '',
      amount: undefined as unknown as number,
      entryDate: todayInput(),
    });
    router.refresh();
  }

  function openEdit(row: JournalRow) {
    setEditTarget(row);
    setEditForm({
      description: row.description,
      projectName: managedProject ?? row.project_name,
      amount: String(row.amount),
      entryDate: row.date.slice(0, 10),
    });
  }

  async function confirmEdit() {
    if (!editTarget || editTarget.source !== 'cashflow') return;
    const description = editForm.description.trim();
    const projectName = editForm.projectName.trim();
    const amount = Number(editForm.amount);
    if (!description || !projectName || !(amount >= 0) || !editForm.entryDate) {
      toast.error('Data pemasukan tidak lengkap.');
      return;
    }
    setEditBusy(true);
    const res = await updateCashflowIncome(editTarget.id.replace(/^in-/, ''), {
      description,
      project_name: projectName,
      amount,
      entry_date: new Date(editForm.entryDate + 'T00:00:00').toISOString(),
    });
    setEditBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Pemasukan diperbarui.');
    setEditTarget(null);
    router.refresh();
  }

  async function onDelete() {
    if (!deleteTarget || deleteTarget.source !== 'cashflow') return;
    setDeleteBusy(true);
    const res = await deleteCashflowIncome(deleteTarget.id.replace(/^in-/, ''));
    setDeleteBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Pemasukan dihapus.');
    setDeleteTarget(null);
    router.refresh();
  }

  const totalIn = rows
    .filter((r) => r.kind === 'pemasukan')
    .reduce((acc, r) => acc + r.amount, 0);
  const totalOut = rows
    .filter((r) => r.kind === 'pengeluaran')
    .reduce((acc, r) => acc + r.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs font-medium text-muted-foreground">Total Pemasukan</p>
          <p className="text-lg font-semibold text-green-700">{formatIDR(totalIn)}</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs font-medium text-muted-foreground">Total Pengeluaran</p>
          <p className="text-lg font-semibold text-destructive">{formatIDR(totalOut)}</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs font-medium text-muted-foreground">Saldo</p>
          <p
            className={cn(
              'text-lg font-semibold',
              totalIn - totalOut >= 0 ? 'text-foreground' : 'text-destructive'
            )}
          >
            {formatIDR(totalIn - totalOut)}
          </p>
        </div>
      </div>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Input Pemasukan</CardTitle>
            <CardDescription>
              Catat uang masuk, mis. pelunasan dari klien, DP proyek, dll.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="description">Keterangan</Label>
                  <Input
                    id="description"
                    placeholder="Cth: Pelunasan tahap 2, DP proyek"
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
                  <Label htmlFor="amount">Jumlah (Rp)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="500000"
                    {...register('amount', { valueAsNumber: true })}
                  />
                  {errors.amount ? (
                    <p className="text-xs text-destructive">{errors.amount.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entryDate">Tanggal</Label>
                  <Input id="entryDate" type="date" {...register('entryDate')} />
                  {errors.entryDate ? (
                    <p className="text-xs text-destructive">{errors.entryDate.message}</p>
                  ) : null}
                </div>
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Plus />}
                {busy ? 'Menyimpan...' : 'Catat Pemasukan'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Anda masuk sebagai Bos (read-only). Tidak dapat menginput pemasukan.
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Jurnal Cashflow</h2>
        {rows.length === 0 ? (
          <EmptyState title="Belum ada transaksi" />
        ) : (
          <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Proyek</th>
                  <th className="px-4 py-3 font-medium">Toko</th>
                  <th className="px-4 py-3 font-medium">Keterangan</th>
                  <th className="px-4 py-3 font-medium">Pencatat</th>
                  <th className="px-4 py-3 text-right font-medium">Pemasukan</th>
                  <th className="px-4 py-3 text-right font-medium">Pengeluaran</th>
                  {isAdmin ? (
                    <th className="px-4 py-3 font-medium">Aksi</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDateTime(r.date)}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.project_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.kind === 'pengeluaran' ? (r.store_name ?? '-') : '-'}
                    </td>
                    <td className="px-4 py-3">{r.description}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.by_name}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {r.kind === 'pemasukan' ? (
                        <span className="text-green-700">{formatIDR(r.amount)}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {r.kind === 'pengeluaran' ? (
                        <span className="text-destructive">{formatIDR(r.amount)}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    {isAdmin ? (
                      <td className="px-4 py-3">
                        {r.source === 'cashflow' ? (
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(r)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            dari Pembayaran
                          </span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pemasukan</DialogTitle>
            <DialogDescription>Perbarui detail pemasukan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editDescription">Keterangan</Label>
              <Input
                id="editDescription"
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editAmount">Jumlah (Rp)</Label>
                <Input
                  id="editAmount"
                  type="number"
                  min="0"
                  step="any"
                  value={editForm.amount}
                  onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEntryDate">Tanggal</Label>
                <Input
                  id="editEntryDate"
                  type="date"
                  value={editForm.entryDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, entryDate: e.target.value }))}
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
            <DialogTitle>Hapus Pemasukan?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Hapus "${deleteTarget.description}" (${formatIDR(deleteTarget.amount)}) dari jurnal?`
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
