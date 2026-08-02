import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Hanya jalankan proxy pada rute aplikasi, bukan aset statis (JS/CSS/gambar).
// Tanpa matcher ini, TIDAK PEDULI berapa banyak koneksi jaringan ke Supabase
// dipicu pada tiap request aset saat load awal halaman.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt)$).*)'],
};
