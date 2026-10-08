import { afterEach, describe, expect, it } from 'vitest';
import { resolveWebAppOrigin } from '@/lib/http/app-url';

const saved = { app: process.env.APP_URL, web: process.env.WEB_APP_URL };
afterEach(() => {
  if (saved.app === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = saved.app;
  if (saved.web === undefined) delete process.env.WEB_APP_URL;
  else process.env.WEB_APP_URL = saved.web;
});

describe('resolveWebAppOrigin', () => {
  it('prefers WEB_APP_URL and strips trailing slashes', () => {
    process.env.WEB_APP_URL = 'https://web.example.com/';
    process.env.APP_URL = 'https://api.example.com';
    expect(resolveWebAppOrigin()).toBe('https://web.example.com');
  });

  it('falls back to APP_URL when WEB_APP_URL is unset (nothing changes until opted in)', () => {
    delete process.env.WEB_APP_URL;
    process.env.APP_URL = 'https://api.example.com';
    expect(resolveWebAppOrigin()).toBe('https://api.example.com');
  });

  it('is empty (relative link) when neither is set', () => {
    delete process.env.WEB_APP_URL;
    delete process.env.APP_URL;
    expect(resolveWebAppOrigin()).toBe('');
  });
});
