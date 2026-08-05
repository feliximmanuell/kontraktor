-- ============================================================================
-- SISTEM REKAP PEMBELIAN MATERIAL & MANAJEMEN STOK PROYEK KONTRAKTOR
-- Migration 0013: Satuan wajib, harga satuan + diskon %, nama toko di ledger
-- - material_requests.unit  : satuan wajib (free text)
-- - purchases.unit          : satuan wajib (free text)
-- - purchases.unit_price    : harga per satuan
-- - purchases.discount_percent : diskon dalam persen (opsional, 0-100)
-- - total_price dihitung di aplikasi: (qty x harga) - diskon
-- - payments.store_name     : nama toko (diisi saat pembayaran pembelian)
-- - Trigger stok memakai purchases.unit (bukan parse_unit dari qty)
-- ============================================================================

-- ---- 1. material_requests: kolom satuan ----
alter table public.material_requests
  add column unit text not null default '';

-- ---- 2. purchases: satuan, harga satuan, diskon ----
alter table public.purchases
  add column unit text not null default '';

alter table public.purchases
  add column unit_price numeric(14, 2) not null default 0
  check (unit_price >= 0);

alter table public.purchases
  add column discount_percent numeric(5, 2) not null default 0
  check (discount_percent >= 0 and discount_percent <= 100);

-- Backfill satuan lama dari teks qty (mis. "5 sak" -> "sak").
update public.purchases
set unit = coalesce(nullif(public.parse_unit(qty), ''), 'pcs')
where unit = '';

-- ---- 3. payments: nama toko ----
alter table public.payments
  add column store_name text;

-- ---- 4. Trigger stok: baca satuan dari kolom unit (bukan parse dari qty) ----
create or replace function public.add_stock_on_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty numeric := public.parse_qty(new.qty);
  v_unit text := coalesce(nullif(new.unit, ''), public.parse_unit(new.qty));
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

create or replace function public.adjust_stock_on_purchase_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_qty numeric := public.parse_qty(old.qty);
  v_new_qty numeric := public.parse_qty(new.qty);
  v_new_unit text := coalesce(nullif(new.unit, ''), public.parse_unit(new.qty));
begin
  if old.material_name is distinct from new.material_name then
    if v_old_qty > 0 then
      update public.material_stocks
      set current_stock = greatest(current_stock - v_old_qty, 0),
          updated_at = now()
      where material_name = old.material_name;
    end if;
    if v_new_qty > 0 then
      insert into public.material_stocks (material_name, current_stock, unit)
      values (new.material_name, v_new_qty, v_new_unit)
      on conflict (material_name)
      do update set
        current_stock = public.material_stocks.current_stock + excluded.current_stock,
        unit = case when excluded.unit <> '' then excluded.unit else public.material_stocks.unit end,
        updated_at = now();
    end if;
  else
    if v_old_qty <> v_new_qty then
      update public.material_stocks
      set current_stock = greatest(current_stock - v_old_qty + v_new_qty, 0),
          unit = case when v_new_unit <> '' then v_new_unit else unit end,
          updated_at = now()
      where material_name = new.material_name;
    end if;
  end if;
  return new;
end;
$$;