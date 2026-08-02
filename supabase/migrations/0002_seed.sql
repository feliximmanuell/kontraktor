-- ============================================================================
-- SISTEM REKAP PEMBELIAN MATERIAL & MANAJEMEN STOK PROYEK KONTRAKTOR
-- Migration 0002: Seed data (master material & contoh proyek)
-- ============================================================================

-- ---- Master material ----
insert into public.materials (name, unit, category) values
  ('Semen 50kg', 'sak', 'Bahan Bangunan'),
  ('Pasir', 'm3', 'Bahan Bangunan'),
  ('Batu Bata', 'buah', 'Bahan Bangunan'),
  ('Besi Beton 10mm', 'batang', 'Struktur'),
  ('Besi Beton 8mm', 'batang', 'Struktur'),
  ('Paku 5cm', 'kg', 'Peralatan'),
  ('Triplek 9mm', 'lembar', 'Kayu'),
  ('Cat Tembok 25kg', 'kaleng', 'Finishing'),
  ('Keramik 40x40', 'dus', 'Finishing')
on conflict do nothing;

-- ---- Contoh proyek ----
insert into public.projects (name, location, status) values
  ('Rumah Pak Haji Jamil', 'Jl. Melati No.12, Jakarta Timur', 'active'),
  ('Ruko 2 Lantai', 'Jl. Sudirman No.8, Bekasi', 'active'),
  ('Renovasi Masjid', 'Kampung Sawah, Depok', 'active')
on conflict do nothing;

-- ============================================================================
-- PETUNJUK ASSIGN ROLE (dijalankan MANUAL setelah akun dibuat di Dashboard)
-- ============================================================================
-- 1. Buat user di Supabase Dashboard > Authentication > Users (Add user).
--    Trigger handle_new_user otomatis membuat baris di users_profile role 'tukang'.
-- 2. Cari user_id dari user tsb, lalu jalankan:
--
--    update public.users_profile
--    set full_name = 'Budi (Admin)', role = 'admin'
--    where user_id = '<UUID_USER>';
--
--    update public.users_profile
--    set full_name = 'Pak Bos', role = 'bos'
--    where user_id = '<UUID_USER>';
--
-- 3. Selesai. User bisa langsung login di /login.
-- ============================================================================
