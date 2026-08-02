'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { HardHat, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
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

const schema = z.object({
  email: z.string().min(1, 'Email wajib diisi').email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      toast.error('Login gagal: ' + error.message);
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('users_profile')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      const role = (profile?.role ?? 'tukang') as 'tukang' | 'admin' | 'bos';
      router.push(role === 'tukang' ? '/request' : '/admin/dashboard');
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <HardHat className="size-6" />
          </div>
          <CardTitle className="text-xl">Masuk Portal Admin</CardTitle>
          <CardDescription>
            Verifikasi pengajuan, rekap pembelian, dan audit material proyek.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="nama@perusahaan.com"
                {...register('email')}
              />
              {errors.email ? (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password ? (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              ) : null}
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : null}
              {loading ? 'Memproses...' : 'Masuk'}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Ingin mengajukan material?{' '}
            <Link href="/request" className="font-medium text-primary hover:underline">
              Ajukan tanpa login
            </Link>
            .
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Akun dibuat oleh Admin/Bos melalui Supabase Dashboard. Hubungi admin
            jika belum punya akun.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
