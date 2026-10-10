import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  wellbeingGroup: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  groupMembership: { findUnique: vi.fn(), upsert: vi.fn() },
  groupInvitation: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
};
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));
const recordAuditLog = vi.fn();
vi.mock('@/lib/audit/audit-log.service', () => ({ recordAuditLog }));
const sendGroupInvitationEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/email/group-invitation-email', () => ({ sendGroupInvitationEmail }));
const createNotification = vi.fn();
vi.mock('@/modules/notifications/notifications.service', () => ({ createNotification }));

const { hashToken } = await import('@/lib/auth/tokens');
const {
  inviteMembers,
  revokeInvitation,
  previewInvitation,
  acceptInvitation,
  completeInvitation,
  listMyPendingInvitations,
  requireUsableInvitationForEmail,
  INVITATION_TTL_MS,
} = await import('@/modules/groups/invitations.service');

const FUTURE = () => new Date(Date.now() + 60_000);
const PAST = () => new Date(Date.now() - 60_000);
const group = { id: 'g1', name: 'Acme', logoContentType: 'image/png', updatedAt: new Date('2026-10-01T00:00:00Z') };
const invitation = (overrides: Record<string, unknown> = {}) => ({
  id: 'i1',
  groupId: 'g1',
  email: 'jane@example.com',
  status: 'PENDING',
  expiresAt: FUTURE(),
  group,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
  sendGroupInvitationEmail.mockResolvedValue(undefined);
});

describe('inviteMembers', () => {
  function arrange(existingUser: { id: string } | null = null, member = false) {
    prismaMock.wellbeingGroup.findUnique.mockResolvedValue({ id: 'g1', name: 'Acme', logoContentType: 'image/png' });
    prismaMock.user.findUnique.mockImplementation(async (args: { where: { id?: string; email?: string } }) =>
      args.where.id ? { profile: { fullName: 'Boss' } } : existingUser,
    );
    prismaMock.groupMembership.findUnique.mockResolvedValue(member ? { id: 'm' } : null);
    prismaMock.groupInvitation.upsert.mockResolvedValue({ id: 'i1' });
  }

  it('returns null for an unknown group and sends nothing', async () => {
    prismaMock.wellbeingGroup.findUnique.mockResolvedValue(null);
    expect(await inviteMembers({ adminId: 'a', groupId: 'nope', emails: ['x@y.com'] })).toBeNull();
    expect(sendGroupInvitationEmail).not.toHaveBeenCalled();
  });

  it('stores only the token HASH, emails the raw token, and sets a 14-day expiry', async () => {
    arrange();
    const before = Date.now();
    const results = await inviteMembers({ adminId: 'a', groupId: 'g1', emails: ['Jane@Example.com'] });

    expect(results).toEqual([{ email: 'jane@example.com', outcome: 'invited' }]);
    const upsert = prismaMock.groupInvitation.upsert.mock.calls[0]![0];
    expect(upsert.where).toEqual({ groupId_email: { groupId: 'g1', email: 'jane@example.com' } });
    const mail = sendGroupInvitationEmail.mock.calls[0]![0];
    expect(mail).toMatchObject({ to: 'jane@example.com', groupName: 'Acme', hasLogo: true, inviterName: 'Boss' });
    expect(upsert.create.tokenHash).toBe(hashToken(mail.rawToken));
    expect(upsert.update.tokenHash).toBe(upsert.create.tokenHash);
    expect(JSON.stringify(upsert)).not.toContain(mail.rawToken);
    expect(upsert.create.expiresAt.getTime()).toBeGreaterThanOrEqual(before + INVITATION_TTL_MS);
    // A re-invite revives a previously accepted/revoked row.
    expect(upsert.update).toMatchObject({ status: 'PENDING', acceptedAt: null, acceptedUserId: null });
    expect(createNotification).not.toHaveBeenCalled();
  });

  it('also notifies in-app when the address already has an account', async () => {
    arrange({ id: 'u9' });
    await inviteMembers({ adminId: 'a', groupId: 'g1', emails: ['jane@example.com'] });
    expect(createNotification).toHaveBeenCalledWith(
      'u9',
      expect.objectContaining({ type: 'GROUP_INVITATION', data: { invitationId: 'i1', groupId: 'g1' } }),
    );
  });

  it('skips people who are already members', async () => {
    arrange({ id: 'u9' }, true);
    const results = await inviteMembers({ adminId: 'a', groupId: 'g1', emails: ['jane@example.com'] });
    expect(results).toEqual([{ email: 'jane@example.com', outcome: 'already_member' }]);
    expect(prismaMock.groupInvitation.upsert).not.toHaveBeenCalled();
    expect(sendGroupInvitationEmail).not.toHaveBeenCalled();
  });

  it('de-duplicates repeated addresses and audits the number invited', async () => {
    arrange();
    await inviteMembers({ adminId: 'a', groupId: 'g1', emails: ['a@x.com', 'A@x.com', 'b@x.com'] });
    expect(sendGroupInvitationEmail).toHaveBeenCalledTimes(2);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_GROUP_INVITE', metadata: { invited: 2 } }),
    );
  });
});

