import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthenticatedError, ForbiddenError } from '@/lib/auth/errors';

const requireAdminMock = vi.fn();
const requireAuthenticatedUserMock = vi.fn();
function toErrorResponse(error: unknown): Response {
  if (error instanceof UnauthenticatedError || error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  throw error;
}
vi.mock('@/lib/auth/authorization', () => ({
  requireAdmin: requireAdminMock,
  requireAuthenticatedUser: requireAuthenticatedUserMock,
  toErrorResponse,
}));
vi.mock('@/lib/logging/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

class InvalidLogoError extends Error {}
vi.mock('@/modules/groups/group-logo', () => ({ InvalidLogoError }));

const groupsService = {
  createGroup: vi.fn(),
  listGroupsForAdmin: vi.fn(),
  getGroupDetailForAdmin: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  removeMemberAsAdmin: vi.fn(),
  removeMembership: vi.fn(),
  getGroupLogo: vi.fn(),
  listMyGroups: vi.fn(),
};
vi.mock('@/modules/groups/groups.service', () => groupsService);

class InvitationError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
  }
}
const invitationsService = {
  inviteMembers: vi.fn(),
  revokeInvitation: vi.fn(),
  previewInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
  listMyPendingInvitations: vi.fn(),
  InvitationError,
};
vi.mock('@/modules/groups/invitations.service', () => invitationsService);

class GroupChallengeError extends Error {
  constructor(public readonly code: string, message = code) {
    super(message);
  }
}
const challengesService = {
  createGroupChallenge: vi.fn(),
  listGroupChallengesForAdmin: vi.fn(),
  getGroupChallengeDetailForAdmin: vi.fn(),
  deleteGroupChallenge: vi.fn(),
  listMyGroupChallenges: vi.fn(),
  joinGroupChallenge: vi.fn(),
  leaveGroupChallenge: vi.fn(),
  finalizeEndedGroupChallenges: vi.fn().mockResolvedValue({ finalized: 0 }),
  GroupChallengeError,
};
vi.mock('@/modules/groups/group-challenges.service', () => challengesService);

const memberHealth = { getMemberHealthForAdmin: vi.fn() };
vi.mock('@/modules/groups/member-health.service', () => memberHealth);

const notificationsService = { listNotifications: vi.fn(), markNotificationsRead: vi.fn() };
vi.mock('@/modules/notifications/notifications.service', () => notificationsService);

const rateLimit = { checkRateLimit: vi.fn(), getClientIdentifier: vi.fn().mockReturnValue('1.2.3.4') };
vi.mock('@/lib/auth/rate-limit', () => ({ ...rateLimit, INVITATION_PREVIEW_RATE_LIMIT: { windowMs: 1, max: 1 } }));

const adminGroups = await import('@/app/api/admin/groups/route');
const adminGroup = await import('@/app/api/admin/groups/[id]/route');
const adminInvite = await import('@/app/api/admin/groups/[id]/invitations/route');
const adminInvitation = await import('@/app/api/admin/groups/[id]/invitations/[invitationId]/route');
const adminMember = await import('@/app/api/admin/groups/[id]/members/[userId]/route');
const adminMemberHealth = await import('@/app/api/admin/groups/[id]/members/[userId]/health/route');
const adminChallenges = await import('@/app/api/admin/groups/[id]/challenges/route');
const adminChallenge = await import('@/app/api/admin/groups/[id]/challenges/[challengeId]/route');
const logoRoute = await import('@/app/api/groups/[id]/logo/route');
const invitationPreview = await import('@/app/api/invitations/[token]/route');
const invitationAccept = await import('@/app/api/invitations/[token]/accept/route');
const myWellbeing = await import('@/app/api/me/wellbeing/route');
const myInvitationAccept = await import('@/app/api/me/wellbeing/invitations/[id]/accept/route');
const myGroup = await import('@/app/api/me/wellbeing/groups/[groupId]/route');
const myChallenges = await import('@/app/api/me/wellbeing/groups/[groupId]/challenges/route');
const myParticipation = await import('@/app/api/me/wellbeing/groups/[groupId]/challenges/[challengeId]/participation/route');
const notifications = await import('@/app/api/notifications/route');
const notificationsRead = await import('@/app/api/notifications/read/route');

