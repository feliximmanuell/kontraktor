'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { createMaterialUsage } from '@/lib/actions/usages';
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
import { Loader2, Save, Search } from 'lucide-react';
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
}: {
  usages: UsageJoined[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { projectName: '', materialName: '', qtyUsed: '', usedFor: '' },
  });

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
                    {...register('projectName')}
                  />
                  {errors.projectName ? (
                    <p className="text-xs text-destructive">{errors.projectName.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="materialName">Nama Material / Barang</Label>
                  <Input
                    id="materialName"
                    placeholder="Cth: Semen 50kg"
                    {...register('materialName')}
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
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(u.used_at)}
                  </span>
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
    </div>
  );
}
