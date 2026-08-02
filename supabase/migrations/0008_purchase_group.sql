-- ============================================================================
-- SISTEM REKAP PEMBELIAN MATERIAL & MANAJEMEN STOK PROYEK KONTRAKTOR
-- Migration 0008: Group pembelian
-- - Kolom purchases.purchase_group menandai item-item dalam satu transaksi
--   pembelian (mis. 1 pembelian berisi 3 item) agar bisa dibayar sekaligus.
--   Baris lama otomatis mendapat group unik masing-masing (jadi satu item
--   = satu group) karena default gen_random_uuid() dievaluasi per baris.
-- ============================================================================

alter table public.purchases
  add column purchase_group uuid not null default gen_random_uuid();

create index idx_purchases_group on public.purchases (purchase_group);