const json = (body: unknown, method = 'POST') =>
  new Request('https://example.com', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const get = () => new Request('https://example.com');
const G = { params: { id: 'g1' } };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue({ id: 'admin1', role: 'ADMIN' });
  requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'MEMBER' });
  rateLimit.checkRateLimit.mockReturnValue({ allowed: true, remaining: 5, resetAt: 0 });
  challengesService.finalizeEndedGroupChallenges.mockResolvedValue({ finalized: 0 });
});

describe('every admin group endpoint is admin-only (403/401 before any service call)', () => {
  const cases: [string, () => Promise<Response>][] = [
    ['GET groups', () => adminGroups.GET()],
    ['POST groups', () => adminGroups.POST(json({ name: 'A' }))],
    ['GET group', () => adminGroup.GET(get(), G)],
    ['PATCH group', () => adminGroup.PATCH(json({ name: 'A' }, 'PATCH'), G)],
    ['DELETE group', () => adminGroup.DELETE(get(), G)],
    ['POST invitations', () => adminInvite.POST(json({ emails: ['a@x.com'] }), G)],
    ['DELETE invitation', () => adminInvitation.DELETE(get(), { params: { id: 'g1', invitationId: 'i1' } })],
    ['DELETE member', () => adminMember.DELETE(get(), { params: { id: 'g1', userId: 'u2' } })],
    ['GET member health', () => adminMemberHealth.GET(get(), { params: { id: 'g1', userId: 'u2' } })],
    ['GET challenges', () => adminChallenges.GET(get(), G)],
    ['POST challenges', () => adminChallenges.POST(json({}), G)],
    ['GET challenge', () => adminChallenge.GET(get(), { params: { id: 'g1', challengeId: 'c1' } })],
    ['DELETE challenge', () => adminChallenge.DELETE(get(), { params: { id: 'g1', challengeId: 'c1' } })],
  ];

  it.each(cases)('%s', async (_name, call) => {
    requireAdminMock.mockRejectedValue(new ForbiddenError('Admin role required'));
    expect((await call()).status).toBe(403);
    requireAdminMock.mockRejectedValue(new UnauthenticatedError());
    expect((await call()).status).toBe(401);
    for (const fn of [
      ...Object.values(groupsService),
      ...Object.values(invitationsService).filter((v) => typeof v === 'function' && v !== InvitationError),
      memberHealth.getMemberHealthForAdmin,
      challengesService.createGroupChallenge,
      challengesService.listGroupChallengesForAdmin,
      challengesService.getGroupChallengeDetailForAdmin,
      challengesService.deleteGroupChallenge,
    ]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });
});

describe('every member endpoint needs a signed-in user', () => {
  const cases: [string, () => Promise<Response>][] = [
    ['GET wellbeing', () => myWellbeing.GET()],
    ['POST accept by id', () => myInvitationAccept.POST(json({ consent: true }), { params: { id: 'i1' } })],
    ['POST accept by token', () => invitationAccept.POST(json({ consent: true }), { params: { token: 't' } })],
    ['DELETE leave group', () => myGroup.DELETE(get(), { params: { groupId: 'g1' } })],
    ['GET my challenges', () => myChallenges.GET(get(), { params: { groupId: 'g1' } })],
    ['POST join', () => myParticipation.POST(get(), { params: { groupId: 'g1', challengeId: 'c1' } })],
    ['DELETE leave challenge', () => myParticipation.DELETE(get(), { params: { groupId: 'g1', challengeId: 'c1' } })],
    ['GET notifications', () => notifications.GET(get())],
    ['POST notifications/read', () => notificationsRead.POST(json({ ids: 'all' }))],
  ];
  it.each(cases)('%s → 401', async (_name, call) => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());
    expect((await call()).status).toBe(401);
    expect(invitationsService.acceptInvitation).not.toHaveBeenCalled();
    expect(challengesService.joinGroupChallenge).not.toHaveBeenCalled();
    expect(notificationsService.markNotificationsRead).not.toHaveBeenCalled();
  });
});

