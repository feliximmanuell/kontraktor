'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { createMaterialRequest } from '@/lib/actions/requests';
import { MaterialAutocomplete } from '@/components/material-autocomplete';
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

const schema = z.object({
  projectName: z.string().min(1, 'Nama proyek wajib diisi'),
  requesterName: z.string().min(1, 'Nama Anda wajib diisi'),
  materialName: z.string().min(1, 'Nama material wajib diisi'),
  requestedQty: z.string().min(1, 'Jumlah wajib diisi'),
  unit: z.string().min(1, 'Satuan wajib diisi'),
  notes: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),
});

type FormValues = z.infer<typeof schema>;

export default function RequestPage() {
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
    defaultValues: {
      projectName: '',
      requesterName: '',
      materialName: '',
      requestedQty: '',
      unit: '',
      notes: '',
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setDone(false);

    const formData = new FormData();
    formData.set('projectName', values.projectName);
    formData.set('requesterName', values.requesterName);
    formData.set('materialName', values.materialName);
    formData.set('requestedQty', values.requestedQty);
    formData.set('unit', values.unit);
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
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <span aria-hidden="true">&larr;</span> Pilihan Portal
      </Link>

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
              <Label htmlFor="projectName">Nama Proyek</Label>
              <Input
                id="projectName"
                placeholder="Cth: Rumah Pak Haji Jamil, Ruko 2 Lantai"
                className="h-12 text-base"
                {...register('projectName')}
              />
              {errors.projectName ? (
                <p className="text-xs text-destructive">{errors.projectName.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="requesterName">Nama Pengaju</Label>
              <Input
                id="requesterName"
                placeholder="Cth: Pak Budi, Kang Eko"
                className="h-12 text-base"
                {...register('requesterName')}
              />
              {errors.requesterName ? (
                <p className="text-xs text-destructive">{errors.requesterName.message}</p>
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
                    placeholder="Cth: Semen 50kg, Besi Beton 8mm, Cat Tembok"
                  />
                )}
              />
              <p className="text-xs text-muted-foreground">
                Ketik lalu pilih dari daftar stok yang tersedia, atau ketik nama
                baru untuk material yang belum ada.
              </p>
              {errors.materialName ? (
                <p className="text-xs text-destructive">{errors.materialName.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="requestedQty">Jumlah</Label>
                <Input
                  id="requestedQty"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Cth: 10, 2, 0.5"
                  className="h-12 text-base"
                  {...register('requestedQty')}
                />
                {errors.requestedQty ? (
                  <p className="text-xs text-destructive">
                    {errors.requestedQty.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Satuan</Label>
                <Input
                  id="unit"
                  placeholder="Cth: sak, truk, batang"
                  className="h-12 text-base"
                  {...register('unit')}
                />
                {errors.unit ? (
                  <p className="text-xs text-destructive">{errors.unit.message}</p>
                ) : null}
              </div>
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
