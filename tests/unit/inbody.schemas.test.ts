import { describe, it, expect } from 'vitest';
import {
  UpdateInBodyMeasurementSchema,
  MAX_UPLOAD_BYTES,
  ACCEPTED_IMAGE_CONTENT_TYPES,
} from '@/lib/validation/inbody.schemas';

describe('UpdateInBodyMeasurementSchema', () => {
  it('accepts an empty object (no-op update)', () => {
    expect(UpdateInBodyMeasurementSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a partial payload with a single field', () => {
    const result = UpdateInBodyMeasurementSchema.safeParse({ weightKg: 90.5 });
    expect(result.success).toBe(true);
  });

  it('accepts null for any field, to clear it back to "not recorded"', () => {
    const result = UpdateInBodyMeasurementSchema.safeParse({ bmi: null, fatFreeMassKg: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bmi).toBeNull();
      expect(result.data.fatFreeMassKg).toBeNull();
    }
  });

  it('accepts a fully populated, physiologically plausible payload', () => {
    const result = UpdateInBodyMeasurementSchema.safeParse({
      measuredAt: '2026-03-12T09:14:00.000Z',
      weightKg: 91.5,
      bodyFatPercentage: 11.8,
      skeletalMuscleMassKg: 46.3,
      fatFreeMassKg: 80.7,
      bmi: 23.3,
      inBodyScore: 87,
      visceralFatLevel: 4,
      basalMetabolicRateKcal: 2113,
      totalBodyWaterL: 59.2,
      ecwRatio: 0.375,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a weight outside the plausible human range', () => {
    expect(UpdateInBodyMeasurementSchema.safeParse({ weightKg: 5 }).success).toBe(false);
    expect(UpdateInBodyMeasurementSchema.safeParse({ weightKg: 500 }).success).toBe(false);
  });

  it('rejects a body fat percentage outside the plausible range', () => {
    expect(UpdateInBodyMeasurementSchema.safeParse({ bodyFatPercentage: 0 }).success).toBe(false);
    expect(UpdateInBodyMeasurementSchema.safeParse({ bodyFatPercentage: 95 }).success).toBe(false);
  });

  it('rejects a non-integer InBody score', () => {
    const result = UpdateInBodyMeasurementSchema.safeParse({ inBodyScore: 87.5 });
    expect(result.success).toBe(false);
  });

  it('rejects an InBody score outside 0-100', () => {
    expect(UpdateInBodyMeasurementSchema.safeParse({ inBodyScore: 150 }).success).toBe(false);
    expect(UpdateInBodyMeasurementSchema.safeParse({ inBodyScore: -1 }).success).toBe(false);
  });

  it('rejects an ECW ratio outside its tight physiological band', () => {
    expect(UpdateInBodyMeasurementSchema.safeParse({ ecwRatio: 0.5 }).success).toBe(false);
    expect(UpdateInBodyMeasurementSchema.safeParse({ ecwRatio: 0.1 }).success).toBe(false);
  });
});

describe('upload constraints', () => {
  it('caps uploads at 15MB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(15 * 1024 * 1024);
  });

  it('accepts JPEG, PNG and WebP but not HEIC', () => {
    expect(ACCEPTED_IMAGE_CONTENT_TYPES).toContain('image/jpeg');
    expect(ACCEPTED_IMAGE_CONTENT_TYPES).toContain('image/png');
    expect(ACCEPTED_IMAGE_CONTENT_TYPES).toContain('image/webp');
    expect(ACCEPTED_IMAGE_CONTENT_TYPES).not.toContain('image/heic');
  });
});
