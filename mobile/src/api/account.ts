import { apiFetch } from '@/src/api/client';

/**
 * Own-account functions (backend: src/app/api/account/**). Both re-confirm the
 * current password server-side. The backend answers validation problems with a
 * structured object and everything else with a plain message, so errors are
 * normalised here to a single readable string.
 */

export class AccountError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AccountError';
  }
}

async function send(path: string, method: 'POST' | 'DELETE', body: unknown): Promise<void> {
  const response = await apiFetch(path, { method, body: JSON.stringify(body) });
  if (response.ok) return;
  const payload = await response.json().catch(() => null);
  const message = typeof payload?.error === 'string' ? payload.error : 'The request was not accepted. Check the values and try again.';
  throw new AccountError(response.status, message);
}

/** On success every mobile session of the account is revoked server-side — the caller must sign this device out. */
export const changePassword = (input: { currentPassword: string; newPassword: string }) =>
  send('/api/account/password', 'POST', { ...input, newPasswordConfirmation: input.newPassword });

/** Permanently deletes the account and all its data. */
export const deleteAccount = (password: string) => send('/api/account', 'DELETE', { password });
