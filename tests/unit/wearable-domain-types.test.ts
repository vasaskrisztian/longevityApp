import { describe, it, expect } from 'vitest';
import {
  isSupportedWearableProvider,
  SUPPORTED_WEARABLE_PROVIDERS,
} from '@/modules/wearable/domain/wearable-provider.types';

describe('SUPPORTED_WEARABLE_PROVIDERS', () => {
  it('lists exactly the providers with a real adapter today (Oura only)', () => {
    expect(SUPPORTED_WEARABLE_PROVIDERS).toEqual(['OURA']);
  });
});

describe('isSupportedWearableProvider', () => {
  it('returns true for a supported provider', () => {
    expect(isSupportedWearableProvider('OURA')).toBe(true);
  });

  it('returns false for a provider defined in the schema but not yet supported', () => {
    expect(isSupportedWearableProvider('GARMIN')).toBe(false);
    expect(isSupportedWearableProvider('WHOOP')).toBe(false);
  });

  it('returns false for an arbitrary/unknown string', () => {
    expect(isSupportedWearableProvider('NOT_A_PROVIDER')).toBe(false);
    expect(isSupportedWearableProvider('')).toBe(false);
  });
});