describe('admin group CRUD', () => {
  it('POST creates (201) with the admin id; invalid body → 400; bad logo → 400', async () => {
    groupsService.createGroup.mockResolvedValue({ id: 'g1', name: 'Acme' });
    const ok = await adminGroups.POST(json({ name: 'Acme' }));
    expect(ok.status).toBe(201);
    expect(groupsService.createGroup).toHaveBeenCalledWith('admin1', { name: 'Acme' });

    expect((await adminGroups.POST(json({ name: '' }))).status).toBe(400);

    groupsService.createGroup.mockRejectedValue(new InvalidLogoError('The logo must be at most 1 MB'));
    const bad = await adminGroups.POST(json({ name: 'Acme' }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/1 MB/);
  });

  it('GET/PATCH/DELETE answer 404 for an unknown group', async () => {
    groupsService.getGroupDetailForAdmin.mockResolvedValue(null);
    groupsService.updateGroup.mockResolvedValue(null);
    groupsService.deleteGroup.mockResolvedValue(false);
    expect((await adminGroup.GET(get(), G)).status).toBe(404);
    expect((await adminGroup.PATCH(json({ name: 'X' }, 'PATCH'), G)).status).toBe(404);
    expect((await adminGroup.DELETE(get(), G)).status).toBe(404);
  });

  it('DELETE answers 204 when it deleted', async () => {
    groupsService.deleteGroup.mockResolvedValue(true);
    expect((await adminGroup.DELETE(get(), G)).status).toBe(204);
  });

  it('invitations: accepts a pasted blob of addresses and reports per-address outcomes; 404 for unknown group', async () => {
    invitationsService.inviteMembers.mockResolvedValue([{ email: 'a@x.com', outcome: 'invited' }]);
    const res = await adminInvite.POST(json({ emails: 'A@x.com, b@y.com' }), G);
    expect(res.status).toBe(200);
    expect(invitationsService.inviteMembers).toHaveBeenCalledWith({
      adminId: 'admin1',
      groupId: 'g1',
      emails: ['a@x.com', 'b@y.com'],
    });
    expect((await adminInvite.POST(json({ emails: ['nope'] }), G)).status).toBe(400);
    invitationsService.inviteMembers.mockResolvedValue(null);
    expect((await adminInvite.POST(json({ emails: ['a@x.com'] }), G)).status).toBe(404);
  });

  it('member health is a 404 for a non-member (no data, no audit leak)', async () => {
    memberHealth.getMemberHealthForAdmin.mockResolvedValue(null);
    const res = await adminMemberHealth.GET(get(), { params: { id: 'g1', userId: 'stranger' } });
    expect(res.status).toBe(404);
    expect(memberHealth.getMemberHealthForAdmin).toHaveBeenCalledWith('admin1', 'g1', 'stranger');
  });

  it('challenge create: 201 / 400 (schema) / 400 (service rejection) / 404', async () => {
    const body = { name: 'S', type: 'DAILY_STEPS', threshold: 8000, requiredCount: 5, startDate: '2026-10-10', endDate: '2026-10-16' };
    challengesService.createGroupChallenge.mockResolvedValue({ id: 'c1' });
    expect((await adminChallenges.POST(json(body), G)).status).toBe(201);
    expect((await adminChallenges.POST(json({ ...body, endDate: '2026-10-01' }), G)).status).toBe(400);
    challengesService.createGroupChallenge.mockRejectedValue(new GroupChallengeError('invalid_dates', 'The challenge cannot end in the past'));
    expect((await adminChallenges.POST(json(body), G)).status).toBe(400);
    challengesService.createGroupChallenge.mockResolvedValue(null);
    expect((await adminChallenges.POST(json(body), G)).status).toBe(404);
  });

  it('listing challenges lazily sends overdue summaries first', async () => {
    challengesService.listGroupChallengesForAdmin.mockResolvedValue([]);
    await adminChallenges.GET(get(), G);
    expect(challengesService.finalizeEndedGroupChallenges).toHaveBeenCalled();
  });
});

describe('public logo', () => {
  it('serves the bytes with safe headers, no auth needed', async () => {
    groupsService.getGroupLogo.mockResolvedValue({ data: Buffer.from([1, 2, 3]), contentType: 'image/png' });
    const res = await logoRoute.GET(get(), G);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Content-Security-Policy')).toContain('sandbox');
    expect(requireAuthenticatedUserMock).not.toHaveBeenCalled();
    expect(requireAdminMock).not.toHaveBeenCalled();
  });
  it('404 when the group has no logo', async () => {
    groupsService.getGroupLogo.mockResolvedValue(null);
    expect((await logoRoute.GET(get(), G)).status).toBe(404);
  });
});

describe('public invitation preview', () => {
  it('returns the preview, no auth required', async () => {
    invitationsService.previewInvitation.mockResolvedValue({ status: 'valid', groupName: 'Acme' });
    const res = await invitationPreview.GET(get(), { params: { token: 'tok' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'valid' });
    expect(invitationsService.previewInvitation).toHaveBeenCalledWith('tok');
  });
  it('is rate-limited (429) and does no lookup then', async () => {
    rateLimit.checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: 0 });
    const res = await invitationPreview.GET(get(), { params: { token: 'tok' } });
    expect(res.status).toBe(429);
    expect(invitationsService.previewInvitation).not.toHaveBeenCalled();
  });
});

