'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flag, Mail, PartyPopper, Trophy, type LucideIcon } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { listNotifications, markNotificationsRead, type AppNotification } from '@/lib/wellbeing/notifications-api';
import { setUnreadCount } from '@/lib/wellbeing/unread-store';
import { timeAgo } from '@/lib/wellbeing/format';
import { LoadingLine } from './parts';

const ICON: Record<AppNotification['type'], LucideIcon> = {
  GROUP_INVITATION: Mail,
  GROUP_CHALLENGE_NEW: Flag,
  GROUP_CHALLENGE_SUMMARY: Trophy,
  GROUP_CHALLENGE_GOAL_REACHED: PartyPopper,
};

/**
 * The in-app notification inbox: group invitations, new group challenges and
 * end-of-challenge summaries. Opening a notification marks it read and takes
 * the person to the Wellbeing page, where invitations are accepted (with the
 * consent text) and challenges joined.
 */
export function NotificationsInbox() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    listNotifications(50)
      .then((result) => {
        setItems(result.items);
        setUnreadCount(result.unreadCount);
        setError(null);
      })
      .catch(() => setError('Could not load your notifications.'));
  }, []);

  useEffect(load, [load]);

  function open(notification: AppNotification) {
    if (!notification.readAt) {
      setItems((current) => current?.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)) ?? current);
      markNotificationsRead([notification.id])
        .then(() => listNotifications(1))
        .then((result) => setUnreadCount(result.unreadCount))
        .catch(() => undefined);
    }
    router.push('/profile/wellbeing');
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await markNotificationsRead('all');
      setItems((current) => current?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? current);
      setUnreadCount(0);
    } catch {
      setError('Could not mark the notifications as read.');
    } finally {
      setBusy(false);
    }
  }

  const unread = items?.filter((n) => !n.readAt).length ?? 0;

  return (
    <div className="space-y-4">
      {unread > 0 && (
        <Button size="sm" variant="outline" disabled={busy} onClick={markAllRead}>
          Mark all as read
        </Button>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}
      {!items && !error && <LoadingLine />}
      {items && items.length === 0 && (
        <Card className="p-5 text-sm text-muted-foreground">
          Nothing here yet. Group invitations, new group challenges and challenge results will show up in this list.
        </Card>
      )}
      {items?.map((notification) => {
        const Icon = ICON[notification.type];
        return (
          <button key={notification.id} type="button" className="block w-full text-left" onClick={() => open(notification)}>
            <Card className={cn('flex items-start gap-3 p-4 transition-shadow hover:shadow-md', !notification.readAt && 'border-primary/40 bg-primary/5')}>
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', notification.readAt ? 'text-muted-foreground' : 'text-primary')} aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className={cn('text-sm', notification.readAt ? 'font-medium' : 'font-semibold')}>{notification.title}</p>
                  {!notification.readAt && <span className="h-2 w-2 rounded-full bg-accent" aria-label="Unread" />}
                </div>
                <p className="text-sm text-muted-foreground">{notification.body}</p>
                <p className="text-xs text-muted-foreground">{timeAgo(notification.createdAt)}</p>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
