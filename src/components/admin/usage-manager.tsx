'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import type { UsageJoined } from '@/lib/types';
import { formatDateTime } from '@/lib/format';

interface Option {
  id: string;
  name: string;
  unit?: string;
}

const schema = z.object({
  projectId: z.string().min(1, 'Pilih proyek'),
  materialId: z.string().min(1, 'Pilih material'),
  qtyUsed: z.number().min(0.01, 'Jumlah harus lebih dari 0'),
  usedFor: z.string().min(3, 'Detail pemakaian wajib diisi'),
});

type FormValues = z.infer<typeof schema>;

export function UsageManager({
  projects,
  materials,
  usages,
  isAdmin,
}: {
  projects: Option[];
  materials: Option[];
  usages: UsageJoined[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const [filterProject, setFilterProject] = useState('');
  const [filterMaterial, setFilterMaterial] = useState('');

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { projectId: '', materialId: '', qtyUsed: undefined, usedFor: '' },
  });

  async function onSubmit(values: FormValues) {
    setBusy(true);
    const formData = new FormData();
    formData.set('projectId', values.projectId);
    formData.set('materialId', values.materialId);
    formData.set('qtyUsed', String(values.qtyUsed));
    formData.set('usedFor', values.usedFor);
    const res = await createMaterialUsage(formData);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Pemakaian dicatat. Stok proyek otomatis berkurang.');
    reset();
    router.refresh();
  }

  const filteredUsages = usages.filter(
    (u) =>
      (!filterProject || u.project_id === filterProject) &&
      (!filterMaterial || u.material_id === filterMaterial)
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
              Stok proyek otomatis berkurang setelah pemakaian dicatat.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Proyek</Label>
                  <Controller
                    control={control}
                    name="projectId"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
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
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
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
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qtyUsed">Jumlah Terpakai</Label>
                <Input
                  id="qtyUsed"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Cth: 5"
                  {...register('qtyUsed', { valueAsNumber: true })}
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
          <div className="flex flex-wrap gap-2">
            <Select onValueChange={(v) => setFilterProject(v === 'all' ? '' : v)} value={filterProject || 'all'}>
              <SelectTrigger size="sm" className="w-[180px]">
                <SelectValue placeholder="Semua Proyek" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Proyek</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => setFilterMaterial(v === 'all' ? '' : v)} value={filterMaterial || 'all'}>
              <SelectTrigger size="sm" className="w-[180px]">
                <SelectValue placeholder="Semua Material" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Material</SelectItem>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    {u.materials?.name}{' '}
                    <span className="font-normal text-muted-foreground">
                      (-{u.qty_used} {u.materials?.unit})
                    </span>
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(u.used_at)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Proyek: <span className="font-medium">{u.projects?.name}</span>
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
