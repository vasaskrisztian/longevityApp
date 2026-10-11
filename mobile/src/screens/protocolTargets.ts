import type { ProtocolOverlay } from '@/src/api/dashboard';

function formatMinutes(total: number): string {
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

/** The targets the active protocol sets — only the ones it actually sets. */
export function protocolTargetLines(protocol: NonNullable<ProtocolOverlay['activeProtocol']>): string[] {
  return [
    protocol.targetSleepScore != null ? `Sleep score ${protocol.targetSleepScore}` : null,
    protocol.targetSleepMinutes != null ? `Sleep duration ${formatMinutes(protocol.targetSleepMinutes)}` : null,
    protocol.targetWeeklyWorkouts != null ? `${protocol.targetWeeklyWorkouts} workouts a week` : null,
    protocol.targetDailyActiveCalories != null ? `${protocol.targetDailyActiveCalories} active kcal a day` : null,
  ].filter((line): line is string => line !== null);
}
