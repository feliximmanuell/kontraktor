import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Hitung total pembelian: subtotal = qty x harga satuan,
 * potongan = subtotal x diskon% / 100, total = subtotal - potongan.
 */
export function computePurchaseTotal(
  qty: number,
  unitPrice: number,
  discountPercent: number
): number {
  const price = Number(unitPrice) || 0;
  const q = Number(qty) || 0;
  const disc = Number(discountPercent) || 0;
  const subtotal = q * price;
  const discount = subtotal * (clamp(disc, 0, 100) / 100);
  return round2(subtotal - discount);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
