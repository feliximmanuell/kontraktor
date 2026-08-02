-- ============================================================================
-- SISTEM REKAP PEMBELIAN MATERIAL & MANAJEMEN STOK PROYEK KONTRAKTOR
-- Migration 0001: Enums, Tables, Indexes, Triggers, RLS, Storage
-- Jalankan seluruh file ini di Supabase SQL Editor.
-- ============================================================================

-- ============================================================================
-- 1. ENUMS
-- ============================================================================
create type public.user_role as enum ('tukang', 'admin', 'bos');
create type public.project_status as enum ('active', 'completed');
create type public.request_status as enum ('pending', 'approved', 'rejected');
create type public.receipt_status as enum ('pending', 'received');

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- Profil pengguna, terhubung ke auth.users
create table public.users_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text not null default 'Pengguna',
  role public.user_role not null default 'tukang',
  created_at timestamptz not null default now()
);

-- Daftar proyek
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  status public.project_status not null default 'active',
  created_at timestamptz not null default now()
);

-- Master daftar material
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null,
  category text,
  created_at timestamptz not null default now()
);

-- Sisa stok aktual per proyek per material
create table public.project_stocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  current_stock numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (project_id, material_id)
);

-- Pengajuan material dari tukang
create table public.material_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  requester_id uuid not null references auth.users (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  requested_qty numeric(12, 2) not null check (requested_qty > 0),
  notes text,
  status public.request_status not null default 'pending',
  is_flagged_duplicate boolean not null default false,
  created_at timestamptz not null default now()
);

-- Catatan pembelian
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.material_requests (id) on delete set null,
  project_id uuid not null references public.projects (id) on delete restrict,
  material_id uuid not null references public.materials (id) on delete restrict,
  store_name text not null,
  qty numeric(12, 2) not null check (qty > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  total_price numeric(14, 2) generated always as (qty * unit_price) stored,
  receipt_status public.receipt_status not null default 'pending',
  receipt_image_url text,
  purchased_by uuid references auth.users (id) on delete set null,
  purchased_at timestamptz not null default now()
);

-- Log pemakaian material di lapangan
create table public.material_usages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  qty_used numeric(12, 2) not null check (qty_used > 0),
  used_for text not null check (length(btrim(used_for)) > 0),
  logged_by uuid references auth.users (id) on delete set null,
  used_at timestamptz not null default now()
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================
create index idx_projects_status on public.projects (status);
create index idx_materials_category on public.materials (category);
create index idx_stocks_project on public.project_stocks (project_id);
create index idx_stocks_material on public.project_stocks (material_id);
create index idx_requests_status on public.material_requests (status);
create index idx_requests_requester on public.material_requests (requester_id);
create index idx_requests_project on public.material_requests (project_id);
create index idx_requests_created on public.material_requests (created_at desc);
create index idx_purchases_request on public.purchases (request_id);
create index idx_purchases_project_date on public.purchases (project_id, purchased_at desc);
create index idx_purchases_receipt_status on public.purchases (receipt_status);
create index idx_purchases_bought_by on public.purchases (purchased_by);
create index idx_usages_project_date on public.material_usages (project_id, used_at desc);
create index idx_usages_material on public.material_usages (material_id);

-- ============================================================================
-- 4. TRIGGERS & LOGIKA MUTASI STOK OTOMATIS
-- ============================================================================

-- 4a. Otomatis buat users_profile saat user baru sign up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users_profile (user_id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'Pengguna'),
    'tukang'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4b. PENCEGAH DOUBLE BUYING: saat tukang submit pengajuan,
--     cek sisa stok di project_stocks. Jika stok > 0, flag is_flagged_duplicate = true.
create or replace function public.flag_duplicate_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock numeric;
begin
  select current_stock into v_stock
  from public.project_stocks
  where project_id = new.project_id and material_id = new.material_id;

  new.is_flagged_duplicate := coalesce(v_stock, 0) > 0;
  return new;
end;
$$;

drop trigger if exists flag_duplicate_request on public.material_requests;
create trigger flag_duplicate_request
  before insert on public.material_requests
  for each row execute function public.flag_duplicate_request();

-- 4c. Saat purchases baru di-submit, stok proyek OTOMATIS bertambah.
create or replace function public.add_stock_on_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_stocks (project_id, material_id, current_stock)
  values (new.project_id, new.material_id, new.qty)
  on conflict (project_id, material_id)
  do update set
    current_stock = public.project_stocks.current_stock + excluded.current_stock,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists add_stock_on_purchase on public.purchases;
