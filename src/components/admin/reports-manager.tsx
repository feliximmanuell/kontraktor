'use client';

import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { formatIDR, formatDateTime } from '@/lib/format';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportRow } from '@/lib/types';

export function ReportsManager({ rows }: { rows: ReportRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalOut = rows.reduce((acc, r) => {
    if (r.kind === 'income') return acc;
    return acc + (r.kind === 'group' ? r.total : r.amount);
  }, 0);
  const totalIn = rows
    .filter((r) => r.kind === 'income')
    .reduce((acc, r) => acc + r.amount, 0);
  const totalPurchase = rows
    .filter((r) => r.kind === 'group')
    .reduce((acc, r) => acc + r.total, 0);
  const totalManual = rows
    .filter((r) => r.kind === 'manual')
    .reduce((acc, r) => acc + r.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs font-medium text-muted-foreground">Total Pemasukan</p>
          <p className="text-lg font-semibold text-green-700">{formatIDR(totalIn)}</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs font-medium text-muted-foreground">Total Pengeluaran</p>
          <p className="text-lg font-semibold text-destructive">{formatIDR(totalOut)}</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs font-medium text-muted-foreground">Saldo</p>
          <p className="text-lg font-semibold">{formatIDR(totalIn - totalOut)}</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs font-medium text-muted-foreground">Pembelian vs Manual</p>
          <p className="text-lg font-semibold">
            <span className="text-blue-700">{formatIDR(totalPurchase)}</span>
            <span className="mx-1 text-muted-foreground">/</span>
            <span className="text-purple-700">{formatIDR(totalManual)}</span>
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Tidak ada data"
          description="Sesuaikan filter atau catat transaksi terlebih dahulu."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="w-10 px-2 py-3" />
                <th className="px-2 py-3 font-medium">Tanggal</th>
                <th className="px-4 py-3 font-medium">Proyek</th>
                <th className="px-4 py-3 font-medium">Toko</th>
                <th className="px-4 py-3 font-medium">Material</th>
                <th className="px-4 py-3 font-medium">Keterangan</th>
                <th className="px-4 py-3 font-medium">Tipe</th>
                <th className="px-4 py-3 text-right font-medium">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isOpen = expanded.has(r.id);
                return (
                  <RowGroup key={r.id} row={r} isOpen={isOpen} onToggle={() => toggle(r.id)} />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RowGroup({
  row,
  isOpen,
  onToggle,
}: {
  row: ReportRow;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const isGroup = row.kind === 'group';
  const isIncome = row.kind === 'income';
  return (
    <>
      <tr
        className={cn('border-b last:border-0', isGroup && isOpen && 'border-transparent bg-muted/30')}
      >
        <td className="px-2 py-3">
          {isGroup ? (
            <button
              type="button"
              onClick={onToggle}
              aria-label={isOpen ? 'Tutup rincian' : 'Lihat rincian'}
              className="inline-flex rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronDown
                className={cn('size-4 transition-transform', isOpen && 'rotate-180')}
              />
            </button>
          ) : (
            <ChevronRight className="size-4 text-muted-foreground/30" />
          )}
        </td>
        <td className="whitespace-nowrap px-2 py-3 text-muted-foreground">
          {formatDateTime(isIncome ? row.entry_date : row.paid_at)}
        </td>
        <td className="px-4 py-3 font-medium">{row.project_name}</td>
        <td className="px-4 py-3 text-muted-foreground">
          {isGroup ? (row.store_name ?? '-') : '-'}
        </td>
        <td className="px-4 py-3">
          {isGroup ? `${row.items.length} item` : isIncome ? '-' : (row.material_name ?? '-')}
        </td>
        <td className="px-4 py-3">{row.description}</td>
        <td className="px-4 py-3">
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
              isGroup
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : isIncome
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : 'border-purple-300 bg-purple-50 text-purple-700'
            )}
          >
            {isGroup ? 'Pembelian' : isIncome ? 'Pemasukan' : 'Manual'}
          </span>
        </td>
        <td className="px-4 py-3 text-right font-semibold">
          <span className={isIncome ? 'text-green-700' : undefined}>
            {formatIDR(isGroup ? row.total : row.amount)}
          </span>
        </td>
      </tr>
      {isGroup && isOpen ? (
        <tr className="border-b bg-muted/30 last:border-0">
          <td colSpan={8} className="px-10 py-3">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-2 font-medium">Material</th>
                  <th className="py-1 pr-2 text-right font-medium">Qty</th>
                  <th className="py-1 pr-2 font-medium">Satuan</th>
                  <th className="py-1 text-right font-medium">Jumlah Dibayar</th>
                </tr>
              </thead>
              <tbody>
                {row.items.map((it, i) => (
                  <tr key={`${row.id}-${i}`} className="border-b last:border-0">
                    <td className="py-1.5 pr-2 font-medium">{it.material_name}</td>
                    <td className="py-1.5 pr-2 text-right">{it.qty || '-'}</td>
                    <td className="py-1.5 pr-2">{it.unit || '-'}</td>
                    <td className="py-1.5 text-right font-medium">{formatIDR(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      ) : null}
    </>
  );
}
