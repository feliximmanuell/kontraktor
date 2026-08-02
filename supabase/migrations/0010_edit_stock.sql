-- ============================================================================
-- SISTEM REKAP PEMBELIAN MATERIAL & MANAJEMEN STOK PROYEK KONTRAKTOR
-- Migration 0010: Update stok saat pembelian / pemakaian diedit
-- - Edit pembelian: selisih qty baru - qty lama ditambahkan ke stok
--   (jika material berubah, stok material lama dikurangi, yang baru ditambah).
-- - Edit pemakaian: selisih qty lama - qty baru dikembalikan ke stok, dengan
--   cek kecukupan jika material/jumlah berubah.
-- ============================================================================

-- ---- 1. Edit pembelian menyesuaikan stok ----
create or replace function public.adjust_stock_on_purchase_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_qty numeric := public.parse_qty(old.qty);
  v_new_qty numeric := public.parse_qty(new.qty);
  v_new_unit text := public.parse_unit(new.qty);
begin
  -- Material berubah: kurangi stok lama, tambah stok material baru.
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
    -- Material sama: tambahkan selisih (baru - lama) ke stok.
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

drop trigger if exists adjust_stock_on_purchase_update on public.purchases;
create trigger adjust_stock_on_purchase_update
  after update on public.purchases
  for each row execute function public.adjust_stock_on_purchase_update();

-- ---- 2. Edit pemakaian menyesuaikan stok ----
create or replace function public.adjust_stock_on_usage_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_qty numeric := public.parse_qty(old.qty_used);
  v_new_qty numeric := public.parse_qty(new.qty_used);
  v_current numeric;
begin
  -- Material berubah: kembalikan stok lama, kurangi stok material baru.
  if old.material_name is distinct from new.material_name then
    if v_old_qty > 0 then
      update public.material_stocks
      set current_stock = current_stock + v_old_qty,
          updated_at = now()
      where material_name = old.material_name;
    end if;
    if v_new_qty > 0 then
      select current_stock into v_current
      from public.material_stocks
      where material_name = new.material_name
      for update;
      if v_current is null then
        raise exception 'Material "%" belum tercatat di stok', new.material_name;
      end if;
      if v_current < v_new_qty then
        raise exception 'Stok "%" tidak mencukupi. Tersedia %', new.material_name, v_current;
      end if;
      update public.material_stocks
      set current_stock = current_stock - v_new_qty,
          updated_at = now()
      where material_name = new.material_name;
    end if;
  else
    -- Material sama: kembalikan selisih lama - baru.
    if v_old_qty <> v_new_qty then
      if v_new_qty > v_old_qty then
        select current_stock into v_current
        from public.material_stocks
        where material_name = new.material_name
        for update;
        if v_current is null then
          raise exception 'Material "%" belum tercatat di stok', new.material_name;
        end if;
        if v_current + v_old_qty < v_new_qty then
          raise exception 'Stok "%" tidak mencukupi. Tersedia %', new.material_name, v_current + v_old_qty;
        end if;
      end if;
      update public.material_stocks
      set current_stock = current_stock + v_old_qty - v_new_qty,
          updated_at = now()
      where material_name = new.material_name;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists adjust_stock_on_usage_update on public.material_usages;
create trigger adjust_stock_on_usage_update
  after update on public.material_usages
  for each row execute function public.adjust_stock_on_usage_update();
