import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/email/mailer', () => ({ sendEmail }));
vi.mock('@/lib/logging/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { sendGroupInvitationEmail, buildInvitationUrl } = await import('@/lib/email/group-invitation-email');

const saved = { app: process.env.APP_URL, web: process.env.WEB_APP_URL };
beforeEach(() => {
  sendEmail.mockClear();
  process.env.APP_URL = 'https://api.example.com';
  process.env.WEB_APP_URL = 'https://web.example.com/';
});
afterEach(() => {
  for (const [key, value] of [['APP_URL', saved.app], ['WEB_APP_URL', saved.web]] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const params = {
  to: 'jane@example.com',
  groupId: 'g1',
  groupName: 'Acme <script>alert(1)</script>',
  hasLogo: true,
  rawToken: 'tok123',
  inviterName: 'Boss "B"',
  expiresAt: new Date('2026-10-24T00:00:00Z'),
};

describe('group invitation email', () => {
  it('links to /invite/<token> on the web app origin (no double slash)', () => {
    expect(buildInvitationUrl('tok123')).toBe('https://web.example.com/invite/tok123');
  });

  it('includes the logo from the backend, the link, the consent notice and the expiry', async () => {
    await sendGroupInvitationEmail(params);
    const mail = sendEmail.mock.calls[0]![0];
    expect(mail.to).toBe('jane@example.com');
    expect(mail.html).toContain('<img src="https://api.example.com/api/groups/g1/logo"');
    expect(mail.html).toContain('https://web.example.com/invite/tok123');
    expect(mail.text).toContain('https://web.example.com/invite/tok123');
    expect(mail.text).toMatch(/administrators will be able to see your health data/);
    expect(mail.html).toContain('2026-10-24');
  });

  it('escapes the group and inviter names in the HTML (no markup injection)', async () => {
    await sendGroupInvitationEmail(params);
    const { html } = sendEmail.mock.calls[0]![0];
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Boss &quot;B&quot;');
  });

  it('omits the image when the group has no logo', async () => {
    await sendGroupInvitationEmail({ ...params, hasLogo: false });
    expect(sendEmail.mock.calls[0]![0].html).not.toContain('<img');
  });
});
