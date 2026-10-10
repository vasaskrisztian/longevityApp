import { sendEmail } from '@/lib/email/mailer';
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
}): Promise<void> {
  const url = buildInvitationUrl(params.rawToken);
  const name = escapeHtml(params.groupName);
  const by = params.inviterName ? ` by ${escapeHtml(params.inviterName)}` : '';
  const backendOrigin = (process.env.APP_URL ?? '').replace(/\/+$/, '');
  const logoHtml = params.hasLogo
    ? `<p><img src="${backendOrigin}/api/groups/${params.groupId}/logo" alt="${name}" style="max-height:72px;max-width:240px" /></p>`
    : '';
  const expires = params.expiresAt.toISOString().slice(0, 10);

  logger.info('group_invitation_email_dispatched', { emailDomain: params.to.split('@')[1] ?? '' });
  await sendEmail({
    to: params.to,
    subject: `You are invited to ${params.groupName} — Longevity Klub`,
    html:
      `${logoHtml}<p>You have been invited${by} to join <strong>${name}</strong> on Longevity Klub, a wellbeing programme where you can take part in group challenges.</p>` +
      `<p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#16a34a;color:#fff;border-radius:6px;text-decoration:none">View the invitation</a></p>` +
      `<p>Or open this link: <a href="${url}">${url}</a></p>` +
      `<p>When you accept, the group's administrators will be able to see your health data (sleep, activity and other measurements). You can leave the group at any time. The invitation is valid until ${expires}. If you were not expecting it, you can ignore this email.</p>`,
    text:
      `You have been invited${params.inviterName ? ` by ${params.inviterName}` : ''} to join ${params.groupName} on Longevity Klub, a wellbeing programme where you can take part in group challenges.\n\n` +
      `View the invitation: ${url}\n\n` +
      `When you accept, the group's administrators will be able to see your health data (sleep, activity and other measurements). You can leave the group at any time. The invitation is valid until ${expires}. If you were not expecting it, you can ignore this email.`,
  });
}
