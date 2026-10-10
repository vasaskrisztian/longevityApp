import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  collectiveAmountLabel,
  collectiveLine,
  contributionLine,
  daysLeftLabel,
  formatAmount,
  displayName,
  formatDateRange,
  formatDay,
  isLikelyEmail,
  minutesToHoursLabel,
  parseEmails,
  teamStatusLine,
  timeAgo,
  todayDay,
} from '@/lib/wellbeing/format';
import { inviteView, safeNextPath } from '@/lib/wellbeing/invite-flow';
import { MAX_LOGO_BYTES, decodedSize, logoFromBase64 } from '@/lib/wellbeing/logo-file';
import { _resetUnreadStoreForTests, getUnreadCount, setUnreadCount } from '@/lib/wellbeing/unread-store';
import { acceptInvitationByToken, groupLogoUri, previewInvitation } from '@/lib/wellbeing/groups-api';
import { markNotificationsRead } from '@/lib/wellbeing/notifications-api';
import { registerFromInvitation } from '@/lib/wellbeing/register-invite';

describe('format helpers', () => {
  it('formats days timezone-independently and collapses one-day ranges', () => {
    expect(formatDay('2026-10-10')).toBe('10 Oct 2026');
    expect(formatDay('nope')).toBe('nope');
    expect(formatDateRange('2026-10-10', '2026-10-10')).toBe('10 Oct 2026');
    expect(formatDateRange('2026-10-10', '2026-10-17')).toBe('10 Oct 2026 – 17 Oct 2026');
  });
  it('adds days across month ends and returns the UTC day', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(todayDay(new Date('2026-10-10T23:59:00Z'))).toBe('2026-10-10');
  });
  it('labels', () => {
    expect(daysLeftLabel(null)).toBeNull();
    expect(daysLeftLabel(1)).toBe('Last day');
    expect(daysLeftLabel(5)).toBe('5 days left');
    expect(teamStatusLine({ participants: 0, members: 3, completed: 0, averagePercent: 0 })).toBe('Nobody has joined yet.');
    expect(teamStatusLine({ participants: 1, members: 3, completed: 1, averagePercent: 100 })).toBe(
      '1 of 1 participant reached the goal · average progress 100%',
    );
    expect(teamStatusLine({ participants: 4, members: 5, completed: 2, averagePercent: 63 })).toContain('2 of 4 participants');
    expect(minutesToHoursLabel(null)).toBe('—');
    expect(minutesToHoursLabel(421)).toBe('7 h 01 min');
    expect(displayName({ fullName: null, email: 'a@b.hu' })).toBe('a@b.hu');
  });
  it('time ago', () => {
    const now = new Date('2026-10-10T12:00:00Z');
    expect(timeAgo('2026-10-10T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-10-10T11:30:00Z', now)).toBe('30 min ago');
    expect(timeAgo('2026-10-10T07:00:00Z', now)).toBe('5 h ago');
    expect(timeAgo('2026-10-08T12:00:00Z', now)).toBe('2 d ago');
    expect(timeAgo('2026-06-01T12:00:00Z', now)).toBe('1 Jun 2026');
    expect(timeAgo('garbage', now)).toBe('');
  });
  it('parses pasted email lists', () => {
    expect(parseEmails('A@x.hu, b@x.hu;\n a@X.hu  c@x.hu')).toEqual(['a@x.hu', 'b@x.hu', 'c@x.hu']);
    expect(isLikelyEmail('a@b.hu')).toBe(true);
    expect(isLikelyEmail('a@b')).toBe(false);
  });
});

describe('team-total (collective) challenge labels', () => {
  it('groups thousands with plain spaces', () => {
    expect(formatAmount(0)).toBe('0');
    expect(formatAmount(999)).toBe('999');
    expect(formatAmount(1000)).toBe('1 000');
    expect(formatAmount(100000)).toBe('100 000');
    expect(formatAmount(12345678)).toBe('12 345 678');
  });
  it('uses the right unit', () => {
    expect(collectiveAmountLabel('DAILY_STEPS', 100000)).toBe('100 000 steps');
    expect(collectiveAmountLabel('WEEKLY_WORKOUTS', 1)).toBe('1 workout');
    expect(collectiveAmountLabel('WEEKLY_WORKOUTS', 40)).toBe('40 workouts');
  });
  it('shows the team total and whether the goal is reached', () => {
    expect(collectiveLine('DAILY_STEPS', { total: 75000, targetTotal: 100000, percent: 75, reached: false })).toBe('75 000 of 100 000 steps · 75%');
    expect(collectiveLine('WEEKLY_WORKOUTS', { total: 41, targetTotal: 40, percent: 100, reached: true })).toBe('41 of 40 workouts · goal reached');
  });
  it('shows a person\'s share of the target, capped at 100%', () => {
    expect(contributionLine('DAILY_STEPS', 12300, 100000)).toBe('12 300 steps · 12% of the team target');
    expect(contributionLine('DAILY_STEPS', 150000, 100000)).toBe('150 000 steps · 100% of the team target');
  });
});

