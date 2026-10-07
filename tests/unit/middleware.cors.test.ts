import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { authHandler } = vi.hoisted(() => ({ authHandler: vi.fn(() => new Response('auth-path')) }));
vi.mock('next-auth', () => ({ default: () => ({ auth: () => authHandler }) }));
vi.mock('@/lib/auth/auth.config', () => ({ authConfig: {} }));

import middleware from '@/middleware';

const event = {} as never;
const req = (path: string, init: { method?: string; origin?: string } = {}) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: init.method ?? 'GET',
    headers: init.origin ? { origin: init.origin } : {},
  });

describe('middleware CORS for /api/*', () => {
  beforeEach(() => {
    authHandler.mockClear();
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';
  });
  afterEach(() => {
    delete process.env.CORS_ALLOWED_ORIGINS;
  });

  it('answers a preflight from an allowed origin with 204 and CORS headers', async () => {
    const res = (await middleware(req('/api/profile', { method: 'OPTIONS', origin: 'https://app.example.com' }), event)) as Response;
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(res.headers.get('access-control-allow-headers')).toContain('Authorization');
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
    expect(authHandler).not.toHaveBeenCalled();
  });

  it('adds the allow-origin header to a normal API request', async () => {
    const res = (await middleware(req('/api/profile', { origin: 'https://app.example.com' }), event)) as Response;
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(res.headers.get('vary')).toContain('Origin');
  });

  it('grants nothing to an unlisted origin or when unconfigured', async () => {
    const bad = (await middleware(req('/api/profile', { origin: 'https://evil.example.com' }), event)) as Response;
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
    delete process.env.CORS_ALLOWED_ORIGINS;
    const off = (await middleware(req('/api/profile', { origin: 'https://app.example.com' }), event)) as Response;
    expect(off.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('leaves UI routes and NextAuth routes to the existing handling', async () => {
    await middleware(req('/dashboard'), event);
    expect(authHandler).toHaveBeenCalledTimes(1);
    const res = (await middleware(req('/api/auth/session', { origin: 'https://app.example.com' }), event)) as Response;
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
