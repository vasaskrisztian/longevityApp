import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import middleware from '@/middleware';

const req = (path: string, init: { method?: string; origin?: string } = {}) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: init.method ?? 'GET',
    headers: init.origin ? { origin: init.origin } : {},
  });

describe('middleware CORS for /api/*', () => {
  beforeEach(() => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';
  });
  afterEach(() => {
    delete process.env.CORS_ALLOWED_ORIGINS;
  });

  it('answers a preflight from an allowed origin with 204 and CORS headers', async () => {
    const res = (await middleware(req('/api/profile', { method: 'OPTIONS', origin: 'https://app.example.com' }))) as Response;
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(res.headers.get('access-control-allow-headers')).toContain('Authorization');
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('adds the allow-origin header to a normal API request', async () => {
    const res = (await middleware(req('/api/profile', { origin: 'https://app.example.com' }))) as Response;
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(res.headers.get('vary')).toContain('Origin');
  });

  it('grants nothing to an unlisted origin or when unconfigured', async () => {
    const bad = (await middleware(req('/api/profile', { origin: 'https://evil.example.com' }))) as Response;
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
    delete process.env.CORS_ALLOWED_ORIGINS;
    const off = (await middleware(req('/api/profile', { origin: 'https://app.example.com' }))) as Response;
    expect(off.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('also covers the auth routes (register / password reset are called from the web export)', async () => {
    const res = (await middleware(req('/api/auth/request-password-reset', { origin: 'https://app.example.com' }))) as Response;
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(res.status).toBe(200);
  });
});

describe('middleware: retired UI pages', () => {
  const saved = { web: process.env.WEB_APP_URL, app: process.env.APP_URL };
  afterEach(() => {
    if (saved.web === undefined) delete process.env.WEB_APP_URL;
    else process.env.WEB_APP_URL = saved.web;
    if (saved.app === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = saved.app;
  });

  it('forwards an old page, query included, to the Expo web app', async () => {
    process.env.WEB_APP_URL = 'https://web.example.com';
    process.env.APP_URL = 'https://api.example.com';
    const res = (await middleware(req('/reset-password?token=abc'))) as Response;
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://web.example.com/reset-password?token=abc');
  });

  it('sends the root and the old dashboard to the Today tab', async () => {
    process.env.WEB_APP_URL = 'https://web.example.com';
    process.env.APP_URL = 'https://api.example.com';
    expect(((await middleware(req('/'))) as Response).headers.get('location')).toBe('https://web.example.com/');
    expect(((await middleware(req('/dashboard'))) as Response).headers.get('location')).toBe('https://web.example.com/');
  });

  it('answers 404 JSON (never loops) when WEB_APP_URL is not configured', async () => {
    delete process.env.WEB_APP_URL;
    process.env.APP_URL = 'https://api.example.com';
    const res = (await middleware(req('/login'))) as Response;
    expect(res.status).toBe(404);
    expect(res.headers.get('location')).toBeNull();
  });

  it('does not touch API routes that are not CORS-eligible, or unrelated paths', async () => {
    process.env.WEB_APP_URL = 'https://web.example.com';
    expect(((await middleware(req('/api/auth/session'))) as Response).headers.get('location')).toBeNull();
    expect(((await middleware(req('/healthz'))) as Response).headers.get('location')).toBeNull();
  });
});
