-- ============================================================================
-- SISTEM REKAP PEMBELIAN MATERIAL & MANAJEMEN STOK PROYEK KONTRAKTOR
-- Migration 0009: Cashflow / jurnal pemasukan
-- - Tabel cashflow mencatat pemasukan (income). Pengeluaran tetap mengalir
--   dari tabel payments, keduanya digabung tampil sebagai jurnal di halaman
--   Cashflow.
-- ============================================================================

create table public.cashflow (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  project_name text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  entry_date timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_cashflow_entry_date on public.cashflow (entry_date desc);
create index idx_cashflow_project on public.cashflow (project_name);

alter table public.cashflow enable row level security;

create policy "cashflow_select_staff"
  on public.cashflow for select
  using (public.is_admin_or_bos());

create policy "cashflow_admin_insert"
  on public.cashflow for insert
  with check (public.is_admin());

create policy "cashflow_admin_update"
  on public.cashflow for update
  using (public.is_admin());

create policy "cashflow_admin_delete"
  on public.cashflow for delete
  using (public.is_admin());
