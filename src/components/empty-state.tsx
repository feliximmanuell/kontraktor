import { Inbox } from 'lucide-react';

export function EmptyState({
  title = 'Belum ada data',
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
      <Inbox className="size-8 text-muted-foreground/50" />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs text-muted-foreground/70">{description}</p>
      ) : null}
    </div>
  );
}
