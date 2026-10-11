const mockFetch = jest.fn();
jest.mock('@/src/api/client', () => ({ apiFetch: (...a: unknown[]) => mockFetch(...a) }));

import { AccountError, changePassword, deleteAccount } from '../account';

const ok = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
const fail = (status: number, body: unknown) => Promise.resolve({ ok: false, status, json: () => Promise.resolve(body) });

beforeEach(() => mockFetch.mockReset());

describe('account api', () => {
  it('posts the password change with the confirmation filled in', async () => {
    mockFetch.mockReturnValue(ok());
    await changePassword({ currentPassword: 'old-pass-1', newPassword: 'new-pass-22' });
    expect(mockFetch).toHaveBeenCalledWith('/api/account/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'old-pass-1', newPassword: 'new-pass-22', newPasswordConfirmation: 'new-pass-22' }),
    });
  });

  it('sends the password with DELETE /api/account', async () => {
    mockFetch.mockReturnValue(ok());
    await deleteAccount('secret');
    expect(mockFetch).toHaveBeenCalledWith('/api/account', { method: 'DELETE', body: JSON.stringify({ password: 'secret' }) });
  });

  it('surfaces the server message', async () => {
    mockFetch.mockReturnValue(fail(409, { error: 'Administrator accounts cannot be deleted here.' }));
    await expect(deleteAccount('x')).rejects.toMatchObject({ status: 409, message: 'Administrator accounts cannot be deleted here.' });
  });

  it('falls back to a generic message for structured validation errors', async () => {
    mockFetch.mockReturnValue(fail(400, { error: { fieldErrors: { newPassword: ['too short'] } } }));
    const err = await changePassword({ currentPassword: 'a', newPassword: 'b' }).catch((e) => e);
    expect(err).toBeInstanceOf(AccountError);
    expect(err.message).toMatch(/not accepted/);
  });
});
