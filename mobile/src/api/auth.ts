import { API_BASE_URL } from '@/src/config/env';
import type { RegisterFormInput } from '@/src/validation/schemas';

/**
 * The three unauthenticated account-lifecycle routes (register, request a
 * password-reset email, confirm a reset). Deliberately plain `fetch`, not
 * `apiFetch` — these are called while signed out, so there's no Bearer
 * token to attach and no refresh to attempt (same reasoning as
 * src/auth/sessionStore.ts's login/refresh calls). All three return the
 * same generic response whether or not the email exists (user-enumeration
 * protection, ARCHITECTURE.md §10 threat 7), so the screens never need to
 * distinguish "unknown account" from "sent".
 */

export type AuthRequestResult = { ok: true } | { ok: false; reason: 'rate_limited' | 'invalid' | 'error' };

async function postJson(path: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return null; // network failure
  }
}

function toResult(response: Response | null): AuthRequestResult {
  if (!response) return { ok: false, reason: 'error' };
  if (response.ok) return { ok: true }; // register answers 201, the others 200
  if (response.status === 429) return { ok: false, reason: 'rate_limited' };
  if (response.status === 400) return { ok: false, reason: 'invalid' };
  return { ok: false, reason: 'error' };
}

/** POST /api/auth/register — sends the verification email; 201 either way. */
export async function registerAccount(input: RegisterFormInput): Promise<AuthRequestResult> {
  return toResult(await postJson('/api/auth/register', input));
}

/** POST /api/auth/request-password-reset — always 200 for a valid email shape. */
export async function requestPasswordReset(email: string): Promise<AuthRequestResult> {
  return toResult(await postJson('/api/auth/request-password-reset', { email }));
}

/** POST /api/auth/reset-password — 400 means the link is invalid/expired. */
export async function confirmPasswordReset(
  token: string,
  password: string,
  passwordConfirmation: string,
): Promise<AuthRequestResult> {
  return toResult(await postJson('/api/auth/reset-password', { token, password, passwordConfirmation }));
}

export type InviteRegistrationResult =
  | { ok: true }
  | { ok: false; reason: 'account_exists' | 'rate_limited' | 'invalid' | 'error'; message?: string };

/**
 * POST /api/auth/register with a group-invitation token. Unlike plain
 * registration the answer is specific (the holder received the link by email
 * at this very address, so nothing is leaked): the account starts
 * email-verified and the person joins the group in the same call, so the
 * caller can log in right away.
 */
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
  const response = await postJson('/api/auth/register', input);
  if (!response) return { ok: false, reason: 'error' };
  if (response.ok) return { ok: true };
  const body = await response.json().catch(() => null);
  if (response.status === 409) return { ok: false, reason: 'account_exists', message: body?.error };
  if (response.status === 429) return { ok: false, reason: 'rate_limited' };
  if (response.status === 400) return { ok: false, reason: 'invalid', message: typeof body?.error === 'string' ? body.error : undefined };
  return { ok: false, reason: 'error' };
}
