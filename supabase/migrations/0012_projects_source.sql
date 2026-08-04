-- ============================================================================
-- SISTEM REKAP PEMBELIAN MATERIAL & MANAJEMEN STOK PROYEK KONTRAKTOR
-- Migration 0012: Tabel `projects` menjadi sumber daftar proyek
-- - Unique index pada projects.name (nama proyek = identifier)
-- - Backfill projects dari nama proyek yang sudah dipakai di tabel transaksi
-- - Trigger ensure_project_exists: nama proyek baru yang dipakai di form
--   otomatis didaftarkan ke projects (jadi proyek tidak pernah "hilang")
-- ============================================================================

-- ---- 1. Unique index nama proyek ----
-- Rapikan nama yang cuma whitespace / tanda placeholder lalu dedupe agar
-- unique index bisa dibuat aman.
update public.projects
set name = btrim(name)
where name <> btrim(name);

delete from public.projects a
using public.projects b
where a.id <> b.id
  and a.name = b.name
  and a.created_at > b.created_at;

create unique index if not exists projects_name_key on public.projects (name);

-- ---- 2. Backfill dari nama proyek yang sudah terpakai di transaksi ----
insert into public.projects (name)
select distinct trim(pn) as name
from (
  select material_requests.project_name as pn from public.material_requests
  union all
  select purchases.project_name from public.purchases
  union all
  select material_usages.project_name from public.material_usages
  union all
  select payments.project_name from public.payments
  union all
  select cashflow.project_name from public.cashflow
) t
where trim(pn) <> ''
  and trim(pn) <> '-'
  and trim(pn) <> '__none__'
on conflict (name) do nothing;

-- ---- 3. Trigger: pastikan proyek terdaftar saat nama baru dipakai ----
create or replace function public.ensure_project_exists()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.project_name is not null and btrim(new.project_name) not in ('', '-', '__none__') then
    insert into public.projects (name)
    values (btrim(new.project_name))
    on conflict (name) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_project_exists on public.material_requests;
create trigger ensure_project_exists
  before insert on public.material_requests
  for each row execute function public.ensure_project_exists();

drop trigger if exists ensure_project_exists on public.purchases;
create trigger ensure_project_exists
  before insert on public.purchases
  for each row execute function public.ensure_project_exists();

drop trigger if exists ensure_project_exists on public.material_usages;
create trigger ensure_project_exists
  before insert on public.material_usages
  for each row execute function public.ensure_project_exists();

drop trigger if exists ensure_project_exists on public.payments;
create trigger ensure_project_exists
  before insert on public.payments
  for each row execute function public.ensure_project_exists();

drop trigger if exists ensure_project_exists on public.cashflow;
create trigger ensure_project_exists
  before insert on public.cashflow
  for each row execute function public.ensure_project_exists();
