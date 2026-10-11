import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getMyWellbeing } from '@/src/api/groups';
import { setPendingInvitations } from '@/src/wellbeing/pendingInvitationsStore';

/**
 * Keeps the Community badge fresh while signed in: on mount, when the app
 * returns to the foreground and whenever `refreshKey` changes (the tab layout
 * passes the unread-notification count — an invitation to an existing user
 * always comes with a notification). Failures are silent.
 */
export function usePendingInvitationsSync(enabled: boolean, refreshKey: number): void {
  useEffect(() => {
    if (!enabled) {
      setPendingInvitations(0);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      getMyWellbeing()
        .then((result) => {
          if (!cancelled) setPendingInvitations(result.pendingInvitations.length);
        })
        .catch(() => undefined);
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [enabled, refreshKey]);
}