describe('revokeInvitation', () => {
  it('deletes a pending invitation of that group', async () => {
    prismaMock.groupInvitation.findUnique.mockResolvedValue({ id: 'i1', groupId: 'g1', status: 'PENDING' });
    expect(await revokeInvitation('a', 'g1', 'i1')).toBe(true);
    expect(prismaMock.groupInvitation.delete).toHaveBeenCalledWith({ where: { id: 'i1' } });
  });
  it('refuses another group’s invitation, a missing one, and an accepted one', async () => {
    prismaMock.groupInvitation.findUnique
      .mockResolvedValueOnce({ id: 'i1', groupId: 'other', status: 'PENDING' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'i1', groupId: 'g1', status: 'ACCEPTED' });
    expect(await revokeInvitation('a', 'g1', 'i1')).toBe(false);
    expect(await revokeInvitation('a', 'g1', 'i1')).toBe(false);
    expect(await revokeInvitation('a', 'g1', 'i1')).toBe(false);
    expect(prismaMock.groupInvitation.delete).not.toHaveBeenCalled();
  });
});

describe('previewInvitation', () => {
  it('looks the token up by hash; unknown tokens reveal nothing but "invalid"', async () => {
    prismaMock.groupInvitation.findUnique.mockResolvedValue(null);
    expect(await previewInvitation('secret')).toEqual({ status: 'invalid' });
    expect(prismaMock.groupInvitation.findUnique.mock.calls[0]![0].where).toEqual({ tokenHash: hashToken('secret') });
    expect(await previewInvitation('')).toEqual({ status: 'invalid' });
  });

  it('shows group, address and whether an account exists for a valid link', async () => {
    prismaMock.groupInvitation.findUnique.mockResolvedValue(invitation());
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
    expect(await previewInvitation('t')).toMatchObject({
      status: 'valid',
      groupName: 'Acme',
      email: 'jane@example.com',
      accountExists: true,
      logoUrl: expect.stringContaining('/api/groups/g1/logo'),
    });
  });

  it('does not expose the address for expired / revoked / accepted links', async () => {
    for (const [row, status] of [
      [invitation({ expiresAt: PAST() }), 'expired'],
      [invitation({ status: 'REVOKED' }), 'revoked'],
      [invitation({ status: 'ACCEPTED' }), 'accepted'],
    ] as const) {
      prismaMock.groupInvitation.findUnique.mockResolvedValueOnce(row);
      const preview = await previewInvitation('t');
      expect(preview.status).toBe(status);
      expect(preview.email).toBeUndefined();
    }
  });
});

describe('requireUsableInvitationForEmail', () => {
  it('accepts a valid invitation for the same address (case-insensitive)', async () => {
    prismaMock.groupInvitation.findUnique.mockResolvedValue(invitation());
    await expect(requireUsableInvitationForEmail('t', 'JANE@example.com')).resolves.toMatchObject({ id: 'i1' });
  });
  it('refuses another address', async () => {
    prismaMock.groupInvitation.findUnique.mockResolvedValue(invitation());
    await expect(requireUsableInvitationForEmail('t', 'eve@example.com')).rejects.toMatchObject({ reason: 'email_mismatch' });
  });
});

