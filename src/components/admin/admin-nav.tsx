'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  Receipt,
  Wallet,
  Boxes,
  Wrench,
  BarChart3,
  FileSearch,
  HardHat,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SignOutButton } from '@/components/sign-out-button';
import type { Role } from '@/lib/types';

const links = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/requests', label: 'Pengajuan', icon: ClipboardList },
  { href: '/admin/purchases', label: 'Pembelian', icon: Receipt },
  { href: '/admin/payments', label: 'Pembayaran', icon: Wallet },
  { href: '/admin/stock', label: 'Stok', icon: Boxes },
  { href: '/admin/usage', label: 'Pemakaian', icon: Wrench },
  { href: '/admin/reports', label: 'Laporan', icon: BarChart3 },
  { href: '/admin/audit', label: 'Audit', icon: FileSearch },
];

export function AdminNav({ role, fullName }: { role: Role; fullName: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card lg:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <HardHat className="size-5" />
          <div className="leading-tight">
            <p className="text-sm font-semibold">Material Audit</p>
            <p className="text-xs text-muted-foreground">Portal {role === 'bos' ? 'Bos' : 'Admin'}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive(l.href)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <l.icon className="size-4" />
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-2 border-t p-3">
          <p className="min-w-0 truncate text-sm font-medium">{fullName}</p>
          <SignOutButton />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <HardHat className="size-5" />
          <span className="text-sm font-semibold">Material Audit</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{fullName}</span>
          <SignOutButton className="px-2" />
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card lg:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
              isActive(l.href) ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <l.icon className="size-5" />
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
