-- ============================================================================
-- SISTEM REKAP PEMBELIAN MATERIAL & MANAJEMEN STOK PROYEK KONTRAKTOR
-- Migration 0006: Delete pembelian/pemakaian + pengembalian stok
-- - Hapus pembelian -> stok dikurangi (batalkan penambahan)
-- - Hapus pemakaian -> stok dikembalikan
-- ============================================================================

-- Pembelian dihapus: kembalikan stok seperti sebelum pembelian.
create or replace function public.remove_stock_on_purchase_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty numeric := public.parse_qty(old.qty);
begin
  if v_qty > 0 then
    update public.material_stocks
    set current_stock = greatest(current_stock - v_qty, 0),
        updated_at = now()
    where material_name = old.material_name;
  end if;
  return old;
end;
$$;

drop trigger if exists remove_stock_on_purchase_delete on public.purchases;
create trigger remove_stock_on_purchase_delete
  after delete on public.purchases
  for each row execute function public.remove_stock_on_purchase_delete();

-- Pemakaian dihapus: kembalikan stok yang sudah dipakai.
create or replace function public.restore_stock_on_usage_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty numeric := public.parse_qty(old.qty_used);
begin
  if v_qty > 0 then
    update public.material_stocks
    set current_stock = current_stock + v_qty,
        updated_at = now()
    where material_name = old.material_name;
  end if;
  return old;
end;
$$;

drop trigger if exists restore_stock_on_usage_delete on public.material_usages;
create trigger restore_stock_on_usage_delete
  after delete on public.material_usages
  for each row execute function public.restore_stock_on_usage_delete();
