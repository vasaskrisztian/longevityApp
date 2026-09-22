import { describe, it, expect } from 'vitest';
import { CreateSupplementSchema, UpdateSupplementSchema } from '@/lib/validation/supplement.schemas';

const VALID_SUPPLEMENT = {
  name: 'Vitamin D3',
  dosage: 2000,
  unit: 'IU',
  frequency: 'DAILY',
  timing: 'MORNING',
  notes: 'With breakfast',
  active: true,
};

describe('CreateSupplementSchema', () => {
  it('accepts a fully valid supplement payload', () => {
    expect(CreateSupplementSchema.safeParse(VALID_SUPPLEMENT).success).toBe(true);
  });

  it('defaults active to true when omitted', () => {
    const { active: _active, ...rest } = VALID_SUPPLEMENT;
    const result = CreateSupplementSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.active).toBe(true);
    }
  });

  it('accepts a payload without the optional timing field', () => {
    const { timing: _timing, ...rest } = VALID_SUPPLEMENT;
    expect(CreateSupplementSchema.safeParse(rest).success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = CreateSupplementSchema.safeParse({ ...VALID_SUPPLEMENT, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a zero or negative dosage', () => {
    expect(CreateSupplementSchema.safeParse({ ...VALID_SUPPLEMENT, dosage: 0 }).success).toBe(
      false,
    );
    expect(CreateSupplementSchema.safeParse({ ...VALID_SUPPLEMENT, dosage: -5 }).success).toBe(
      false,
    );
  });

  it('rejects an empty unit', () => {
    const result = CreateSupplementSchema.safeParse({ ...VALID_SUPPLEMENT, unit: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid frequency enum value', () => {
    const result = CreateSupplementSchema.safeParse({
      ...VALID_SUPPLEMENT,
      frequency: 'HOURLY',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid timing enum value', () => {
    const result = CreateSupplementSchema.safeParse({ ...VALID_SUPPLEMENT, timing: 'MIDNIGHT' });
    expect(result.success).toBe(false);
  });
});

describe('UpdateSupplementSchema', () => {
  it('accepts a partial payload with a single field', () => {
    const result = UpdateSupplementSchema.safeParse({ dosage: 500 });
    expect(result.success).toBe(true);
  });

  it('accepts an empty object (no-op update)', () => {
    expect(UpdateSupplementSchema.safeParse({}).success).toBe(true);
  });

  it('still rejects an invalid value for a provided field', () => {
    const result = UpdateSupplementSchema.safeParse({ dosage: -1 });
    expect(result.success).toBe(false);
  });
});
