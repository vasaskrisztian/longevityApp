'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';
import { Button } from '@/components/ui/button';

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-card-border bg-white px-4 py-6">
      <div className="mb-8 px-2">
        <span className="text-base font-semibold tracking-tight">Longevity App</span>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-card-border pt-4">
        {session?.user?.email && (
          <p className="truncate px-2 text-xs text-muted-foreground">{session.user.email}</p>
        )}
        <Button variant="outline" size="sm" className="w-full" onClick={() => signOut({ callbackUrl: '/login' })}>
          Log out
        </Button>
      </div>
    </aside>
  );
}
