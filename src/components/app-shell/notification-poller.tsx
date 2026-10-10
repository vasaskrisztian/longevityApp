'use client';

import { useEffect } from 'react';
import { listNotifications } from '@/lib/wellbeing/notifications-api';
import { setUnreadCount } from '@/lib/wellbeing/unread-store';

export const NOTIFICATION_POLL_INTERVAL_MS = 60_000;

/**
 * Keeps the sidebar's unread badge fresh while the app is open: once on
 * mount, every minute and whenever the tab becomes visible again. Failures
 * are silent — a flaky connection must not surface as an error on a page
 * that did nothing wrong.
 */
export function NotificationPoller() {
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      listNotifications(1)
        .then((result) => {
          if (!cancelled) setUnreadCount(result.unreadCount);
        })
        .catch(() => undefined);
    };
    refresh();
    const timer = window.setInterval(refresh, NOTIFICATION_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return null;
}
