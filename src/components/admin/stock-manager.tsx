'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { adjustStock, deleteStock } from '@/lib/actions/stocks';
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
import { Loader2, PencilLine, Trash2 } from 'lucide-react';
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
  const [deleteTarget, setDeleteTarget] = useState<MaterialStock | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  async function onDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    const res = await deleteStock(deleteTarget.material_name);
    setDeleteBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Stok "${deleteTarget.material_name}" dihapus.`);
    setDeleteTarget(null);
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
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => openDialog(s)}>
                          <PencilLine />
                          Sesuaikan
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(s)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
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

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Stok?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Hapus stok "${deleteTarget.material_name}"? Material akan muncul kembali otomatis saat pembelian berikutnya.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={deleteBusy}>
              {deleteBusy ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
