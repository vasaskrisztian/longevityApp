import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isOuraMockMode,
  loadOuraCredentials,
  OURA_REQUESTED_SCOPES,
} from '@/modules/wearable/providers/oura/oura-config';
import { ProviderNotConfiguredError } from '@/modules/wearable/domain/errors';

const ENV_KEYS = ['OURA_MOCK_MODE', 'OURA_CLIENT_ID', 'OURA_CLIENT_SECRET', 'OURA_REDIRECT_URI'] as const;
const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    original[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original[key];
    }
  }
});

describe('isOuraMockMode', () => {
  it('is false when OURA_MOCK_MODE is unset', () => {
    expect(isOuraMockMode()).toBe(false);
  });

  it('is false for any value other than the literal string "true"', () => {
    process.env.OURA_MOCK_MODE = 'TRUE';
    expect(isOuraMockMode()).toBe(false);
    process.env.OURA_MOCK_MODE = '1';
    expect(isOuraMockMode()).toBe(false);
  });

  it('is true when OURA_MOCK_MODE="true"', () => {
    process.env.OURA_MOCK_MODE = 'true';
    expect(isOuraMockMode()).toBe(true);
  });
});

describe('loadOuraCredentials', () => {
  it('throws ProviderNotConfiguredError when any of the three vars is missing', () => {
    expect(() => loadOuraCredentials()).toThrow(ProviderNotConfiguredError);

    process.env.OURA_CLIENT_ID = 'id';
    expect(() => loadOuraCredentials()).toThrow(ProviderNotConfiguredError);

    process.env.OURA_CLIENT_SECRET = 'secret';
    expect(() => loadOuraCredentials()).toThrow(ProviderNotConfiguredError);
  });

  it('returns the three values when all are set', () => {
    process.env.OURA_CLIENT_ID = 'id';
    process.env.OURA_CLIENT_SECRET = 'secret';
    process.env.OURA_REDIRECT_URI = 'https://app.example.com/api/integrations/oura/callback';

    expect(loadOuraCredentials()).toEqual({
      clientId: 'id',
      clientSecret: 'secret',
      redirectUri: 'https://app.example.com/api/integrations/oura/callback',
    });
  });
});

describe('OURA_REQUESTED_SCOPES', () => {
  it('matches ARCHITECTURE.md §5\'s exact MVP scope list', () => {
    expect(OURA_REQUESTED_SCOPES).toEqual(['personal', 'daily', 'heartrate', 'workout', 'spo2Daily']);
  });
});
