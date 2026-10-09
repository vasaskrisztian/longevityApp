import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { getConnections } from '@/src/api/wearables';
import { syncAppleHealth } from './sync';

/** Foreground syncs are skipped if one finished less than this long ago. */
export const AUTO_SYNC_MIN_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Keeps Apple Health fresh without any user action: whenever the app comes to
 * the foreground (and once at start) it pushes the recent days — but only for
 * a user who already connected Apple Health (the server has a CONNECTED
 * connection for them), so nobody gets a permission sheet unprompted. Fully
 * silent: failures just wait for the next foreground. iOS only; a no-op on
 * web/Android.
 */
export function useAppleHealthAutoSync(enabled: boolean) {
  const lastRunAt = useRef(0);
  const running = useRef(false);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'ios') return;

    async function run() {
      if (running.current || Date.now() - lastRunAt.current < AUTO_SYNC_MIN_INTERVAL_MS) return;
      running.current = true;
      try {
        const connections = await getConnections();
        const apple = connections.find((c) => c.provider === 'APPLE_HEALTH');
        if (apple?.status === 'CONNECTED') {
          await syncAppleHealth(apple.lastSyncAt);
          lastRunAt.current = Date.now();
        }
      } catch {
        // Silent by design — retried on the next foreground.
      } finally {
        running.current = false;
      }
    }

    run();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => subscription.remove();
  }, [enabled]);
}
