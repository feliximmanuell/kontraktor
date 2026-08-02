'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { adjustStock } from '@/lib/actions/stocks';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, PencilLine } from 'lucide-react';
import type { MaterialStock } from '@/lib/types';
import { formatDateTime } from '@/lib/format';

export function StockManager({
  stocks,
  isAdmin,
}: {
  stocks: MaterialStock[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<MaterialStock | null>(null);
  const [newValue, setNewValue] = useState('');

  function openDialog(s: MaterialStock) {
    setEditing(s);
    setNewValue(String(s.current_stock));
  }

  async function onSave() {
    if (!editing) return;
    const value = Number(newValue);
    if (!(value >= 0)) {
      toast.error('Jumlah stok tidak valid.');
      return;
    }
    setBusy(true);
    const res = await adjustStock(editing.material_name, value);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Stok "${editing.material_name}" diperbarui.`);
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stok Material</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stok bertambah otomatis saat pembelian dicatat, dan berkurang saat
          pemakaian dicatat. Sesuaikan manual jika perlu.
        </p>
      </div>

      {stocks.length === 0 ? (
        <EmptyState title="Belum ada stok" description="Stok muncul otomatis saat pembelian pertama dicatat." />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Material</th>
                <th className="px-4 py-3 text-right font-medium">Stok</th>
                <th className="px-4 py-3 font-medium">Satuan</th>
                <th className="px-4 py-3 font-medium">Diperbarui</th>
                {isAdmin ? (
                  <th className="px-4 py-3 font-medium">Aksi</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {stocks.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{s.material_name}</td>
                  <td className="px-4 py-3 text-right font-semibold">{s.current_stock}</td>
                  <td className="px-4 py-3">{s.unit || '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateTime(s.updated_at)}
                  </td>
                  {isAdmin ? (
                    <td className="px-4 py-3">
                      <Button variant="outline" size="sm" onClick={() => openDialog(s)}>
                        <PencilLine />
                        Sesuaikan
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sesuaikan Stok</DialogTitle>
            <DialogDescription>
              {editing ? editing.material_name : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="newStock">Jumlah Stok</Label>
            <Input
              id="newStock"
              type="number"
              step="any"
              min="0"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button onClick={onSave} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
