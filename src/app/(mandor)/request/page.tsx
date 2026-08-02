'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { createMaterialRequest } from '@/lib/actions/requests';
import { AlertTriangle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

interface Project {
  id: string;
  name: string;
  location: string | null;
}
interface Material {
  id: string;
  name: string;
  unit: string;
}

const schema = z.object({
  projectId: z.string().min(1, 'Pilih proyek terlebih dahulu'),
  materialId: z.string().min(1, 'Pilih material terlebih dahulu'),
  requestedQty: z.number().min(0.01, 'Jumlah harus lebih dari 0'),
  notes: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),
});

type FormValues = z.infer<typeof schema>;

export default function RequestPage() {
  const supabase = useMemo(() => createClient(), []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [warning, setWarning] = useState<{ current_stock: number; unit: string } | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { projectId: '', materialId: '', requestedQty: undefined, notes: '' },
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [pRes, mRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, name, location')
          .eq('status', 'active')
          .order('name'),
        supabase.from('materials').select('id, name, unit').order('name'),
      ]);
      if (!mounted) return;
      if (pRes.data) setProjects(pRes.data as unknown as Project[]);
      if (mRes.data) setMaterials(mRes.data as unknown as Material[]);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setWarning(null);

    const formData = new FormData();
    formData.set('projectId', values.projectId);
    formData.set('materialId', values.materialId);
    formData.set('requestedQty', String(values.requestedQty));
    formData.set('notes', values.notes ?? '');

    const res = await createMaterialRequest(formData);
    setSubmitting(false);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success('Pengajuan berhasil dikirim ke Admin!');
    const unit = materials.find((m) => m.id === values.materialId)?.unit ?? '';
    if (res.is_flagged_duplicate) {
      setWarning({ current_stock: res.current_stock ?? 0, unit });
    }
    reset();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Minta Material</CardTitle>
          <CardDescription>
            Ajukan kebutuhan material baru dari lapangan dengan cepat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {warning && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                Peringatan: Stok material ini di proyek masih tersisa{' '}
                <strong>
                  {warning.current_stock} {warning.unit}
                </strong>
                . Pastikan benar-benar butuh sebelum mengajukan.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Pilih Proyek</Label>
              <Controller
                control={control}
                name="projectId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <SelectTrigger className="h-12 w-full">
                      <SelectValue placeholder="-- Pilih Proyek --" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.location ? ` - ${p.location}` : ''}
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
              <Label>Pilih Material / Barang</Label>
              <Controller
                control={control}
                name="materialId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <SelectTrigger className="h-12 w-full">
                      <SelectValue placeholder="-- Pilih Barang --" />
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

            <div className="space-y-2">
              <Label htmlFor="requestedQty">Jumlah Dibutuhkan</Label>
              <Input
                id="requestedQty"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="Cth: 10"
                className="h-12 text-base"
                {...register('requestedQty', { valueAsNumber: true })}
              />
              {errors.requestedQty ? (
                <p className="text-xs text-destructive">{errors.requestedQty.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Alasan / Catatan</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="Cth: Besi untuk cor dak lantai 2, dikerjakan minggu depan"
                {...register('notes')}
              />
              {errors.notes ? (
                <p className="text-xs text-destructive">{errors.notes.message}</p>
              ) : null}
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-14 w-full text-base font-bold"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="animate-spin" /> : <Send />}
              {submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {warning ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 className="size-4" />
          Pengajuan tercatat. Admin akan memverifikasi permintaan Anda.
        </div>
      ) : null}
    </div>
  );
}