describe('invite flow', () => {
  const valid = { status: 'valid' as const, groupName: 'Acme', email: 'Jane@Acme.com', accountExists: false };
  const out = { signedIn: false, email: null };

  it('safeNextPath accepts only invitation paths (open-redirect safe)', () => {
    expect(safeNextPath('/invite/abcDEF123456_-xyz')).toBe('/invite/abcDEF123456_-xyz');
    for (const bad of [undefined, null, '', '/', '/admin', 'https://evil.com', '//evil.com', '/invite/', '/invite/short', '/invite/../x', '/invite/abc def12345']) {
      expect(safeNextPath(bad as never)).toBeNull();
    }
  });
  it('decides the view', () => {
    expect(inviteView(null, true, out).kind).toBe('loading');
    expect(inviteView(null, false, out).kind).toBe('unavailable');
    for (const status of ['expired', 'revoked', 'accepted', 'invalid'] as const) {
      expect(inviteView({ status }, false, out).kind).toBe('unavailable');
    }
    expect(inviteView(valid, false, out).kind).toBe('register');
    expect(inviteView({ ...valid, accountExists: true }, false, out).kind).toBe('login');
    expect(inviteView(valid, false, { signedIn: true, email: 'jane@acme.com' }).kind).toBe('accept');
    expect(inviteView(valid, false, { signedIn: true, email: 'bob@acme.com' })).toEqual({
      kind: 'wrong_account',
      invitedEmail: 'Jane@Acme.com',
      currentEmail: 'bob@acme.com',
    });
  });
});

describe('logo file validation', () => {
  const b64 = (bytes: number) => Buffer.alloc(bytes, 1).toString('base64');
  it('measures decoded size incl. padding', () => {
    for (const n of [1, 2, 3, 100, 1001]) expect(decodedSize(b64(n))).toBe(n);
  });
  it('accepts png/jpeg/webp (normalising image/jpg) and rejects the rest', () => {
    expect(logoFromBase64('image/jpg', b64(10))).toEqual({ ok: true, upload: { contentType: 'image/jpeg', dataBase64: b64(10) } });
    expect(logoFromBase64('image/png', b64(10)).ok).toBe(true);
    expect(logoFromBase64('image/gif', b64(10)).ok).toBe(false);
    expect(logoFromBase64('image/png', '').ok).toBe(false);
    expect(logoFromBase64('image/png', b64(MAX_LOGO_BYTES + 1)).ok).toBe(false);
    expect(logoFromBase64('image/png', b64(MAX_LOGO_BYTES)).ok).toBe(true);
  });
});

describe('unread store', () => {
  beforeEach(() => _resetUnreadStoreForTests());
  it('clamps to non-negative integers', () => {
    setUnreadCount(3.9);
    expect(getUnreadCount()).toBe(3);
    setUnreadCount(-5);
    expect(getUnreadCount()).toBe(0);
  });
});

describe('browser API clients', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

  it('logo urls stay same-origin', () => {
    expect(groupLogoUri(null)).toBeNull();
    expect(groupLogoUri('/api/groups/g1/logo?v=1')).toBe('/api/groups/g1/logo?v=1');
  });
  it('accepts an invitation by token with explicit consent', async () => {
    fetchMock.mockResolvedValue(ok({ groupId: 'g', groupName: 'G' }));
    await acceptInvitationByToken('a/b');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/invitations/a%2Fb/accept');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ consent: true }));
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });
  it('previews anonymously and tolerates failures', async () => {
    fetchMock.mockResolvedValueOnce(ok({ status: 'valid' }));
    await expect(previewInvitation('tok')).resolves.toEqual({ status: 'valid' });
    expect(fetchMock).toHaveBeenCalledWith('/api/invitations/tok');
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    await expect(previewInvitation('tok')).resolves.toBeNull();
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(previewInvitation('tok')).resolves.toBeNull();
  });
  it('turns API errors into messages', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Too many addresses.' }) });
    await expect(acceptInvitationByToken('t')).rejects.toThrow('Too many addresses.');
  });
  it('marks notifications read', async () => {
    fetchMock.mockResolvedValue(ok({ updated: 2 }));
    await markNotificationsRead('all');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/notifications/read');
    expect(init.body).toBe(JSON.stringify({ ids: 'all' }));
  });
  it('registers from an invitation and maps the failure modes', async () => {
    const input = {
      fullName: 'J',
      email: 'j@a.com',
      password: 'Abcdefghij1',
      passwordConfirmation: 'Abcdefghij1',
      termsAccepted: true as const,
      privacyAccepted: true as const,
      inviteToken: 'tok',
      groupConsent: true as const,
    };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) });
    await expect(registerFromInvitation(input)).resolves.toEqual({ ok: true });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ code: 'account_exists' }) });
    await expect(registerFromInvitation(input)).resolves.toEqual({ ok: false, reason: 'account_exists' });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
    await expect(registerFromInvitation(input)).resolves.toEqual({ ok: false, reason: 'rate_limited' });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: 'Invitation expired' }) });
    await expect(registerFromInvitation(input)).resolves.toEqual({ ok: false, reason: 'invalid', message: 'Invitation expired' });
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(registerFromInvitation(input)).resolves.toEqual({ ok: false, reason: 'error' });
  });
});
