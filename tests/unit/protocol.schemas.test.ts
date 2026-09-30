import { describe, it, expect } from 'vitest';
import {
  CreateProtocolSchema,
  UpdateProtocolSchema,
  ProtocolSupplementSchema,
} from '@/lib/validation/protocol.schemas';

const VALID_PROTOCOL = {
  name: 'Base building',
  description: 'Foundation phase before the cut',
  isActive: true,
  targetSleepScore: 85,
  targetSleepMinutes: 480,
  targetWeeklyWorkouts: 4,
  targetDailyActiveCalories: 600,
  supplements: [
    { name: 'Vitamin D3', dosage: 4000, unit: 'IU', frequency: 'DAILY', timing: 'MORNING' },
  ],
};

describe('ProtocolSupplementSchema', () => {
  it('accepts a fully valid supplement target', () => {
    expect(ProtocolSupplementSchema.safeParse(VALID_PROTOCOL.supplements[0]).success).toBe(true);
  });

  it('accepts a minimal supplement target with only a name', () => {
    expect(ProtocolSupplementSchema.safeParse({ name: 'Magnesium' }).success).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(ProtocolSupplementSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejects a non-positive dosage', () => {
    expect(ProtocolSupplementSchema.safeParse({ name: 'Zinc', dosage: 0 }).success).toBe(false);
  });

  it('rejects an invalid frequency enum value', () => {
    expect(
      ProtocolSupplementSchema.safeParse({ name: 'Zinc', frequency: 'CONSTANTLY' }).success,
    ).toBe(false);
  });
});

describe('CreateProtocolSchema', () => {
  it('accepts a fully valid protocol payload', () => {
    expect(CreateProtocolSchema.safeParse(VALID_PROTOCOL).success).toBe(true);
  });

  it('accepts a minimal payload with only a name', () => {
    const result = CreateProtocolSchema.safeParse({ name: 'Just a name' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(false);
      expect(result.data.supplements).toEqual([]);
    }
  });

  it('rejects an empty name', () => {
    const result = CreateProtocolSchema.safeParse({ ...VALID_PROTOCOL, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a targetSleepScore above 100', () => {
    const result = CreateProtocolSchema.safeParse({ ...VALID_PROTOCOL, targetSleepScore: 150 });
    expect(result.success).toBe(false);
  });

  it('rejects a targetSleepMinutes above 1440 (one day)', () => {
    const result = CreateProtocolSchema.safeParse({ ...VALID_PROTOCOL, targetSleepMinutes: 2000 });
    expect(result.success).toBe(false);
  });

  it('rejects a negative targetWeeklyWorkouts', () => {
    const result = CreateProtocolSchema.safeParse({ ...VALID_PROTOCOL, targetWeeklyWorkouts: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a supplement list entry that fails its own validation', () => {
    const result = CreateProtocolSchema.safeParse({
      ...VALID_PROTOCOL,
      supplements: [{ name: '' }],
    });
    expect(result.success).toBe(false);
  });

  // A blank number input submits '' (not undefined) via react-hook-form's
  // register(). z.coerce.number() runs before .optional() is checked, and
  // Number('') is 0, not NaN -- so without the blankToUndefined preprocess,
  // every one of these would silently save as a real "0" target/dosage
  // instead of staying unset. See protocol.schemas.ts's blankToUndefined.
  it('treats a blank target field as unset rather than coercing it to 0', () => {
    const result = CreateProtocolSchema.safeParse({
      name: 'Just a name',
      targetSleepScore: '',
      targetSleepMinutes: '',
      targetWeeklyWorkouts: '',
      targetDailyActiveCalories: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetSleepScore).toBeUndefined();
      expect(result.data.targetSleepMinutes).toBeUndefined();
      expect(result.data.targetWeeklyWorkouts).toBeUndefined();
      expect(result.data.targetDailyActiveCalories).toBeUndefined();
    }
  });

  it('treats a blank supplement dosage as unset rather than a positive-number validation failure', () => {
    const result = CreateProtocolSchema.safeParse({
      ...VALID_PROTOCOL,
      supplements: [{ name: 'Magnesium', dosage: '' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.supplements[0]?.dosage).toBeUndefined();
    }
  });
});

describe('UpdateProtocolSchema', () => {
  it('accepts a partial payload with a single field (e.g. "set as active")', () => {
    expect(UpdateProtocolSchema.safeParse({ isActive: true }).success).toBe(true);
  });

  it('accepts an empty object (no-op update)', () => {
    expect(UpdateProtocolSchema.safeParse({}).success).toBe(true);
  });

  it('still rejects an invalid value for a provided field', () => {
    expect(UpdateProtocolSchema.safeParse({ targetSleepScore: 500 }).success).toBe(false);
  });
});
