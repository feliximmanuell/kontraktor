-- ============================================================================
-- Migration 0011: Nama pengaju pada pengajuan material publik
-- - Kolom baru requester_name (teks), mencatat nama orang yang mengajukan
--   dari form publik (tanpa login).
-- ============================================================================

alter table public.material_requests add column requester_name text;

comment on column public.material_requests.requester_name is
  'Nama orang yang mengajukan, khusus pengajuan publik tanpa akun.';