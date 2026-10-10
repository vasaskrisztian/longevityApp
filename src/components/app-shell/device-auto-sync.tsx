'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  needsReconnect,
  runSessionSyncFlow,
  type SessionSyncResponse,
} from '@/lib/wearable/session-sync-flow';

/** Don't re-trigger within this long in the same tab (the server has its own staleness gate too). */
const CLIENT_THROTTLE_MS = 5 * 60 * 1000;
const STORAGE_KEY = 'lk:device-sync-at';

type Phase = 'idle' | 'syncing' | 'done' | 'reconnect';

function readLastRun(): number {
  try {
    return Number(window.sessionStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeLastRun(value: number) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Storage unavailable (private mode...) — the server-side gate still prevents duplicate jobs.
  }
}

/**
 * Syncs the user's connected devices the moment they open the signed-in web
 * app (this component mounts with the app shell, i.e. right after login and
 * on every fresh visit) and again when they come back to the tab later. When
 * a new Oura sync was queued it waits for it, then refreshes the server-
 * rendered page so the new numbers appear without a manual reload.
 * Apple Health data comes from the iPhone app, so there is nothing to do for
 * it here beyond showing whatever the phone last uploaded.
 */
export function DeviceAutoSync() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const running = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    async function run() {
      if (running.current || Date.now() - readLastRun() < CLIENT_THROTTLE_MS) return;
      running.current = true;
      writeLastRun(Date.now());
      try {
        const result = await runSessionSyncFlow({
          requestSessionSync: async () => {
            const response = await fetch('/api/wearables/session-sync', { method: 'POST' });
            if (!response.ok) throw new Error(`session-sync ${response.status}`);
            return (await response.json()) as SessionSyncResponse;
          },
          getConnections: async () => {
            const response = await fetch('/api/wearables');
            if (!response.ok) throw new Error(`wearables ${response.status}`);
            return (await response.json()) as { provider: string; lastSyncAt: string | null }[];
          },
          sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
          // Show the "syncing" pill only once we know something is actually in flight.
          onWaiting: () => {
            if (!cancelled) setPhase('syncing');
          },
        });
        if (cancelled) return;
        if (result.updated) router.refresh();
        if (needsReconnect(result.response).length > 0) {
          setPhase('reconnect');
        } else if (result.waited) {
          setPhase('done');
          hideTimer = setTimeout(() => setPhase('idle'), 4000);
        }
      } catch {
        // Silent by design: the dashboard keeps showing the last synced data, and the
        // next visit/focus retries. Let the throttle expire sooner after a failure.
        writeLastRun(0);
      } finally {
        running.current = false;
      }
    }

    run();
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      if (hideTimer) clearTimeout(hideTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router]);

  if (phase === 'idle') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 rounded-full border bg-card px-4 py-2 text-sm text-muted-foreground shadow-lg"
    >
      {phase === 'syncing' && 'Syncing your devices…'}
      {phase === 'done' && 'Devices synced'}
      {phase === 'reconnect' && (
        <>
          Your device connection needs attention.{' '}
          <Link href="/profile/devices" className="font-medium text-primary underline">
            Reconnect
          </Link>
        </>
      )}
    </div>
  );
}
