'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PlusCircle, History, HardHat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SignOutButton } from '@/components/sign-out-button';

const links = [
  { href: '/request', label: 'Minta Material', icon: PlusCircle },
  { href: '/request/history', label: 'Riwayat', icon: History },
];

export function MandorNav({ fullName }: { fullName: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <header className="sticky top-0 z-30 border-b bg-card">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <HardHat className="size-5" />
          <div className="leading-tight">
            <p className="text-sm font-semibold">Portal Lapangan</p>
            <p className="text-xs text-muted-foreground">{fullName}</p>
          </div>
        </div>
        <SignOutButton />
      </div>
      <nav className="grid grid-cols-2 border-t">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              'flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors',
              isActive(l.href)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <l.icon className="size-4" />
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
