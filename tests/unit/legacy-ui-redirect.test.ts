import { describe, expect, it } from 'vitest';
import { isLegacyUiPath, legacyUiRedirectTarget } from '@/lib/http/legacy-ui-redirect';

const WEB = 'https://web.example.com';
const SELF = 'https://api.example.com';

describe('isLegacyUiPath', () => {
  it('knows every retired page prefix, nested paths included', () => {
    for (const path of ['/', '/login', '/register', '/reset-password', '/invite/abc', '/creators', '/creators/u1', '/dashboard', '/profile/goals', '/admin/groups/g1', '/onboarding', '/notifications', '/trends']) {
      expect(isLegacyUiPath(path)).toBe(true);
    }
  });

  it('never touches the API or unrelated paths', () => {
    for (const path of ['/api/goals', '/api/auth/verify-email', '/loginx', '/profiles', '/healthz', '/administrator']) {
      expect(isLegacyUiPath(path)).toBe(false);
    }
  });
});

describe('legacyUiRedirectTarget', () => {
  it('forwards the path and the query string (e-mailed links keep working)', () => {
    expect(legacyUiRedirectTarget('/reset-password', '?token=abc', WEB, SELF)).toBe(`${WEB}/reset-password?token=abc`);
    expect(legacyUiRedirectTarget('/invite/tok', '', WEB, SELF)).toBe(`${WEB}/invite/tok`);
    expect(legacyUiRedirectTarget('/profile/goals', '', WEB, SELF)).toBe(`${WEB}/profile/goals`);
  });

  it('sends the old dashboard and the root to the Today tab', () => {
    expect(legacyUiRedirectTarget('/dashboard', '', WEB, SELF)).toBe(`${WEB}/`);
    expect(legacyUiRedirectTarget('/', '', WEB, SELF)).toBe(`${WEB}/`);
  });

  it('strips trailing slashes from the configured origin', () => {
    expect(legacyUiRedirectTarget('/login', '?verified=1', `${WEB}/`, SELF)).toBe(`${WEB}/login?verified=1`);
  });

  it('does not redirect API paths', () => {
    expect(legacyUiRedirectTarget('/api/goals', '', WEB, SELF)).toBeNull();
  });

  it('does not redirect (no loop) when WEB_APP_URL is unset or is the backend itself', () => {
    expect(legacyUiRedirectTarget('/login', '', undefined, SELF)).toBeNull();
    expect(legacyUiRedirectTarget('/login', '', '  ', SELF)).toBeNull();
    expect(legacyUiRedirectTarget('/login', '', `${SELF}/`, SELF)).toBeNull();
  });
});
