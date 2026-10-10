import type { InvitationPreview } from '@/src/api/groups';

/**
 * Only in-app invitation paths may be used as a post-login redirect — never
 * an arbitrary URL (open-redirect safe). Returns null for anything else.
 */
export function safeNextPath(next: string | string[] | undefined | null): string | null {
  const value = Array.isArray(next) ? next[0] : next;
  if (typeof value !== 'string') return null;
  return /^\/invite\/[A-Za-z0-9_-]{8,200}$/.test(value) ? value : null;
}

export type InviteView =
  | { kind: 'loading' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'accept' }
  | { kind: 'wrong_account'; invitedEmail: string; currentEmail: string }
  | { kind: 'login' }
  | { kind: 'register' };

const UNAVAILABLE: Record<string, string> = {
  invalid: 'This invitation link is not valid.',
  expired: 'This invitation has expired. Ask the group administrator to send a new one.',
  revoked: 'This invitation was withdrawn by the group administrator.',
  accepted: 'This invitation has already been accepted.',
};

/** Decides which part of the invitation screen to show. */
export function inviteView(
  preview: InvitationPreview | null | undefined,
  loading: boolean,
  session: { signedIn: boolean; email: string | null },
): InviteView {
  if (loading) return { kind: 'loading' };
  if (!preview) return { kind: 'unavailable', message: 'The invitation could not be loaded. Check your connection and try again.' };
  if (preview.status !== 'valid') {
    return { kind: 'unavailable', message: UNAVAILABLE[preview.status] ?? UNAVAILABLE.invalid };
  }
  if (session.signedIn) {
    const invited = (preview.email ?? '').toLowerCase();
    const current = (session.email ?? '').toLowerCase();
    if (invited && invited !== current) {
      return { kind: 'wrong_account', invitedEmail: preview.email ?? '', currentEmail: session.email ?? '' };
    }
    return { kind: 'accept' };
  }
  return preview.accountExists ? { kind: 'login' } : { kind: 'register' };
}
