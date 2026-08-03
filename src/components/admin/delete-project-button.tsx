'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteProject } from '@/lib/actions/projects';
import { Trash2 } from 'lucide-react';

export function DeleteProjectButton({ projectName }: { projectName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const ok = window.confirm(
      `Yakin ingin menghapus proyek "${projectName}"?\n\nSemua data pengajuan, pembelian, pembayaran, pemakaian, dan cashflow proyek ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`
    );
    if (!ok) return;

    startTransition(async () => {
      await deleteProject(projectName);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleDelete}
      aria-label={`Hapus proyek ${projectName}`}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
    >
      <Trash2 className="size-3.5" />
      Hapus
    </button>
  );
}