create trigger add_stock_on_purchase
  after insert on public.purchases
  for each row execute function public.add_stock_on_purchase();

-- 4d. Saat material_usages di-submit, stok proyek OTOMATIS berkurang.
--     Menolak pencatatan jika stok tidak mencukupi.
create or replace function public.reduce_stock_on_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current numeric;
  v_unit text;
begin
  select current_stock into v_current
  from public.project_stocks
  where project_id = new.project_id and material_id = new.material_id
  for update;

  select unit into v_unit from public.materials where id = new.material_id;

  if v_current is null then
    raise exception 'Stok material ini belum tercatat untuk proyek tersebut';
  end if;

  if v_current < new.qty_used then
    raise exception 'Stok tidak mencukupi. Tersedia %, dipakai %', v_current, new.qty_used;
  end if;

  update public.project_stocks
  set current_stock = current_stock - new.qty_used,
      updated_at = now()
  where project_id = new.project_id and material_id = new.material_id;

  return new;
end;
$$;

drop trigger if exists reduce_stock_on_usage on public.material_usages;
create trigger reduce_stock_on_usage
  after insert on public.material_usages
  for each row execute function public.reduce_stock_on_usage();

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================
alter table public.users_profile enable row level security;
alter table public.projects enable row level security;
alter table public.materials enable row level security;
alter table public.project_stocks enable row level security;
alter table public.material_requests enable row level security;
alter table public.purchases enable row level security;
alter table public.material_usages enable row level security;

-- Helper cek role. SECURITY DEFINER agar tidak rekursif dgn RLS users_profile.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.users_profile where user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_bos()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.users_profile where user_id = auth.uid() and role = 'bos');
$$;

create or replace function public.is_admin_or_bos()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (public.is_admin() or public.is_bos());
$$;

-- ---- users_profile ----
create policy "users_profile_select_own_or_staff"
  on public.users_profile for select
  using (auth.uid() = user_id or public.is_admin_or_bos());

create policy "users_profile_insert_own"
  on public.users_profile for insert
  with check (auth.uid() = user_id);

create policy "users_profile_update_own"
  on public.users_profile for update
  using (auth.uid() = user_id);

create policy "users_profile_admin_all"
  on public.users_profile for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- projects ----
create policy "projects_select_authenticated"
  on public.projects for select
  using (auth.role() = 'authenticated');

create policy "projects_admin_write"
  on public.projects for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- materials ----
create policy "materials_select_authenticated"
  on public.materials for select
  using (auth.role() = 'authenticated');

create policy "materials_admin_write"
  on public.materials for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- project_stocks ----
create policy "stocks_select_authenticated"
  on public.project_stocks for select
  using (auth.role() = 'authenticated');

create policy "stocks_admin_write"
  on public.project_stocks for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- material_requests ----
create policy "requests_insert_own"
  on public.material_requests for insert
  with check (auth.uid() = requester_id);

create policy "requests_select_own_or_staff"
  on public.material_requests for select
  using (auth.uid() = requester_id or public.is_admin_or_bos());

create policy "requests_admin_update"
  on public.material_requests for update
  using (public.is_admin());

create policy "requests_admin_delete"
  on public.material_requests for delete
  using (public.is_admin());

-- ---- purchases ----
create policy "purchases_select_staff"
  on public.purchases for select
  using (public.is_admin_or_bos());

create policy "purchases_admin_insert"
  on public.purchases for insert
  with check (public.is_admin());

create policy "purchases_admin_update"
  on public.purchases for update
  using (public.is_admin());

create policy "purchases_admin_delete"
  on public.purchases for delete
  using (public.is_admin());

-- ---- material_usages ----
create policy "usages_select_staff"
  on public.material_usages for select
  using (public.is_admin_or_bos());

create policy "usages_admin_insert"
  on public.material_usages for insert
  with check (public.is_admin());

create policy "usages_admin_delete"
  on public.material_usages for delete
  using (public.is_admin());

-- ============================================================================
-- 6. STORAGE: Bucket 'receipts' untuk foto bon / nota
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy "receipts_select_owner_or_staff"
  on storage.objects for select
  using (bucket_id = 'receipts' and (auth.uid() = owner or public.is_admin_or_bos()));

create policy "receipts_insert_admin"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and public.is_admin());

create policy "receipts_update_admin"
  on storage.objects for update
  using (bucket_id = 'receipts' and public.is_admin());

create policy "receipts_delete_admin"
  on storage.objects for delete
  using (bucket_id = 'receipts' and public.is_admin());
