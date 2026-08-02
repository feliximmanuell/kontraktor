-- ============================================================================
-- SISTEM REKAP PEMBELIAN MATERIAL & MANAJEMEN STOK PROYEK KONTRAKTOR
-- Migration 0005: Fitur stok berbasis nama material (free text)
-- - Tabel material_stocks (kunci = material_name text, bukan id)
-- - Pembelian menambah stok, pemakaian mengurangi stok (dengan cek kecukupan)
-- - Angka stok diekstrak dari teks qty (mis. "5 sak" -> 5, "1/2 truk" -> 0.5)
-- - Material baru otomatis muncul di stok saat pertama kali dibeli
-- ============================================================================

-- ---- 1. Helper parsing qty & unit dari teks bebas ----
create or replace function public.parse_qty(qty text)
returns numeric
language plpgsql
immutable
as $$
declare
  m text[];
  v numeric;
begin
  m := regexp_match(qty, '^\s*(\d+(?:[.,]\d+)?)(?:\s*/\s*(\d+))?');
  if m is null then
    return 0;
  end if;
  v := replace(m[1], ',', '.')::numeric;
  if m[2] is not null and m[2]::numeric > 0 then
    v := v / m[2]::numeric;
  end if;
  return v;
end;
$$;

create or replace function public.parse_unit(qty text)
returns text
language sql
immutable
as $$
  select case
    when qty ~ '^\s*\d+(?:[.,]\d+)?(?:\s*/\s*\d+)?\s+' then
      trim(substring(qty from '^\s*\d+(?:[.,]\d+)?(?:\s*/\s*\d+)?\s+(.*)$'))
    else ''
  end;
$$;

-- ---- 2. Tabel stok material ----
create table public.material_stocks (
  id uuid primary key default gen_random_uuid(),
  material_name text not null unique,
  current_stock numeric(14, 2) not null default 0,
  unit text not null default '',
  updated_at timestamptz not null default now()
);

-- ---- 3. Pembelian menambah stok ----
create or replace function public.add_stock_on_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty numeric := public.parse_qty(new.qty);
  v_unit text := public.parse_unit(new.qty);
begin
  if v_qty > 0 then
    insert into public.material_stocks (material_name, current_stock, unit)
    values (new.material_name, v_qty, v_unit)
    on conflict (material_name)
    do update set
      current_stock = public.material_stocks.current_stock + excluded.current_stock,
      unit = case
        when excluded.unit <> '' then excluded.unit
        else public.material_stocks.unit
      end,
      updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists add_stock_on_purchase on public.purchases;
create trigger add_stock_on_purchase
  after insert on public.purchases
  for each row execute function public.add_stock_on_purchase();

-- ---- 4. Pemakaian mengurangi stok (tolak jika tidak cukup / belum tercatat) ----
create or replace function public.reduce_stock_on_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty numeric := public.parse_qty(new.qty_used);
  v_current numeric;
begin
  if v_qty <= 0 then
    return new;
  end if;

  select current_stock into v_current
  from public.material_stocks
  where material_name = new.material_name
  for update;

  if v_current is null then
    raise exception 'Material "%" belum tercatat di stok', new.material_name;
  end if;

  if v_current < v_qty then
    raise exception 'Stok "%" tidak mencukupi. Tersedia %', new.material_name, v_current;
  end if;

  update public.material_stocks
  set current_stock = current_stock - v_qty,
      updated_at = now()
  where material_name = new.material_name;

  return new;
end;
$$;

drop trigger if exists reduce_stock_on_usage on public.material_usages;
create trigger reduce_stock_on_usage
  after insert on public.material_usages
  for each row execute function public.reduce_stock_on_usage();

-- ---- 5. RLS ----
alter table public.material_stocks enable row level security;

create policy "stocks_select_all"
  on public.material_stocks for select
  using (true);

create policy "stocks_admin_write"
  on public.material_stocks for all
  using (public.is_admin()) with check (public.is_admin());