describe('accepting an invitation', () => {
  it('needs explicit consent (400 without it) and then joins', async () => {
    expect((await invitationAccept.POST(json({ consent: false }), { params: { token: 't' } })).status).toBe(400);
    expect((await myInvitationAccept.POST(json({}), { params: { id: 'i1' } })).status).toBe(400);
    expect(invitationsService.acceptInvitation).not.toHaveBeenCalled();

    invitationsService.acceptInvitation.mockResolvedValue({ groupId: 'g1', groupName: 'Acme' });
    const byToken = await invitationAccept.POST(json({ consent: true }), { params: { token: 't' } });
    expect(byToken.status).toBe(200);
    expect(invitationsService.acceptInvitation).toHaveBeenCalledWith({ userId: 'u1', rawToken: 't' });
    await myInvitationAccept.POST(json({ consent: true }), { params: { id: 'i1' } });
    expect(invitationsService.acceptInvitation).toHaveBeenLastCalledWith({ userId: 'u1', invitationId: 'i1' });
  });

  it.each([
    ['email_mismatch', 403],
    ['expired', 410],
    ['invalid', 404],
    ['revoked', 404],
    ['accepted', 409],
  ])('maps a %s failure to HTTP %i', async (reason, status) => {
    invitationsService.acceptInvitation.mockRejectedValue(new InvitationError(reason));
    const res = await invitationAccept.POST(json({ consent: true }), { params: { token: 't' } });
    expect(res.status).toBe(status);
    expect((await res.json()).code).toBe(reason);
  });

  it('rethrows unexpected errors', async () => {
    invitationsService.acceptInvitation.mockRejectedValue(new Error('boom'));
    await expect(invitationAccept.POST(json({ consent: true }), { params: { token: 't' } })).rejects.toThrow('boom');
  });
});

