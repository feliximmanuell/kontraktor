import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReceiptStatus, RequestStatus } from '@/lib/types';

const requestStyles: Record<RequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-300',
  approved: 'bg-green-100 text-green-800 border-green-300',
  rejected: 'bg-red-100 text-red-800 border-red-300',
};

const requestLabels: Record<RequestStatus, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

const receiptStyles: Record<ReceiptStatus, string> = {
  pending: 'bg-red-100 text-red-800 border-red-300',
  received: 'bg-green-100 text-green-800 border-green-300',
};

const receiptLabels: Record<ReceiptStatus, string> = {
  pending: 'Bon Belum Diterima',
  received: 'Bon Sudah Diterima',
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge variant="outline" className={cn('border', requestStyles[status])}>
      {requestLabels[status]}
    </Badge>
  );
}

export function ReceiptStatusBadge({ status }: { status: ReceiptStatus }) {
  return (
    <Badge variant="outline" className={cn('border', receiptStyles[status])}>
      {receiptLabels[status]}
    </Badge>
  );
}
