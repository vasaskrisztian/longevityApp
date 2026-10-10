import { inviteView, safeNextPath } from '../inviteFlow';

const valid = { status: 'valid' as const, groupName: 'Acme', email: 'Jane@Acme.com', accountExists: false };
const out = { signedIn: false, email: null };

describe('safeNextPath', () => {
  it('accepts only invitation paths', () => {
    expect(safeNextPath('/invite/abcDEF123456_-xyz')).toBe('/invite/abcDEF123456_-xyz');
    expect(safeNextPath(['/invite/abcDEF123456'])).toBe('/invite/abcDEF123456');
  });
  it('rejects everything else (open redirect safe)', () => {
    for (const bad of [undefined, null, '', '/', '/admin', 'https://evil.com', '//evil.com', '/invite/', '/invite/short', '/invite/../x', '/invite/abc def12345']) {
      expect(safeNextPath(bad as never)).toBeNull();
    }
  });
});

describe('inviteView', () => {
  it('loading and load failure', () => {
    expect(inviteView(null, true, out).kind).toBe('loading');
    expect(inviteView(null, false, out).kind).toBe('unavailable');
  });
  it.each(['expired', 'revoked', 'accepted', 'invalid'] as const)('unusable invitation: %s', (status) => {
    const view = inviteView({ status }, false, out);
    expect(view.kind).toBe('unavailable');
  });
  it('signed out: register or log in depending on account existence', () => {
    expect(inviteView(valid, false, out).kind).toBe('register');
    expect(inviteView({ ...valid, accountExists: true }, false, out).kind).toBe('login');
  });
  it('signed in with the invited address (case-insensitive) can accept', () => {
    expect(inviteView(valid, false, { signedIn: true, email: 'jane@acme.com' }).kind).toBe('accept');
  });
  it('signed in as someone else is told so', () => {
    expect(inviteView(valid, false, { signedIn: true, email: 'bob@acme.com' })).toEqual({
      kind: 'wrong_account',
      invitedEmail: 'Jane@Acme.com',
      currentEmail: 'bob@acme.com',
    });
  });
});
