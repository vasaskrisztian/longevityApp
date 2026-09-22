import { describe, it, expect } from 'vitest';
import { CreateGoalSchema, UpdateGoalSchema } from '@/lib/validation/goal.schemas';

const VALID_GOAL = {
  type: 'WEIGHT_LOSS',
  name: 'Lose 5kg',
  description: 'Before summer',
  targetValue: 5,
  targetUnit: 'kg',
  targetDate: '2027-06-01',
  status: 'ACTIVE',
};

describe('CreateGoalSchema', () => {
  it('accepts a fully valid goal payload', () => {
    expect(CreateGoalSchema.safeParse(VALID_GOAL).success).toBe(true);
  });

  it('defaults status to ACTIVE when omitted', () => {
    const { status: _status, ...rest } = VALID_GOAL;
    const result = CreateGoalSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('ACTIVE');
    }
  });

  it('accepts a minimal payload with only type and name', () => {
    const result = CreateGoalSchema.safeParse({ type: 'GENERAL_HEALTH', name: 'Feel better' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = CreateGoalSchema.safeParse({ ...VALID_GOAL, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid goal type enum value', () => {
    const result = CreateGoalSchema.safeParse({ ...VALID_GOAL, type: 'BECOME_IMMORTAL' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid status enum value', () => {
    const result = CreateGoalSchema.safeParse({ ...VALID_GOAL, status: 'DONE' });
    expect(result.success).toBe(false);
  });

  it('rejects a description longer than 1000 characters', () => {
    const result = CreateGoalSchema.safeParse({ ...VALID_GOAL, description: 'x'.repeat(1001) });
    expect(result.success).toBe(false);
  });
});

describe('UpdateGoalSchema', () => {
  it('accepts a partial payload with a single field', () => {
    expect(UpdateGoalSchema.safeParse({ status: 'PAUSED' }).success).toBe(true);
  });

  it('accepts an empty object (no-op update)', () => {
    expect(UpdateGoalSchema.safeParse({}).success).toBe(true);
  });

  it('still rejects an invalid value for a provided field', () => {
    expect(UpdateGoalSchema.safeParse({ type: 'NOT_REAL' }).success).toBe(false);
  });
});
