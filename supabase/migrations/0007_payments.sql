-- ============================================================================
-- SISTEM REKAP PEMBELIAN MATERIAL & MANAJEMEN STOK PROYEK KONTRAKTOR
-- Migration 0007: Pembayaran & pengeluaran manual
-- - Tabel payments (ledger pengeluaran): pembayaran pembelian / manual
-- - Kolom purchases.paid untuk menandai pembelian yang sudah dibayar
-- ============================================================================

-- ---- 1. Enum & tabel pembayaran ----
create type public.payment_type as enum ('purchase', 'manual');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_type public.payment_type not null default 'manual',
  purchase_id uuid references public.purchases (id) on delete set null,
  description text not null,
  project_name text not null,
  material_name text,
  amount numeric(14, 2) not null check (amount >= 0),
  paid_at timestamptz not null default now(),
  paid_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_payments_paid_at on public.payments (paid_at desc);
create index idx_payments_project on public.payments (project_name);
create index idx_payments_material on public.payments (material_name);
create index idx_payments_type on public.payments (payment_type);
create index idx_payments_purchase on public.payments (purchase_id);

-- ---- 2. Tandai pembelian yang sudah dibayar ----
alter table public.purchases add column paid boolean not null default false;

-- ---- 3. RLS ----
alter table public.payments enable row level security;

create policy "payments_select_staff"
  on public.payments for select
  using (public.is_admin_or_bos());

create policy "payments_admin_insert"
  on public.payments for insert
  with check (public.is_admin());

create policy "payments_admin_update"
  on public.payments for update
  using (public.is_admin());

create policy "payments_admin_delete"
  on public.payments for delete
  using (public.is_admin());
