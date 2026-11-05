import type { ProtocolOverlay } from '@/src/api/dashboard';
import { t } from '@/src/i18n';

function formatMinutes(total: number): string {
  return t('plan.duration.hoursMinutes', { hours: Math.floor(total / 60), minutes: total % 60 });
}

/**
 * The targets the active protocol sets — only the ones it actually sets.
 * Translates at call time: call it while rendering (inside a component that uses `useT()`).
 */
export function protocolTargetLines(protocol: NonNullable<ProtocolOverlay['activeProtocol']>): string[] {
  return [
    protocol.targetSleepScore != null ? t('plan.targets.sleepScore', { value: protocol.targetSleepScore }) : null,
    protocol.targetSleepMinutes != null
      ? t('plan.targets.sleepDuration', { duration: formatMinutes(protocol.targetSleepMinutes) })
      : null,
    protocol.targetWeeklyWorkouts != null ? t('plan.targets.workouts', { count: protocol.targetWeeklyWorkouts }) : null,
    protocol.targetDailyActiveCalories != null ? t('plan.targets.calories', { count: protocol.targetDailyActiveCalories }) : null,
  ].filter((line): line is string => line !== null);
}
