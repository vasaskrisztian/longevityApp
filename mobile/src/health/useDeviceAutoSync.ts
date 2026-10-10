import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { runDeviceAutoSync } from './deviceAutoSync';

/** Returning to the foreground re-syncs only if the last run started at least this long ago. */
export const FOREGROUND_SYNC_MIN_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Syncs the user's connected devices the moment they get into the app: once
 * when the signed-in screens mount (that is right after login, and on every
 * cold start with a saved session — never throttled), and again whenever the
 * app returns to the foreground after a few minutes. See deviceAutoSync.ts for
 * what a run does. Replaces the old Apple-Health-only auto sync.
 */
export function useDeviceAutoSync(enabled: boolean) {
  const lastRunAt = useRef(0);
  const running = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    async function run(force: boolean) {
      if (running.current) return;
      if (!force && Date.now() - lastRunAt.current < FOREGROUND_SYNC_MIN_INTERVAL_MS) return;
      running.current = true;
      lastRunAt.current = Date.now();
      try {
        await runDeviceAutoSync();
      } finally {
        running.current = false;
      }
    }

    run(true);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') run(false);
    });
    return () => subscription.remove();
  }, [enabled]);
}
