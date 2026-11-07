import type { AppleHealthDailySample } from './aggregate';

/**
 * 'unsupported' = not an Android phone (web, iPhone) — Health Connect does not exist there.
 * 'unavailable' = Android, but Health Connect cannot be used (not installed / not supported by the device).
 * 'update_required' = installed but too old for the app.
 */
export type HealthConnectAvailability = 'unsupported' | 'unavailable' | 'update_required' | 'available';

export interface HealthConnectAccess {
  /** At least one of the data types we read was granted. */
  granted: boolean;
  /** Reading while the app is in the background was granted (Android 14+), needed for the periodic sync. */
  background: boolean;
  /** Reading older than 30 days before the first grant was granted. */
  history: boolean;
}

/**
 * Contract implemented by `healthConnectNative.android.ts` (the real Health
 * Connect SDK) and `healthConnectNative.ts` (stub for web / iPhone). Metro
 * picks the `.android.ts` file on Android only, so the native module is never
 * bundled anywhere else.
 */
export interface HealthConnectNative {
  availability(): Promise<HealthConnectAvailability>;
  /** Current permissions, without showing anything (safe in the background). */
  getAccess(): Promise<HealthConnectAccess>;
  /**
   * Shows the Health Connect permission screen for the (read-only) data types
   * we use, then asks — separately and best-effort — for background and history
   * access. Needs the app in the foreground.
   */
  requestAccess(): Promise<HealthConnectAccess>;
  /** One summary per local calendar day in [from, to], ascending, days without data omitted. */
  readDailySummaries(from: Date, to: Date): Promise<AppleHealthDailySample[]>;
  /** Opens the Health Connect settings (to review or revoke access). */
  openSettings(): void;
}
