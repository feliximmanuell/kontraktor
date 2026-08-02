'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { createMaterialRequest } from '@/lib/actions/requests';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
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

const schema = z.object({
  projectId: z.string().min(1, 'Pilih proyek terlebih dahulu'),
  materialName: z.string().min(1, 'Nama material wajib diisi'),
  requestedQty: z.number().min(0.01, 'Jumlah harus lebih dari 0'),
  notes: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),
});

type FormValues = z.infer<typeof schema>;

export default function RequestPage() {
  const supabase = useMemo(() => createClient(), []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { projectId: '', materialName: '', requestedQty: undefined, notes: '' },
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase
        .from('projects')
        .select('id, name, location')
        .eq('status', 'active')
        .order('name');
      if (!mounted) return;
      if (data) setProjects(data as unknown as Project[]);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setDone(false);

    const formData = new FormData();
    formData.set('projectId', values.projectId);
    formData.set('materialName', values.materialName);
    formData.set('requestedQty', String(values.requestedQty));
    formData.set('notes', values.notes ?? '');

    const res = await createMaterialRequest(formData);
    setSubmitting(false);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success('Pengajuan berhasil dikirim ke Admin!');
    reset();
    setDone(true);
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Pengajuan Pembelian Material</CardTitle>
          <CardDescription>
            Ajukan kebutuhan material untuk proyek. Tanpa login, data langsung
            masuk ke Admin untuk diproses.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              <Label htmlFor="materialName">Nama Material / Barang</Label>
              <Input
                id="materialName"
                placeholder="Cth: Semen 50kg, Besi Beton 8mm, Cat Tembok"
                className="h-12 text-base"
                {...register('materialName')}
              />
              {errors.materialName ? (
                <p className="text-xs text-destructive">{errors.materialName.message}</p>
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

      {done ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 className="size-4 shrink-0" />
          Pengajuan tercatat. Admin akan memverifikasi permintaan Anda.
        </div>
      ) : null}
    </div>
  );
}
