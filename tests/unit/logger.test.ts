import { describe, it, expect, vi, afterEach } from 'vitest';
import { logger } from '@/lib/logging/logger';

function lastLogArg(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const call = spy.mock.calls.at(-1);
  return JSON.parse(call?.[0] as string);
}

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logger.info writes a structured JSON line to console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('user_registered', { userId: 'u1' });

    const entry = lastLogArg(spy);
    expect(entry.level).toBe('info');
    expect(entry.event).toBe('user_registered');
    expect(entry.userId).toBe('u1');
    expect(typeof entry.timestamp).toBe('string');
  });

  it('logger.warn writes to console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('login_rate_limited', { identifier: '1.2.3.4' });

    const entry = lastLogArg(spy);
    expect(entry.level).toBe('warn');
    expect(entry.identifier).toBe('1.2.3.4');
  });

  it('logger.error writes to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('registration_failed', { message: 'boom' });

    const entry = lastLogArg(spy);
    expect(entry.level).toBe('error');
    expect(entry.message).toBe('boom');
  });

  it('redacts fields whose key looks sensitive, by allowlist not denylist', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('oauth_token_refreshed', {
      accessToken: 'should-never-appear',
      refreshToken: 'should-never-appear-either',
      password: 'super-secret',
      userId: 'u1',
    });

    const entry = lastLogArg(spy);
    expect(entry.accessToken).toBe('[redacted]');
    expect(entry.refreshToken).toBe('[redacted]');
    expect(entry.password).toBe('[redacted]');
    expect(entry.userId).toBe('u1');
    expect(JSON.stringify(entry)).not.toContain('should-never-appear');
  });
});
