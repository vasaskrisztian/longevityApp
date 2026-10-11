import type { ProtocolOverlay } from '@/src/api/dashboard';
import { protocolTargetLines } from '../protocolTargets';

type P = NonNullable<ProtocolOverlay['activeProtocol']>;
const base = { targetSleepScore: null, targetSleepMinutes: null, targetWeeklyWorkouts: null, targetDailyActiveCalories: null } as unknown as P;

describe('protocolTargetLines', () => {
  it('lists only the targets the protocol sets', () => {
    expect(protocolTargetLines({ ...base, targetSleepScore: 85, targetWeeklyWorkouts: 4 })).toEqual(['Sleep score 85', '4 workouts a week']);
  });
  it('formats sleep duration', () => {
    expect(protocolTargetLines({ ...base, targetSleepMinutes: 485 })).toEqual(['Sleep duration 8h 5m']);
  });
  it('is empty without targets', () => {
    expect(protocolTargetLines(base)).toEqual([]);
  });
});
