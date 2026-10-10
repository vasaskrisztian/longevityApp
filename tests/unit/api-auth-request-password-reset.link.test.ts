import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 4, resetAt: 0 }),
  getClientIdentifier: () => '127.0.0.1',
  AUTH_RATE_LIMIT: { windowMs: 900_000, max: 5 },
}));
vi.mock('@/modules/auth/auth.service', () => ({
  requestPasswordReset: vi.fn().mockResolvedValue('tok123'),
}));
vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
const sendEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/email/mailer', () => ({ sendEmail: sendEmailMock }));

const { POST } = await import('@/app/api/auth/request-password-reset/route');
const post = () =>
  POST(
    new Request('http://localhost/api/auth/request-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'jane@example.com' }),
    }),
  );

const saved = { app: process.env.APP_URL, web: process.env.WEB_APP_URL };
beforeEach(() => sendEmailMock.mockClear());
afterEach(() => {
  if (saved.app === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = saved.app;
  if (saved.web === undefined) delete process.env.WEB_APP_URL;
  else process.env.WEB_APP_URL = saved.web;
});

describe('password-reset email link target', () => {
  it('points at WEB_APP_URL (the Expo web app) when configured', async () => {
    process.env.APP_URL = 'https://api.example.com';
    process.env.WEB_APP_URL = 'https://web.example.com';
    await post();
    expect(sendEmailMock.mock.calls[0]?.[0]?.text).toContain('https://web.example.com/reset-password?token=tok123');
  });

  it('keeps using APP_URL when WEB_APP_URL is unset', async () => {
    process.env.APP_URL = 'https://api.example.com';
    delete process.env.WEB_APP_URL;
    await post();
    expect(sendEmailMock.mock.calls[0]?.[0]?.text).toContain('https://api.example.com/reset-password?token=tok123');
  });
});
