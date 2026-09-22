import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerProvider,
  getProvider,
  getRegisteredProviderIds,
  _resetRegistryForTests,
} from '@/modules/wearable/domain/provider-registry';
import type { WearableProviderAdapter } from '@/modules/wearable/domain/wearable-provider.types';

function fakeAdapter(id: WearableProviderAdapter['id']): WearableProviderAdapter {
  return {
    id,
    getRedirectUri: () => {
      throw new Error('not implemented in this fake');
    },
    buildAuthorizationUrl: () => {
      throw new Error('not implemented in this fake');
    },
    exchangeAuthorizationCode: async () => {
      throw new Error('not implemented in this fake');
    },
    refreshAccessToken: async () => {
      throw new Error('not implemented in this fake');
    },
    revokeTokens: async () => {
      throw new Error('not implemented in this fake');
    },
    fetchRawData: async () => {
      throw new Error('not implemented in this fake');
    },
    mapToNormalizedFields: () => {
      throw new Error('not implemented in this fake');
    },
    mapToWorkout: () => {
      throw new Error('not implemented in this fake');
    },
  };
}

beforeEach(() => {
  _resetRegistryForTests();
});

describe('provider registry', () => {
  it('returns undefined for a provider nothing has registered', () => {
    expect(getProvider('OURA')).toBeUndefined();
    expect(getRegisteredProviderIds()).toEqual([]);
  });

  it('returns the exact adapter instance that was registered', () => {
    const adapter = fakeAdapter('OURA');
    registerProvider(adapter);

    expect(getProvider('OURA')).toBe(adapter);
    expect(getRegisteredProviderIds()).toEqual(['OURA']);
  });

  it('overwrites a previous registration for the same provider id', () => {
    const first = fakeAdapter('OURA');
    const second = fakeAdapter('OURA');
    registerProvider(first);
    registerProvider(second);

    expect(getProvider('OURA')).toBe(second);
    expect(getRegisteredProviderIds()).toEqual(['OURA']);
  });

  it('tracks multiple distinct provider ids independently', () => {
    registerProvider(fakeAdapter('OURA'));
    registerProvider(fakeAdapter('GARMIN'));

    expect(getRegisteredProviderIds().sort()).toEqual(['GARMIN', 'OURA']);
    expect(getProvider('WHOOP')).toBeUndefined();
  });
});
