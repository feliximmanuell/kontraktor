import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { StockManager } from '@/components/admin/stock-manager';
import type { MaterialStock } from '@/lib/types';

export default async function AdminStockPage() {
  const profile = await requireRole(['admin', 'bos']);
  const supabase = await createClient();

  const { data } = await supabase
    .from('material_stocks')
    .select('id, material_name, current_stock, unit, updated_at')
    .order('material_name');

  return (
    <StockManager stocks={(data ?? []) as unknown as MaterialStock[]} isAdmin={profile.role === 'admin'} />
  );
}
