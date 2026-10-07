import { describe, expect, it } from 'vitest';
import {
  corsHeaders,
  isCorsEligiblePath,
  parseAllowedOrigins,
  resolveCorsOrigin,
} from '@/lib/http/cors';

describe('cors helpers', () => {
  it('parses a comma-separated list, trims, drops trailing slashes and wildcards', () => {
    expect(parseAllowedOrigins(' https://a.example.com/ , https://b.example.com,*, ')).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins('')).toEqual([]);
  });

  it('only echoes exact allow-listed origins', () => {
    const raw = 'https://app.example.com';
    expect(resolveCorsOrigin('https://app.example.com', raw)).toBe('https://app.example.com');
    expect(resolveCorsOrigin('https://evil.example.com', raw)).toBeNull();
    expect(resolveCorsOrigin('https://app.example.com.evil.com', raw)).toBeNull();
    expect(resolveCorsOrigin(null, raw)).toBeNull();
  });

  it('is disabled when nothing is configured', () => {
    expect(resolveCorsOrigin('https://app.example.com', undefined)).toBeNull();
    expect(resolveCorsOrigin('https://app.example.com', '*')).toBeNull();
  });

  it('never grants credentials; preflight adds methods/headers', () => {
    const simple = corsHeaders('https://app.example.com', false);
    expect(simple['Access-Control-Allow-Origin']).toBe('https://app.example.com');
    expect(simple).not.toHaveProperty('Access-Control-Allow-Credentials');
    expect(simple).not.toHaveProperty('Access-Control-Allow-Methods');
    const pre = corsHeaders('https://app.example.com', true);
    expect(pre['Access-Control-Allow-Headers']).toContain('Authorization');
    expect(pre['Access-Control-Allow-Methods']).toContain('PATCH');
    expect(pre).not.toHaveProperty('Access-Control-Allow-Credentials');
  });

  it('excludes NextAuth routes and non-API paths', () => {
    expect(isCorsEligiblePath('/api/mobile/auth/login')).toBe(true);
    expect(isCorsEligiblePath('/api/creators/abc/teaser')).toBe(true);
    expect(isCorsEligiblePath('/api/auth/callback/credentials')).toBe(false);
    expect(isCorsEligiblePath('/dashboard')).toBe(false);
  });
});
