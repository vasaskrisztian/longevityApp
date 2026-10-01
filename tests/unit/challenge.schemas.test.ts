import { describe, it, expect } from 'vitest';
import { CreateChallengeSchema, UpdateChallengeSchema } from '@/lib/validation/challenge.schemas';

const VALID_CHALLENGE = {
  type: 'SLEEP_SCORE',
  name: '10 good nights',
  requiredCount: 10,
  threshold: 80,
  windowDays: 21,
};

describe('CreateChallengeSchema', () => {
  it('accepts a fully valid SLEEP_SCORE challenge payload', () => {
    expect(CreateChallengeSchema.safeParse(VALID_CHALLENGE).success).toBe(true);
  });

  it('accepts a valid DAILY_STEPS challenge payload', () => {
    const result = CreateChallengeSchema.safeParse({
      ...VALID_CHALLENGE,
      type: 'DAILY_STEPS',
      threshold: 10000,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid WEEKLY_WORKOUTS challenge payload', () => {
    const result = CreateChallengeSchema.safeParse({
      ...VALID_CHALLENGE,
      type: 'WEEKLY_WORKOUTS',
      requiredCount: 4,
      threshold: 2,
      windowDays: 28,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a minimal payload without a name', () => {
    const { name: _name, ...withoutName } = VALID_CHALLENGE;
    expect(CreateChallengeSchema.safeParse(withoutName).success).toBe(true);
  });

  it('rejects an invalid type enum value', () => {
    expect(CreateChallengeSchema.safeParse({ ...VALID_CHALLENGE, type: 'STEPS' }).success).toBe(false);
  });

  it('rejects requiredCount below 1', () => {
    expect(CreateChallengeSchema.safeParse({ ...VALID_CHALLENGE, requiredCount: 0 }).success).toBe(false);
  });

  it('rejects threshold below 1', () => {
    expect(CreateChallengeSchema.safeParse({ ...VALID_CHALLENGE, threshold: 0 }).success).toBe(false);
  });

  it('rejects windowDays below 1', () => {
    expect(CreateChallengeSchema.safeParse({ ...VALID_CHALLENGE, windowDays: 0 }).success).toBe(false);
  });

  it('rejects windowDays above 365', () => {
    expect(CreateChallengeSchema.safeParse({ ...VALID_CHALLENGE, windowDays: 400 }).success).toBe(false);
  });

  // Unlike Protocol's optional numeric targets, Challenge's requiredCount /
  // threshold / windowDays are all REQUIRED with min(1) rather than
  // `.optional()` with a blankToUndefined preprocess. So a blank field
  // (submitted as '' by react-hook-form) must fail visibly here, not
  // silently coerce to 0 and save a broken challenge (e.g. "steps > 0").
  it('rejects a blank requiredCount rather than silently coercing it to 0', () => {
    const result = CreateChallengeSchema.safeParse({ ...VALID_CHALLENGE, requiredCount: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a blank threshold rather than silently coercing it to 0', () => {
    const result = CreateChallengeSchema.safeParse({ ...VALID_CHALLENGE, threshold: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a blank windowDays rather than silently coercing it to 0', () => {
    const result = CreateChallengeSchema.safeParse({ ...VALID_CHALLENGE, windowDays: '' });
    expect(result.success).toBe(false);
  });
});

// Phase 13 — same optional-not-default rationale as protocol.schemas.ts's
// visibility field.
describe('visibility (Phase 13)', () => {
  it('is left undefined when omitted', () => {
    const result = CreateChallengeSchema.safeParse(VALID_CHALLENGE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visibility).toBeUndefined();
    }
  });

  it('accepts PRIVATE and PUBLIC', () => {
    expect(CreateChallengeSchema.safeParse({ ...VALID_CHALLENGE, visibility: 'PRIVATE' }).success).toBe(true);
    expect(CreateChallengeSchema.safeParse({ ...VALID_CHALLENGE, visibility: 'PUBLIC' }).success).toBe(true);
  });

  it('rejects any other value', () => {
    expect(CreateChallengeSchema.safeParse({ ...VALID_CHALLENGE, visibility: 'SECRET' }).success).toBe(false);
  });
});

describe('UpdateChallengeSchema', () => {
  it('accepts a partial payload with a single field', () => {
    expect(UpdateChallengeSchema.safeParse({ name: 'Renamed challenge' }).success).toBe(true);
  });

  it('accepts an empty object (no-op update)', () => {
    expect(UpdateChallengeSchema.safeParse({}).success).toBe(true);
  });

  it('still rejects an invalid value for a provided field', () => {
    expect(UpdateChallengeSchema.safeParse({ windowDays: 0 }).success).toBe(false);
  });
});
