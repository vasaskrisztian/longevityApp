import { sendEmail } from '@/lib/email/mailer';
import { DEFAULT_LANGUAGE, type Language } from '@/lib/i18n/languages';
import { st } from '@/lib/i18n/messages';
import { resolveWebAppOrigin } from '@/lib/http/app-url';
import { logger } from '@/lib/logging/logger';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildInvitationUrl(rawToken: string): string {
  return `${resolveWebAppOrigin()}/invite/${rawToken}`;
}

/**
 * The invitation email: group name, its logo (when it has one — served
 * publicly by the backend, which is why the image URL uses `APP_URL`, the
 * backend origin), and one button-link to `/invite/<token>` on the web app.
 * Never throws (sendEmail never does); the invitation row is already saved.
 */
export async function sendGroupInvitationEmail(params: {
  to: string;
  groupId: string;
  groupName: string;
  hasLogo: boolean;
  rawToken: string;
  inviterName: string | null;
  expiresAt: Date;
  /** Language of the recipient (their account's, else the inviting administrator's). */
  language?: Language;
}): Promise<void> {
  const language = params.language ?? DEFAULT_LANGUAGE;
  const url = buildInvitationUrl(params.rawToken);
  const name = escapeHtml(params.groupName);
  const backendOrigin = (process.env.APP_URL ?? '').replace(/\/+$/, '');
  const logoHtml = params.hasLogo
    ? `<p><img src="${backendOrigin}/api/groups/${params.groupId}/logo" alt="${name}" style="max-height:72px;max-width:240px" /></p>`
    : '';
  const expires = params.expiresAt.toISOString().slice(0, 10);
  const htmlBy = params.inviterName ? st(language, 'email.invite.by', { inviter: escapeHtml(params.inviterName) }) : '';
  const textBy = params.inviterName ? st(language, 'email.invite.by', { inviter: params.inviterName }) : '';
  const outro = st(language, 'email.invite.outro', { expires });

  logger.info('group_invitation_email_dispatched', { emailDomain: params.to.split('@')[1] ?? '' });
  await sendEmail({
    to: params.to,
    subject: st(language, 'email.invite.subject', { group: params.groupName }),
    html:
      `${logoHtml}<p>${st(language, 'email.invite.html.intro', { by: htmlBy, group: name })}</p>` +
      `<p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#16a34a;color:#fff;border-radius:6px;text-decoration:none">${st(language, 'email.invite.html.button')}</a></p>` +
      `<p>${st(language, 'email.invite.html.orLink')} <a href="${url}">${url}</a></p>` +
      `<p>${outro}</p>`,
    text:
      `${st(language, 'email.invite.text.intro', { by: textBy, group: params.groupName })}\n\n` +
      `${st(language, 'email.invite.text.view')} ${url}\n\n` +
      outro,
  });
}
