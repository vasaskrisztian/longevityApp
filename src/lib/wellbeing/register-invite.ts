export type InviteRegistrationResult =
  | { ok: true }
  | { ok: false; reason: 'account_exists' | 'rate_limited' | 'invalid' | 'error'; message?: string };

/** POST /api/auth/register with the invitation token — creates a verified account and joins the group. */
export async function registerFromInvitation(input: {
  fullName: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  termsAccepted: true;
  privacyAccepted: true;
  inviteToken: string;
  groupConsent: true;
}): Promise<InviteRegistrationResult> {
  let response: Response;
  try {
    response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, reason: 'error' };
  }
  if (response.ok) return { ok: true };
  const body = await response.json().catch(() => null);
  if (response.status === 409) return { ok: false, reason: 'account_exists' };
  if (response.status === 429) return { ok: false, reason: 'rate_limited' };
  if (response.status === 400) {
    return { ok: false, reason: 'invalid', message: typeof body?.error === 'string' ? body.error : undefined };
  }
  return { ok: false, reason: 'error' };
}
