import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { PROFILE_COOKIE, encodeProfile } from '@/lib/session';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Penting: jangan jalankan kode lain di antara createServerClient dan getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin = path.startsWith('/login');
  const isAdmin = path.startsWith('/admin');

  if (!user) {
    // /request publik, tidak butuh login.
    if (isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', path);
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (isLogin) {
    // Hanya di halaman login kita butuh role (query ringan; jarang dikunjungi).
    const { data: profile } = await supabase
      .from('users_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    const role = profile?.role ?? 'tukang';
    const url = request.nextUrl.clone();
    url.pathname = role === 'tukang' ? '/request' : '/admin/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Gate role + redirect pilih proyek ditangani di layout (requireRole) dan
  // cek cookie ringan di sini — tanpa query ke database per request.
  if (isAdmin) {
    // Cache profil dari DB ke cookie untuk menghindari round-trip getUser() +
    // query users_profile berulang di server component tiap navigasi.
    const { data: profileRow } = await supabase
      .from('users_profile')
      .select('id, user_id, full_name, role')
      .eq('user_id', user.id)
      .maybeSingle();
    const payload = {
      id: profileRow?.id ?? null,
      user_id: user.id,
      full_name: profileRow?.full_name ?? null,
      role: profileRow?.role ?? 'tukang',
    } as { id: string | null; user_id: string; full_name: string | null; role: 'tukang' | 'admin' | 'bos' };
    response.cookies.set(PROFILE_COOKIE, encodeProfile(payload), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24,
    });

    const managed = request.cookies.get('managed_project')?.value;
    if (!managed && path !== '/admin/projects') {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/projects';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return response;
}
