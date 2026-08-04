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
  ArrowLeftRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SignOutButton } from '@/components/sign-out-button';
import type { Role } from '@/lib/types';

const links = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/requests', label: 'Pengajuan', icon: ClipboardList },
  { href: '/admin/purchases', label: 'Pembelian', icon: Receipt },
  { href: '/admin/payments', label: 'Pembayaran', icon: Wallet },
  { href: '/admin/cashflow', label: 'Cashflow', icon: ArrowLeftRight },
  { href: '/admin/stock', label: 'Stok', icon: Boxes },
  { href: '/admin/usage', label: 'Pemakaian', icon: Wrench },
  { href: '/admin/reports', label: 'Laporan', icon: BarChart3 },
  { href: '/admin/audit', label: 'Audit', icon: FileSearch },
];

export function AdminNav({
  role,
  fullName,
  managedProject,
}: {
  role: Role;
  fullName: string;
  managedProject: string | null;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card lg:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <HardHat className="size-5" />
          <div className="leading-tight">
            <p className="text-sm font-semibold">Material Audit made for Zelysca</p>
            <p className="text-xs text-muted-foreground">Portal {role === 'bos' ? 'Bos' : 'Admin'}</p>
          </div>
        </div>
        <Link
          href="/admin/projects"
          className="mx-3 my-1 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition-colors hover:bg-muted"
        >
          <span className="min-w-0">
            <span className="block text-muted-foreground">Proyek aktif</span>
            <span className="block truncate font-medium text-foreground">
              {managedProject ?? 'Semua Proyek'}
            </span>
          </span>
          <span className="shrink-0 font-medium text-primary">Ganti</span>
        </Link>
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
        <div className="flex min-w-0 items-center gap-2">
          <HardHat className="size-5 shrink-0" />
          <Link href="/admin/projects" className="min-w-0">
            <span className="block truncate text-sm font-semibold">Material Audit made for Zelysca</span>
            <span className="block truncate text-xs text-muted-foreground">
              {managedProject ? `Proyek: ${managedProject}` : 'Semua Proyek'} · Ganti
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <span className="hidden text-xs text-muted-foreground sm:inline">{fullName}</span>
          <SignOutButton className="px-2" />
        </div>
      </header>

      <nav className="no-scrollbar fixed inset-x-0 bottom-0 z-30 flex items-stretch overflow-x-auto border-t bg-card lg:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              'flex min-w-max shrink-0 flex-col items-center gap-0.5 px-4 py-2 text-[10px] font-medium',
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
