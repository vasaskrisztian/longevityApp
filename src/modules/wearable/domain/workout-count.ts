/**
 * What counts as "a workout" for the dashboard's "Workouts (last 7 days)" card
 * and for WEEKLY_WORKOUTS challenges. Oura reports every activity its ring
 * detects on its own (every walk, errand, stretch of cycling), plus manual and
 * confirmed ones, and the same session can show up more than once — counting
 * raw rows therefore overstated how much the person trained. A pure function
 * (no I/O) so the rule is easy to test and to change in one place:
 *
 *  1. sessions shorter than MIN_COUNTED_WORKOUT_MINUTES are ignored;
 *  2. walking only counts if the person confirmed/entered it (Oura's
 *     "autodetected" walks are everyday movement, not training) — the
 *     daily step and activity numbers already reflect them;
 *  3. sessions that overlap or start within WORKOUT_MERGE_GAP_MINUTES of the
 *     previous one's end are one session (same workout recorded twice, or a
 *     workout split by a pause).
 */
export const MIN_COUNTED_WORKOUT_MINUTES = 10;
export const WORKOUT_MERGE_GAP_MINUTES = 10;

/** `source` values (Oura) that mean the person chose to log the activity. */
const PERSON_LOGGED_SOURCES = new Set(['manual', 'confirmed', 'workout_heart_rate']);
const EVERYDAY_ACTIVITIES = new Set(['walking', 'walk']);

export interface CountableWorkout {
  startedAt: Date;
  endedAt: Date;
  durationMin: number;
  activityType: string;
  source?: string | null;
}

export function isCountableWorkout(workout: CountableWorkout): boolean {
  if (workout.durationMin < MIN_COUNTED_WORKOUT_MINUTES) return false;
  if (EVERYDAY_ACTIVITIES.has(workout.activityType.trim().toLowerCase())) {
    return PERSON_LOGGED_SOURCES.has((workout.source ?? '').toLowerCase());
  }
  return true;
}

export function countDistinctWorkouts(workouts: CountableWorkout[]): number {
  const sessions = workouts
    .filter(isCountableWorkout)
    .map((w) => ({ start: w.startedAt.getTime(), end: Math.max(w.endedAt.getTime(), w.startedAt.getTime()) }))
    .sort((a, b) => a.start - b.start);

  const gapMs = WORKOUT_MERGE_GAP_MINUTES * 60_000;
  let count = 0;
  let currentEnd = Number.NEGATIVE_INFINITY;
  for (const session of sessions) {
    if (session.start > currentEnd + gapMs) {
      count += 1;
      currentEnd = session.end;
    } else {
      currentEnd = Math.max(currentEnd, session.end);
    }
  }
  return count;
}
