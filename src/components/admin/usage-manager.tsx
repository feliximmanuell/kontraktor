'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { createMaterialUsage, deleteUsage, updateUsage } from '@/lib/actions/usages';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Save, Search, Trash2, Pencil } from 'lucide-react';
import type { UsageJoined } from '@/lib/types';
import { formatDateTime } from '@/lib/format';

const schema = z.object({
  projectName: z.string().min(1, 'Nama proyek wajib diisi'),
  materialName: z.string().min(1, 'Nama material wajib diisi'),
  qtyUsed: z.string().min(1, 'Jumlah wajib diisi'),
  usedFor: z.string().min(3, 'Detail pemakaian wajib diisi'),
});

type FormValues = z.infer<typeof schema>;

export function UsageManager({
  usages,
  isAdmin,
  managedProject,
}: {
  usages: UsageJoined[];
  isAdmin: boolean;
  managedProject: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<UsageJoined | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [editTarget, setEditTarget] = useState<UsageJoined | null>(null);
  const [editForm, setEditForm] = useState({
    projectName: '',
    materialName: '',
    qtyUsed: '',
    usedFor: '',
    usedAt: '',
  });
  const [editBusy, setEditBusy] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { projectName: '', materialName: '', qtyUsed: '', usedFor: '' },
  });

  useEffect(() => {
    if (managedProject) setValue('projectName', managedProject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managedProject]);

  async function onSubmit(values: FormValues) {
    setBusy(true);
    const formData = new FormData();
    formData.set('projectName', values.projectName);
    formData.set('materialName', values.materialName);
    formData.set('qtyUsed', values.qtyUsed);
    formData.set('usedFor', values.usedFor);
    const res = await createMaterialUsage(formData);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Pemakaian dicatat.');
    reset();
    router.refresh();
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    const res = await deleteUsage(deleteTarget.id);
    setDeleteBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Pemakaian dihapus. Stok otomatis dikembalikan.');
    setDeleteTarget(null);
    router.refresh();
  }

  function openEdit(u: UsageJoined) {
    setEditTarget(u);
    setEditForm({
      projectName: managedProject ?? u.project_name,
      materialName: u.material_name,
      qtyUsed: u.qty_used,
      usedFor: u.used_for,
      usedAt: u.used_at.slice(0, 10),
    });
  }

  async function confirmEdit() {
    if (!editTarget) return;
    const projectName = editForm.projectName.trim();
    const materialName = editForm.materialName.trim();
    const qtyUsed = editForm.qtyUsed.trim();
    const usedFor = editForm.usedFor.trim();
    if (!projectName || !materialName || !qtyUsed || usedFor.length < 3 || !editForm.usedAt) {
      toast.error('Data pemakaian tidak lengkap.');
      return;
    }
    setEditBusy(true);
    const res = await updateUsage(editTarget.id, {
      project_name: projectName,
      material_name: materialName,
      qty_used: qtyUsed,
      used_for: usedFor,
      used_at: new Date(editForm.usedAt + 'T00:00:00').toISOString(),
    });
    setEditBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Pemakaian diperbarui.');
    setEditTarget(null);
    router.refresh();
  }

  const q = query.trim().toLowerCase();
  const filteredUsages = usages.filter(
    (u) =>
      !q ||
      u.project_name.toLowerCase().includes(q) ||
      u.material_name.toLowerCase().includes(q) ||
      u.used_for.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Log Pemakaian Material</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catat barang yang terpakai di lapangan beserta detail penggunaannya.
        </p>
      </div>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Catat Pemakaian</CardTitle>
            <CardDescription>
              Nama proyek, material, dan jumlah bebas diisi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                  <Label>Nama Material / Barang</Label>
                  <Controller
                    control={control}
                    name="materialName"
                    render={({ field }) => (
                      <MaterialAutocomplete
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Cth: Semen 50kg"
                      />
                    )}
                  />
                  {errors.materialName ? (
                    <p className="text-xs text-destructive">{errors.materialName.message}</p>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qtyUsed">Jumlah Terpakai</Label>
                <Input
                  id="qtyUsed"
                  placeholder="Cth: 5 sak"
                  {...register('qtyUsed')}
                />
                {errors.qtyUsed ? (
                  <p className="text-xs text-destructive">{errors.qtyUsed.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="usedFor">Digunakan Untuk Apa / Di Mana?</Label>
                <Textarea
                  id="usedFor"
                  rows={3}
                  placeholder="Cth: Pengecoran kolom lantai 2, bagian selatan bangunan"
                  {...register('usedFor')}
                />
                {errors.usedFor ? (
                  <p className="text-xs text-destructive">{errors.usedFor.message}</p>
                ) : null}
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Save />}
                {busy ? 'Menyimpan...' : 'Simpan Pemakaian'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Anda masuk sebagai Bos (read-only). Tidak dapat mencatat pemakaian.
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Riwayat Pemakaian</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari proyek / material / detail"
              className="h-9 w-64 pl-9"
            />
          </div>
        </div>

        {filteredUsages.length === 0 ? (
          <EmptyState title="Tidak ada data pemakaian" />
        ) : (
          <div className="space-y-3">
            {filteredUsages.map((u) => (
              <div key={u.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold">
                    {u.material_name}{' '}
                    <span className="font-normal text-muted-foreground">(-{u.qty_used})</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(u.used_at)}
                    </span>
                    {isAdmin ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openEdit(u)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(u)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Proyek: <span className="font-medium">{u.project_name}</span>
                </p>
                <p className="mt-1 rounded-lg bg-muted/50 p-2 text-sm">{u.used_for}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Dicatat oleh: {u.logged_by_name}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Pemakaian?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Hapus pemakaian "${deleteTarget.material_name}" (-${deleteTarget.qty_used}) di ${deleteTarget.project_name}? Stok akan dikembalikan.`
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
            <DialogTitle>Edit Pemakaian</DialogTitle>
            <DialogDescription>
              Perbarui detail pemakaian. Jika material atau jumlah berubah, stok
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
                <Label htmlFor="editMaterialName">Nama Material</Label>
                <Input
                  id="editMaterialName"
                  value={editForm.materialName}
                  onChange={(e) => setEditForm((f) => ({ ...f, materialName: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editQtyUsed">Jumlah Terpakai</Label>
                <Input
                  id="editQtyUsed"
                  value={editForm.qtyUsed}
                  onChange={(e) => setEditForm((f) => ({ ...f, qtyUsed: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editUsedAt">Tanggal</Label>
                <Input
                  id="editUsedAt"
                  type="date"
                  value={editForm.usedAt}
                  onChange={(e) => setEditForm((f) => ({ ...f, usedAt: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editUsedFor">Digunakan Untuk Apa / Di Mana?</Label>
              <Textarea
                id="editUsedFor"
                rows={3}
                value={editForm.usedFor}
                onChange={(e) => setEditForm((f) => ({ ...f, usedFor: e.target.value }))}
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
