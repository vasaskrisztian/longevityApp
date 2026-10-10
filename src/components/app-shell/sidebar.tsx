'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, findActiveNavHref } from './nav-items';
import { Button } from '@/components/ui/button';
import { useUnreadCount } from '@/lib/wellbeing/unread-store';

/**
 * The real longevity.klub emblem (public/brand/longevity-klub-logo.png) --
 * a circular seal (cream background, gold ring, forest-green/gold tree +
 * infinity mark, "LONGEVITY KLUB" arced around the rim). It already reads
 * as a complete badge on its own -- rendered at icon size, not boxed inside
 * another colored container -- with the wordmark next to it for legibility
 * at sidebar scale (the seal's own ring text is too fine to read that
 * small).
 */
function BrandMark() {
  return (
    <Image
      src="/brand/longevity-klub-logo.png"
      alt="Longevity Klub"
      width={48}
      height={48}
      className="shrink-0 rounded-full shadow-glow"
      priority
    />
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const visibleItems = NAV_ITEMS.filter((item) => !item.hidden && (!item.adminOnly || isAdmin));
  const activeHref = findActiveNavHref(pathname, visibleItems);
  const unread = useUnreadCount();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-card-border bg-gradient-to-b from-white via-white to-muted px-4 py-6">
      <div className="mb-8 flex items-center gap-3 px-2">
        <BrandMark />
        <div className="flex flex-col leading-tight">
          <span className="font-display text-base font-semibold tracking-tight text-primary">
            Longevity
          </span>
          <span className="font-display text-sm font-medium tracking-[0.2em] text-accent">
            KLUB
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5">
        {visibleItems.map((item) => {
          const active = item.href === activeHref;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-gradient-to-r from-primary to-primary-dark text-primary-foreground shadow-glow'
                  : 'text-muted-foreground hover:translate-x-0.5 hover:bg-accent/10 hover:text-primary',
              )}
            >
              <Icon
                className={cn(
                  'h-[18px] w-[18px] shrink-0 transition-colors',
                  active ? 'text-accent-light' : 'text-muted-foreground/70 group-hover:text-accent',
                )}
                aria-hidden="true"
              />
              {item.label}
              {item.href === '/notifications' && unread > 0 && (
                <span
                  className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground"
                  aria-label={`${unread} unread`}
                >
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
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
