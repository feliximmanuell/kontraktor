-- ============================================================================
-- SISTEM REKAP PEMBELIAN MATERIAL & MANAJEMEN STOK PROYEK KONTRAKTOR
-- Migration 0004: Hapus fitur stok otomatis, semuanya free-text (rekap murni)
-- - Nama proyek & nama material free text (project_name, material_name)
-- - Qty bebas teks (boleh angka, huruf, satuan, mis. "5 sak", "1 truk")
-- - Total harga pembelian diisi manual (bukan generated)
-- - Hapus tabel project_stocks + trigger/fungsi mutasi stok
-- ============================================================================

-- ---- 1. material_requests: free-text proyek & qty ----
alter table public.material_requests
  drop constraint if exists material_requests_requested_qty_check;

alter table public.material_requests alter column project_id drop not null;
alter table public.material_requests add column project_name text;

update public.material_requests
set project_name = coalesce(
  (select name from public.projects where id = public.material_requests.project_id),
  '-'
)
where project_name is null;

alter table public.material_requests alter column project_name set not null;

alter table public.material_requests alter column requested_qty type text;

alter table public.material_requests
  drop constraint if exists material_requests_project_id_fkey;
alter table public.material_requests
  add constraint material_requests_project_id_fkey
  foreign key (project_id) references public.projects (id) on delete set null;

-- ---- 2. purchases: free-text proyek/material/qty + total harga manual ----
drop trigger if exists add_stock_on_purchase on public.purchases;

alter table public.purchases drop column total_price;
alter table public.purchases drop column unit_price;
alter table public.purchases
  drop constraint if exists purchases_qty_check,
  drop constraint if exists purchases_unit_price_check;

alter table public.purchases alter column qty type text;

alter table public.purchases alter column project_id drop not null;
alter table public.purchases add column project_name text;

alter table public.purchases alter column material_id drop not null;
alter table public.purchases add column material_name text;

update public.purchases
set project_name = coalesce(
  (select name from public.projects where id = public.purchases.project_id),
  '-'
)
where project_name is null;

update public.purchases
set material_name = coalesce(
  (select name from public.materials where id = public.purchases.material_id),
  '-'
)
where material_name is null;

alter table public.purchases alter column project_name set not null;
alter table public.purchases alter column material_name set not null;

alter table public.purchases
  add column total_price numeric(14, 2) not null default 0
  check (total_price >= 0);

alter table public.purchases
  drop constraint if exists purchases_project_id_fkey,
  drop constraint if exists purchases_material_id_fkey;
alter table public.purchases
  add constraint purchases_project_id_fkey
  foreign key (project_id) references public.projects (id) on delete set null;
alter table public.purchases
  add constraint purchases_material_id_fkey
  foreign key (material_id) references public.materials (id) on delete set null;

-- ---- 3. material_usages: free-text proyek/material/qty ----
drop trigger if exists reduce_stock_on_usage on public.material_usages;

alter table public.material_usages
  drop constraint if exists material_usages_qty_used_check;

alter table public.material_usages alter column qty_used type text;

alter table public.material_usages alter column project_id drop not null;
alter table public.material_usages add column project_name text;

alter table public.material_usages alter column material_id drop not null;
alter table public.material_usages add column material_name text;

update public.material_usages
set project_name = coalesce(
  (select name from public.projects where id = public.material_usages.project_id),
  '-'
)
where project_name is null;

update public.material_usages
set material_name = coalesce(
  (select name from public.materials where id = public.material_usages.material_id),
  '-'
)
where material_name is null;

alter table public.material_usages alter column project_name set not null;
alter table public.material_usages alter column material_name set not null;

alter table public.material_usages
  drop constraint if exists material_usages_project_id_fkey,
  drop constraint if exists material_usages_material_id_fkey;
alter table public.material_usages
  add constraint material_usages_project_id_fkey
  foreign key (project_id) references public.projects (id) on delete set null;
alter table public.material_usages
  add constraint material_usages_material_id_fkey
  foreign key (material_id) references public.materials (id) on delete set null;

-- ---- 4. Hapus fitur stok otomatis ----
drop trigger if exists flag_duplicate_request on public.material_requests;

drop function if exists public.add_stock_on_purchase();
drop function if exists public.reduce_stock_on_usage();
drop function if exists public.flag_duplicate_request();

drop table if exists public.project_stocks;
