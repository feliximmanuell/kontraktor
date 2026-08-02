import { AlertTriangle } from 'lucide-react';

/**
 * Badge peringatan "double buying": stok proyek masih tersisa.
 * Kuning jika stok kecil, merah (pulsing) jika stok besar/mencurigakan.
 */
export function StockAlertBadge({
  currentStock,
  unit,
}: {
  currentStock: number;
  unit: string;
}) {
  const big = currentStock >= 10;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        big
          ? 'animate-pulse border-red-300 bg-red-100 text-red-700'
          : 'border-amber-300 bg-amber-100 text-amber-800'
      }`}
    >
      <AlertTriangle className="size-3.5" />
      Peringatan: Stok di proyek masih tersisa {currentStock} {unit}!
    </span>
  );
}
