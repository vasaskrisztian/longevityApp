import type { InvitationPreview } from '@/src/api/groups';
import { t } from '@/src/i18n';

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

/** Resolved at call time, so the text follows the current language. */
function unavailableMessage(status: string): string {
  switch (status) {
    case 'expired':
      return t('invite.unavailable.expired');
    case 'revoked':
      return t('invite.unavailable.revoked');
    case 'accepted':
      return t('invite.unavailable.accepted');
    default:
      return t('invite.unavailable.invalid');
  }
}

/** Decides which part of the invitation screen to show. */
export function inviteView(
  preview: InvitationPreview | null | undefined,
  loading: boolean,
  session: { signedIn: boolean; email: string | null },
): InviteView {
  if (loading) return { kind: 'loading' };
  if (!preview) return { kind: 'unavailable', message: t('invite.unavailable.loadFailed') };
  if (preview.status !== 'valid') {
    return { kind: 'unavailable', message: unavailableMessage(preview.status) };
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
