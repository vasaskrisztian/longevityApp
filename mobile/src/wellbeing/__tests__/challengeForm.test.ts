import { COLLECTIVE_FIELDS, goalPayload, typeForMode, typeOptionsFor, validateGoal } from '../challengeForm';

const values = {
  mode: 'INDIVIDUAL' as const,
  type: 'DAILY_STEPS' as const,
  threshold: '8000',
  requiredCount: '10',
  targetTotal: '100000',
};

describe('challenge form helpers', () => {
  it('a team total cannot be a sleep score — it falls back to steps', () => {
    expect(typeForMode('COLLECTIVE', 'SLEEP_SCORE')).toBe('DAILY_STEPS');
    expect(typeForMode('COLLECTIVE', 'WEEKLY_WORKOUTS')).toBe('WEEKLY_WORKOUTS');
    expect(typeForMode('INDIVIDUAL', 'SLEEP_SCORE')).toBe('SLEEP_SCORE');
    expect(COLLECTIVE_FIELDS.SLEEP_SCORE).toBeUndefined();
  });

  it('personal goals need threshold and count, not the team total', () => {
    expect(validateGoal(values)).toEqual({});
    expect(validateGoal({ ...values, threshold: '0', requiredCount: 'x' })).toEqual({
      threshold: expect.any(String),
      requiredCount: expect.any(String),
    });
    expect(validateGoal({ ...values, targetTotal: '' })).toEqual({});
  });

  it('a team total needs a positive whole number, spaces allowed', () => {
    const collective = { ...values, mode: 'COLLECTIVE' as const };
    expect(validateGoal(collective)).toEqual({});
    expect(validateGoal({ ...collective, targetTotal: '100 000' })).toEqual({});
    expect(validateGoal({ ...collective, targetTotal: '0' })).toEqual({ targetTotal: expect.any(String) });
    expect(validateGoal({ ...collective, targetTotal: '1.5' })).toEqual({ targetTotal: expect.any(String) });
    expect(validateGoal({ ...collective, threshold: '' })).toEqual({});
  });

  it('builds the request body for each mode', () => {
    expect(goalPayload(values)).toEqual({ mode: 'INDIVIDUAL', threshold: 8000, requiredCount: 10 });
    expect(goalPayload({ ...values, mode: 'COLLECTIVE', targetTotal: '100 000' })).toEqual({ mode: 'COLLECTIVE', targetTotal: 100000 });
  });

  it('a team total offers "Steps" and "Workouts" (no daily/weekly wording, no sleep score)', () => {
    const all = [
      { value: 'DAILY_STEPS', label: 'Daily steps' },
      { value: 'SLEEP_SCORE', label: 'Sleep score' },
      { value: 'WEEKLY_WORKOUTS', label: 'Weekly workouts' },
    ];
    expect(typeOptionsFor('INDIVIDUAL', all)).toEqual(all);
    expect(typeOptionsFor('COLLECTIVE', all)).toEqual([
      { value: 'DAILY_STEPS', label: 'Steps' },
      { value: 'WEEKLY_WORKOUTS', label: 'Workouts' },
    ]);
  });
});
