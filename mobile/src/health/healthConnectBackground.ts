/**
 * Periodic background sync of Health Connect — Android only. On web and iPhone
 * these are no-ops, and (because Metro picks `healthConnectBackground.android.ts`
 * on Android) the native task modules are not bundled there.
 */
export const HEALTH_CONNECT_BACKGROUND_TASK = 'longevity-health-connect-sync';

/** Registers the periodic job (idempotent). Resolves false when it cannot run here. */
export async function registerHealthConnectBackgroundSync(): Promise<boolean> {
  return false;
}

export async function unregisterHealthConnectBackgroundSync(): Promise<void> {}
