import { describe, it, expect } from 'vitest';
import {
  countDistinctWorkouts,
  isCountableWorkout,
  MIN_COUNTED_WORKOUT_MINUTES,
  WORKOUT_MERGE_GAP_MINUTES,
  type CountableWorkout,
} from '@/modules/wearable/domain/workout-count';

const at = (iso: string, minutes: number, extra: Partial<CountableWorkout> = {}): CountableWorkout => ({
  startedAt: new Date(iso),
  endedAt: new Date(new Date(iso).getTime() + minutes * 60_000),
  durationMin: minutes,
  activityType: 'running',
  source: 'confirmed',
  ...extra,
});

describe('isCountableWorkout', () => {
  it('rejects sessions shorter than the minimum, accepts the minimum exactly', () => {
    expect(isCountableWorkout(at('2026-10-01T08:00:00Z', MIN_COUNTED_WORKOUT_MINUTES - 1))).toBe(false);
    expect(isCountableWorkout(at('2026-10-01T08:00:00Z', MIN_COUNTED_WORKOUT_MINUTES))).toBe(true);
  });

  it('counts walking only when the person logged or confirmed it', () => {
    const walk = (source: string | null | undefined) => at('2026-10-01T08:00:00Z', 40, { activityType: 'Walking', source });
    expect(isCountableWorkout(walk('autodetected'))).toBe(false);
    expect(isCountableWorkout(walk(null))).toBe(false);
    expect(isCountableWorkout(walk(undefined))).toBe(false);
    expect(isCountableWorkout(walk('confirmed'))).toBe(true);
    expect(isCountableWorkout(walk('manual'))).toBe(true);
    expect(isCountableWorkout(walk('workout_heart_rate'))).toBe(true);
  });

  it('counts other auto-detected activities (a detected run is a workout)', () => {
    expect(isCountableWorkout(at('2026-10-01T08:00:00Z', 30, { source: 'autodetected' }))).toBe(true);
  });
});

describe('countDistinctWorkouts', () => {
  it('is 0 for no workouts', () => {
    expect(countDistinctWorkouts([])).toBe(0);
  });

  it('merges overlapping recordings of the same session', () => {
    expect(countDistinctWorkouts([at('2026-10-01T08:00:00Z', 45), at('2026-10-01T08:10:00Z', 30)])).toBe(1);
  });

  it('merges a session split by a short pause but not by a longer break', () => {
    const first = at('2026-10-01T08:00:00Z', 30); // ends 08:30
    const soon = at(`2026-10-01T08:${30 + WORKOUT_MERGE_GAP_MINUTES}:00Z`, 30);
    const later = at(`2026-10-01T08:${30 + WORKOUT_MERGE_GAP_MINUTES + 1}:00Z`, 30);
    expect(countDistinctWorkouts([first, soon])).toBe(1);
    expect(countDistinctWorkouts([first, later])).toBe(2);
  });

  it('does not depend on input order and counts separate days separately', () => {
    const list = [at('2026-10-03T08:00:00Z', 30), at('2026-10-01T08:00:00Z', 30), at('2026-10-02T08:00:00Z', 30)];
    expect(countDistinctWorkouts(list)).toBe(3);
  });

  it('ignores things that are not workouts before counting', () => {
    expect(
      countDistinctWorkouts([
        at('2026-10-01T08:00:00Z', 30),
        at('2026-10-01T12:00:00Z', 60, { activityType: 'walking', source: 'autodetected' }),
        at('2026-10-02T08:00:00Z', 4),
      ]),
    ).toBe(1);
  });

  it('survives an end time before the start (bad provider data)', () => {
    const bad: CountableWorkout = { ...at('2026-10-01T08:00:00Z', 30), endedAt: new Date('2026-10-01T07:00:00Z') };
    expect(countDistinctWorkouts([bad])).toBe(1);
  });
});
