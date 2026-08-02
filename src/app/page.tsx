import Link from 'next/link';
import { ArrowRight, ClipboardList, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <ClipboardList className="size-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Sistem Rekap Material Proyek
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Pilih portal untuk memulai. Pengajuan pembelian bisa tanpa akun, pengelolaan
          proyek memerlukan login.
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        <Link href="/request" className="group">
          <Card className="h-full transition-colors hover:border-primary/60 hover:bg-accent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-5 text-primary" />
                Portal Pengajuan
              </CardTitle>
              <CardDescription>
                Ajukan kebutuhan material untuk proyek. Tanpa login, langsung
                diproses Admin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Kirim pengajuan pembelian material baru.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Mulai Mengajukan
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/login" className="group">
          <Card className="h-full transition-colors hover:border-primary/60 hover:bg-accent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                Portal Admin
              </CardTitle>
              <CardDescription>
                Verifikasi pengajuan, catat pembelian, kelola stok, dan audit
                material proyek.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Khusus Admin & Bos. Perlu login dengan akun.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Masuk Admin
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
