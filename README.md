# Sistem Rekap Pembelian Material & Manajemen Stok Proyek Kontraktor

Web application fullstack production-ready untuk merekap pembelian material, manajemen
stok proyek, dan audit keuangan kontraktor. Dipakai langsung di lapangan oleh
Tukang/Mandor (mobile) dan di kantor oleh Admin/Bos (desktop).

## Tech Stack

- **Frontend:** Next.js 16 (App Router, TypeScript, Turbopack)
- **Styling/UI:** Tailwind CSS v4 + shadcn/ui + lucide-react
- **Backend, Database, Auth, Storage:** Supabase (PostgreSQL + RLS + Storage)
- **Form:** React Hook Form + Zod (Server Actions untuk mutasi data)

## Role Pengguna (RBAC)

| Role    | Portal                          | Kemampuan                                                        |
| ------- | ------------------------------- | ---------------------------------------------------------------- |
| `tukang`| `/request`, `/request/history`  | Ajukan permintaan material, lihat status pengajuannya            |
| `admin` | `/admin/*`                      | Verifikasi pengajuan, input pembelian, upload bon, stok, pemakaian |
| `bos`   | `/admin/*` (read-only)          | Dashboard audit, laporan per proyek, riwayat belanja             |

## Struktur Proyek

```
supabase/
  migrations/
    0001_init.sql      # schema, trigger, RLS, storage bucket
    0002_seed.sql      # data contoh (material & proyek)
src/
  proxy.ts             # Route guard + refresh session (RBAC) — Next 16 proxy
  lib/
    supabase/client.ts # Supabase browser client
    supabase/server.ts # Supabase server client (Server Components/Actions)
    supabase/middleware.ts # updateSession untuk proxy
    auth.ts            # requireAuth / requireRole
    actions/           # Server Actions (requests, purchases, usages, auth)
    types.ts           # tipe data tabel & hasil join
    format.ts          # format IDR & tanggal Indonesia
  components/          # komponen UI + portal (admin/, mandor/)
  app/
    login/             # Halaman masuk
    (mandor)/request, request/history
    (admin)/dashboard, requests, purchases, inventory, usage, audit
```

## 1. Setup Database (Supabase)

1. Buat project baru di [Supabase](https://supabase.com) (atau gunakan yang sudah ada).
2. Buka **SQL Editor**, jalankan isi file `supabase/migrations/0001_init.sql`.
3. (Opsional) Jalankan `supabase/migrations/0002_seed.sql` untuk data contoh
   (9 jenis material + 3 proyek).
4. File migrasi membuat otomatis: enums, 7 tabel, index, trigger mutasi stok,
   RLS policies, dan storage bucket `receipts` (private).

### Buat Akun & Assign Role

Akun dibuat manual di **Supabase Dashboard**:

1. **Authentication → Users → Add user** (isi email + password).
   Trigger `handle_new_user` otomatis membuat `users_profile` dengan role default `tukang`.
2. Untuk role `admin`/`bos`, jalankan di SQL Editor:
   ```sql
   update public.users_profile
   set full_name = 'Nama Admin', role = 'admin'
   where user_id = '<UUID_USER>';   -- ganti dengan id user dari Dashboard
   ```
   (role `bos` sama, ganti `'admin'` dengan `'bos'`.)

> Semua pengguna baru otomatis ber-role `tukang`. Ubah lewat SQL di atas
> untuk menaikkan role ke admin/bos.

## 2. Environment Variables

Buat file `.env.local` (salin dari `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
```

Dapatkan kedua nilai di Supabase Dashboard → **Project Settings → API**.
`NEXT_PUBLIC_*` aman dipublikasikan (dilindungi oleh RLS di sisi database).

## 3. Menjalankan Lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000 dan login dengan akun yang sudah dibuat.

## 4. Deploy ke Vercel (Sampai Live)

1. Push project ini ke repository GitHub/GitLab.
2. Buka [Vercel](https://vercel.com) → **Add New → Project** → import repo.
3. Framework terdeteksi otomatis: **Next.js**. Biarkan Build Command & Output
   Directory default (menggunakan Turbopack, `output` default).
4. Tambahkan Environment Variables di **Settings → Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (tambahkan ke scope Production, Preview, dan Development)
5. Klik **Deploy**. Setelah selesai, situs live di `https://<nama>.vercel.app`.
6. Setelah live, di Supabase Dashboard **Authentication → URL Configuration**:
   - Site URL: `https://<nama>.vercel.app`
   - Redirect URLs tambahkan: `https://<nama>.vercel.app/**`
   - (untuk development lokal tambahkan juga `http://localhost:3000/**`)

### Setelah Live — Ceklist

- [ ] Buat 1 akun `admin` dan 1 akun `bos` lewat Dashboard, assign role via SQL.
- [ ] Tukang bisa langsung sign up lewat Dashboard (role `tukang`).
- [ ] Upload foto bon → cek bucket `receipts` (private, hanya admin/bos yang bisa lihat).
- [ ] Uji alur: Tukang ajukan → Admin setujui → Admin catat pembelian (upload bon)
      → stok proyek otomatis bertambah → Admin catat pemakaian → stok berkurang.

## Fitur & Logika Bisnis

- **Pencegah Double Buying:** saat tukang submit pengajuan, trigger
  `flag_duplicate_request` mengecek `project_stocks`. Jika stok > 0,
  `is_flagged_duplicate = true` dan badge peringatan tampil di portal admin.
- **Mutasi Stok Otomatis (trigger):**
  - Insert `purchases` → stok proyek bertambah (`add_stock_on_purchase`).
  - Insert `material_usages` → stok proyek berkurang (`reduce_stock_on_usage`,
    menolak jika stok tidak mencukupi).
- **Pelacakan Bon/Nota:** filter "Bon Belum Diterima" vs "Sudah Diterima" di
  `/admin/purchases`, tombol **Upload Bon** untuk mengunggah foto ke Storage.
- **RLS:** setiap query dari aplikasi memakai session user; Supabase menerapkan
  RLS sehingga tukang hanya melihat data miliknya, dan bos read-only.
```
