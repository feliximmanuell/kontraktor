-- ============================================================================
-- SISTEM REKAP PEMBELIAN MATERIAL & MANAJEMEN STOK PROYEK KONTRAKTOR
-- Migration 0003: Pengajuan publik tanpa akun + nama material bebas (free text)
-- - requester_id & material_id boleh NULL
-- - kolom baru material_name (wajib, teks bebas)
-- - RLS: siapapun (anon) boleh insert pengajuan
-- - Trigger flag_duplicate_request aman saat material_id NULL
-- ============================================================================

-- ---- 1. Kolom bisa NULL ----
alter table public.material_requests alter column requester_id drop not null;
alter table public.material_requests alter column material_id drop not null;

-- ---- 2. Kolom material_name (teks bebas) ----
alter table public.material_requests add column material_name text;

update public.material_requests
set material_name = coalesce(
  (select name from public.materials where id = public.material_requests.material_id),
  '-'
)
where material_name is null;

alter table public.material_requests alter column material_name set not null;

-- ---- 3. FK lebih aman: set null (jangan hapus pengajuan saat user/material dihapus) ----
alter table public.material_requests
  drop constraint if exists material_requests_requester_id_fkey,
  drop constraint if exists material_requests_material_id_fkey;

alter table public.material_requests
  add constraint material_requests_requester_id_fkey
  foreign key (requester_id) references auth.users (id) on delete set null;

alter table public.material_requests
  add constraint material_requests_material_id_fkey
  foreign key (material_id) references public.materials (id) on delete set null;

-- ---- 4. Trigger: aman untuk material_id NULL (tidak bisa cek stok) ----
create or replace function public.flag_duplicate_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock numeric;
begin
  if new.material_id is null then
    new.is_flagged_duplicate := false;
    return new;
  end if;

  select current_stock into v_stock
  from public.project_stocks
  where project_id = new.project_id and material_id = new.material_id;

  new.is_flagged_duplicate := coalesce(v_stock, 0) > 0;
  return new;
end;
$$;

-- ---- 5. RLS: publik (anon) boleh mengajukan, user login boleh isi atas nama sendiri ----
drop policy if exists "requests_insert_own" on public.material_requests;

create policy "requests_insert_anyone"
  on public.material_requests for insert
  with check (requester_id is null or auth.uid() = requester_id);
