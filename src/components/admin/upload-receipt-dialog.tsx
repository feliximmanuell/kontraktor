'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { uploadReceipt } from '@/lib/actions/purchases';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, UploadCloud } from 'lucide-react';

export function UploadReceiptDialog({ purchaseId }: { purchaseId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error('Pilih file foto bon terlebih dahulu.');
      return;
    }
    setBusy(true);
    const formData = new FormData();
    formData.set('purchaseId', purchaseId);
    formData.set('receipt', file);
    const res = await uploadReceipt(formData);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Bon berhasil diunggah!');
    setOpen(false);
    setFile(null);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UploadCloud />
          Upload Bon
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Foto Bon / Nota</DialogTitle>
          <DialogDescription>
            Foto bon akan ditandai sebagai sudah diterima.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`receipt-${purchaseId}`}>Foto Bon</Label>
            <Input
              id={`receipt-${purchaseId}`}
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              {file ? `File terpilih: ${file.name}` : 'JPG, PNG, WEBP, atau PDF (maks 5MB)'}
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <UploadCloud />}
              {busy ? 'Mengunggah...' : 'Simpan Bon'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
