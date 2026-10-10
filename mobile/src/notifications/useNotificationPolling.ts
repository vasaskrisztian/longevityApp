import { useEffect } from 'react';
import { AppState } from 'react-native';

import { listNotifications } from '@/src/api/notifications';
import { setUnreadCount } from '@/src/notifications/unreadStore';

export const NOTIFICATION_POLL_INTERVAL_MS = 60_000;

/**
 * Keeps the unread badge fresh while signed in: once on mount, every minute
 * and whenever the app comes back to the foreground. Failures are silent
 * (the badge simply keeps its last value) — a flaky connection must never
 * surface as an error on a screen that did nothing wrong.
 */
export function useNotificationPolling(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      setUnreadCount(0);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      listNotifications(1)
        .then((result) => {
          if (!cancelled) setUnreadCount(result.unreadCount);
        })
        .catch(() => undefined);
    };
    refresh();
    const timer = setInterval(refresh, NOTIFICATION_POLL_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription.remove();
    };
  }, [enabled]);
}
