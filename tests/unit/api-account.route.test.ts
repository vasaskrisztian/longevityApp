import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireAuthenticatedUser = vi.fn();
vi.mock('@/lib/auth/authorization', () => ({
  requireAuthenticatedUser,
  toErrorResponse: (error: Error & { status?: number }) =>
    Response.json({ error: error.message }, { status: error.status ?? 401 }),
}));
const checkRateLimit = vi.fn();
vi.mock('@/lib/auth/rate-limit', () => ({ checkRateLimit, AUTH_RATE_LIMIT: { windowMs: 900_000, max: 5 } }));
const changePassword = vi.fn();
const deleteAccount = vi.fn();
vi.mock('@/modules/auth/account.service', () => ({ changePassword, deleteAccount }));

const { POST: postPassword } = await import('@/app/api/account/password/route');
const { DELETE: deleteAccountRoute } = await import('@/app/api/account/route');

const json = (method: string, body: unknown) =>
  new Request('http://localhost/api/account', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const VALID_CHANGE = { currentPassword: 'OldPassword123', newPassword: 'NewPassword123', newPasswordConfirmation: 'NewPassword123' };

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthenticatedUser.mockResolvedValue({ id: 'u1', role: 'USER' });
  checkRateLimit.mockReturnValue({ allowed: true, remaining: 4, resetAt: 0 });
});

describe('POST /api/account/password', () => {
  it('requires a signed-in user and never touches the service otherwise', async () => {
    requireAuthenticatedUser.mockRejectedValue(Object.assign(new Error('Unauthenticated'), { status: 401 }));
    const response = await postPassword(json('POST', VALID_CHANGE));
    expect(response.status).toBe(401);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('is rate-limited per user', async () => {
    checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: 0 });
    const response = await postPassword(json('POST', VALID_CHANGE));
    expect(response.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith('password-change', 'u1', expect.anything());
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('rejects a weak, mismatching or unchanged new password', async () => {
    for (const body of [
      { ...VALID_CHANGE, newPassword: 'short', newPasswordConfirmation: 'short' },
      { ...VALID_CHANGE, newPasswordConfirmation: 'Different123' },
      { ...VALID_CHANGE, newPassword: 'OldPassword123', newPasswordConfirmation: 'OldPassword123' },
    ]) {
      expect((await postPassword(json('POST', body))).status).toBe(400);
    }
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('acts only on the caller\'s own id and reports a wrong current password as 400', async () => {
    changePassword.mockResolvedValue('wrong_password');
    const response = await postPassword(json('POST', { ...VALID_CHANGE, userId: 'someone-else' }));
    expect(response.status).toBe(400);
    expect(changePassword).toHaveBeenCalledWith('u1', 'OldPassword123', 'NewPassword123');
  });

  it('returns 200 on success', async () => {
    changePassword.mockResolvedValue('ok');
    expect((await postPassword(json('POST', VALID_CHANGE))).status).toBe(200);
  });
});

describe('DELETE /api/account', () => {
  it('requires a signed-in user', async () => {
    requireAuthenticatedUser.mockRejectedValue(Object.assign(new Error('Unauthenticated'), { status: 401 }));
    expect((await deleteAccountRoute(json('DELETE', { password: 'x' }))).status).toBe(401);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('requires the password in the body', async () => {
    expect((await deleteAccountRoute(json('DELETE', {}))).status).toBe(400);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('maps service results: 400 wrong password, 409 admin, 204 deleted — only ever for the caller\'s own id', async () => {
    deleteAccount.mockResolvedValueOnce('wrong_password');
    expect((await deleteAccountRoute(json('DELETE', { password: 'x', userId: 'other' }))).status).toBe(400);
    expect(deleteAccount).toHaveBeenCalledWith('u1', 'x');

    deleteAccount.mockResolvedValueOnce('admin_account');
    expect((await deleteAccountRoute(json('DELETE', { password: 'x' }))).status).toBe(409);

    deleteAccount.mockResolvedValueOnce('ok');
    expect((await deleteAccountRoute(json('DELETE', { password: 'x' }))).status).toBe(204);
  });

  it('is rate-limited per user', async () => {
    checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: 0 });
    expect((await deleteAccountRoute(json('DELETE', { password: 'x' }))).status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith('account-delete', 'u1', expect.anything());
  });
});
