import type { AppleHealthDailySample } from './aggregate';

/**
 * Contract implemented by `native.ios.ts` (real HealthKit) and `native.ts`
 * (stub for web/Android, where there is no HealthKit). Metro picks the
 * `.ios.ts` file on iOS only, so the native module is never bundled elsewhere.
 */
export interface AppleHealthNative {
  /** True only on an iPhone/iPad where HealthKit data is available. */
  isSupported(): Promise<boolean>;
  /**
   * Shows the HealthKit permission sheet for the (read-only) data types we
   * use. Must run before any read in the same app session — the library
   * crashes the app otherwise. Resolves true when the request flow completed;
   * HealthKit deliberately never reveals whether read access was granted.
   */
  requestAccess(): Promise<boolean>;
  /** One summary per local calendar day in [from, to], ascending, days without data omitted. */
  readDailySummaries(from: Date, to: Date): Promise<AppleHealthDailySample[]>;
}