describe('member wellbeing', () => {
  it('overview returns groups + pending invitations of the caller only', async () => {
    groupsService.listMyGroups.mockResolvedValue([{ id: 'g1' }]);
    invitationsService.listMyPendingInvitations.mockResolvedValue([{ id: 'i1' }]);
    const res = await myWellbeing.GET();
    expect(await res.json()).toEqual({ groups: [{ id: 'g1' }], pendingInvitations: [{ id: 'i1' }] });
    expect(groupsService.listMyGroups).toHaveBeenCalledWith('u1');
  });

  it('leaving uses the caller’s own id; 404 when not a member', async () => {
    groupsService.removeMembership.mockResolvedValue(true);
    expect((await myGroup.DELETE(get(), { params: { groupId: 'g1' } })).status).toBe(204);
    expect(groupsService.removeMembership).toHaveBeenCalledWith('g1', 'u1');
    groupsService.removeMembership.mockResolvedValue(false);
    expect((await myGroup.DELETE(get(), { params: { groupId: 'g1' } })).status).toBe(404);
  });

  it('non-member / unknown challenge look identical (404) so ids are not enumerable; ended → 400', async () => {
    const P = { params: { groupId: 'g1', challengeId: 'c1' } };
    challengesService.joinGroupChallenge.mockRejectedValue(new GroupChallengeError('not_member'));
    expect((await myParticipation.POST(get(), P)).status).toBe(404);
    challengesService.joinGroupChallenge.mockRejectedValue(new GroupChallengeError('not_found'));
    expect((await myParticipation.POST(get(), P)).status).toBe(404);
    challengesService.joinGroupChallenge.mockRejectedValue(new GroupChallengeError('ended', 'This challenge has already ended'));
    expect((await myParticipation.POST(get(), P)).status).toBe(400);
    challengesService.joinGroupChallenge.mockResolvedValue(undefined);
    expect((await myParticipation.POST(get(), P)).status).toBe(200);
    expect(challengesService.joinGroupChallenge).toHaveBeenLastCalledWith('u1', 'g1', 'c1');
    challengesService.leaveGroupChallenge.mockResolvedValue(undefined);
    expect((await myParticipation.DELETE(get(), P)).status).toBe(204);
  });

  it('challenge list passes the caller id and 404s for a non-member', async () => {
    challengesService.listMyGroupChallenges.mockResolvedValue([]);
    expect((await myChallenges.GET(get(), { params: { groupId: 'g1' } })).status).toBe(200);
    expect(challengesService.listMyGroupChallenges).toHaveBeenCalledWith('u1', 'g1');
    challengesService.listMyGroupChallenges.mockRejectedValue(new GroupChallengeError('not_member'));
    expect((await myChallenges.GET(get(), { params: { groupId: 'g1' } })).status).toBe(404);
  });
});

describe('notifications', () => {
  it('lists the caller’s notifications (default limit 30, custom limit honoured) after the lazy finalize', async () => {
    notificationsService.listNotifications.mockResolvedValue({ items: [], unreadCount: 0 });
    await notifications.GET(new Request('https://example.com/api/notifications'));
    expect(notificationsService.listNotifications).toHaveBeenLastCalledWith('u1', 30);
    await notifications.GET(new Request('https://example.com/api/notifications?limit=5'));
    expect(notificationsService.listNotifications).toHaveBeenLastCalledWith('u1', 5);
    expect(challengesService.finalizeEndedGroupChallenges).toHaveBeenCalled();
  });

  it('still lists when the lazy finalize fails', async () => {
    challengesService.finalizeEndedGroupChallenges.mockRejectedValue(new Error('db'));
    notificationsService.listNotifications.mockResolvedValue({ items: [], unreadCount: 2 });
    const res = await notifications.GET(new Request('https://example.com/api/notifications'));
    expect(res.status).toBe(200);
  });

  it('marks read for the caller only; validates the body', async () => {
    notificationsService.markNotificationsRead.mockResolvedValue(3);
    const res = await notificationsRead.POST(json({ ids: 'all' }));
    expect(await res.json()).toEqual({ updated: 3 });
    expect(notificationsService.markNotificationsRead).toHaveBeenCalledWith('u1', 'all');
    expect((await notificationsRead.POST(json({ ids: [] }))).status).toBe(400);
  });
});