describe('completeInvitation', () => {
  it('creates the membership with a consent timestamp and marks the invitation accepted, atomically', async () => {
    await completeInvitation({ invitation: { id: 'i1', groupId: 'g1' }, userId: 'u1' });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.groupMembership.upsert.mock.calls[0]![0].create).toMatchObject({
      groupId: 'g1',
      userId: 'u1',
      consentAcceptedAt: expect.any(Date),
    });
    expect(prismaMock.groupInvitation.update.mock.calls[0]![0]).toMatchObject({
      where: { id: 'i1' },
      data: { status: 'ACCEPTED', acceptedUserId: 'u1' },
    });
  });
});

describe('acceptInvitation', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue({ email: 'Jane@Example.com' });
    prismaMock.groupMembership.findUnique.mockResolvedValue(null);
  });

  it('joins the group for the invited signed-in user (by token)', async () => {
    prismaMock.groupInvitation.findUnique.mockResolvedValue(invitation());
    expect(await acceptInvitation({ userId: 'u1', rawToken: 't' })).toEqual({ groupId: 'g1', groupName: 'Acme' });
    expect(prismaMock.groupMembership.upsert).toHaveBeenCalled();
  });

  it('works by invitation id too', async () => {
    prismaMock.groupInvitation.findUnique.mockResolvedValue(invitation());
    await acceptInvitation({ userId: 'u1', invitationId: 'i1' });
    expect(prismaMock.groupInvitation.findUnique.mock.calls[0]![0].where).toEqual({ id: 'i1' });
  });

  it('refuses a user whose own address differs from the invited one (no joining on someone else’s invitation)', async () => {
    prismaMock.groupInvitation.findUnique.mockResolvedValue(invitation({ email: 'other@example.com' }));
    await expect(acceptInvitation({ userId: 'u1', rawToken: 't' })).rejects.toMatchObject({ reason: 'email_mismatch' });
    expect(prismaMock.groupMembership.upsert).not.toHaveBeenCalled();
  });

  it('refuses expired / revoked links and an unknown token or id', async () => {
    prismaMock.groupInvitation.findUnique.mockResolvedValueOnce(invitation({ expiresAt: PAST() }));
    await expect(acceptInvitation({ userId: 'u1', rawToken: 't' })).rejects.toMatchObject({ reason: 'expired' });
    prismaMock.groupInvitation.findUnique.mockResolvedValueOnce(invitation({ status: 'REVOKED' }));
    await expect(acceptInvitation({ userId: 'u1', rawToken: 't' })).rejects.toMatchObject({ reason: 'revoked' });
    prismaMock.groupInvitation.findUnique.mockResolvedValueOnce(null);
    await expect(acceptInvitation({ userId: 'u1', rawToken: 't' })).rejects.toMatchObject({ reason: 'invalid' });
    await expect(acceptInvitation({ userId: 'u1' })).rejects.toMatchObject({ reason: 'invalid' });
  });

  it('is idempotent for someone who is already a member (clicking the link twice)', async () => {
    prismaMock.groupInvitation.findUnique.mockResolvedValue(invitation({ status: 'ACCEPTED' }));
    prismaMock.groupMembership.findUnique.mockResolvedValue({ id: 'm1' });
    expect(await acceptInvitation({ userId: 'u1', rawToken: 't' })).toEqual({ groupId: 'g1', groupName: 'Acme' });
    expect(prismaMock.groupMembership.upsert).not.toHaveBeenCalled();
  });
});

describe('listMyPendingInvitations', () => {
  it('queries by the user’s own (lower-cased) address, pending and unexpired only', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ email: 'Jane@Example.com' });
    prismaMock.groupInvitation.findMany.mockResolvedValue([invitation()]);
    const list = await listMyPendingInvitations('u1');
    const where = prismaMock.groupInvitation.findMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({ email: 'jane@example.com', status: 'PENDING' });
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
    expect(list[0]).toMatchObject({ id: 'i1', groupId: 'g1', groupName: 'Acme' });
  });
  it('is empty for an unknown user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    expect(await listMyPendingInvitations('ghost')).toEqual([]);
  });
});
