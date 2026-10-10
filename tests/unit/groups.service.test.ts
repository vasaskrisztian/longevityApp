import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  wellbeingGroup: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  groupMembership: { findUnique: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
  groupInvitation: { findMany: vi.fn() },
  groupChallengeParticipant: { deleteMany: vi.fn() },
  $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
};
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));
const recordAuditLog = vi.fn();
vi.mock('@/lib/audit/audit-log.service', () => ({ recordAuditLog }));

const {
  createGroup,
  updateGroup,
  deleteGroup,
  listGroupsForAdmin,
  getGroupDetailForAdmin,
  getGroupLogo,
  removeMembership,
  removeMemberAsAdmin,
  listMyGroups,
  invitationState,
  groupLogoUrl,
} = await import('@/modules/groups/groups.service');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const NOW = new Date('2026-10-10T12:00:00Z');
const groupRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'g1',
  name: 'Acme',
  logoContentType: null,
  createdAt: NOW,
  updatedAt: NOW,
  _count: { members: 2, challenges: 1 },
  invitations: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
});

describe('createGroup', () => {
  it('stores the name, the creator and the decoded logo bytes, and audits it', async () => {
    prismaMock.wellbeingGroup.create.mockResolvedValue(groupRow({ logoContentType: 'image/png' }));

    const dto = await createGroup('admin1', {
      name: 'Acme',
      logo: { contentType: 'image/png', dataBase64: PNG.toString('base64') },
    });

    const args = prismaMock.wellbeingGroup.create.mock.calls[0]![0];
    expect(args.data.name).toBe('Acme');
    expect(args.data.createdById).toBe('admin1');
    expect(args.data.logoContentType).toBe('image/png');
    expect(Buffer.isBuffer(args.data.logoData) && args.data.logoData.equals(PNG)).toBe(true);
    expect(dto.logoUrl).toMatch(/^\/api\/groups\/g1\/logo\?v=\d+$/);
    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'ADMIN_GROUP_CREATE', entityId: 'g1' }));
  });

  it('works without a logo (no logo columns written, no logoUrl)', async () => {
    prismaMock.wellbeingGroup.create.mockResolvedValue(groupRow());
    const dto = await createGroup('admin1', { name: 'Acme' });
    expect(prismaMock.wellbeingGroup.create.mock.calls[0]![0].data).not.toHaveProperty('logoData');
    expect(dto.logoUrl).toBeNull();
  });

  it('rejects a logo whose bytes are not the declared image type before touching the database', async () => {
    await expect(
      createGroup('admin1', { name: 'Acme', logo: { contentType: 'image/png', dataBase64: Buffer.from('<svg/>').toString('base64') } }),
    ).rejects.toMatchObject({ name: 'InvalidLogoError' });
    expect(prismaMock.wellbeingGroup.create).not.toHaveBeenCalled();
  });
});

describe('updateGroup', () => {
  it('returns null for an unknown group', async () => {
    prismaMock.wellbeingGroup.findUnique.mockResolvedValue(null);
    expect(await updateGroup('a', 'nope', { name: 'X' })).toBeNull();
    expect(prismaMock.wellbeingGroup.update).not.toHaveBeenCalled();
  });

  it('renames without touching the logo when logo is omitted', async () => {
    prismaMock.wellbeingGroup.findUnique.mockResolvedValue({ id: 'g1' });
    prismaMock.wellbeingGroup.update.mockResolvedValue(groupRow({ name: 'New' }));
    await updateGroup('a', 'g1', { name: 'New' });
    expect(prismaMock.wellbeingGroup.update.mock.calls[0]![0].data).toEqual({ name: 'New' });
  });

  it('removes the logo on null and replaces it on a new image', async () => {
    prismaMock.wellbeingGroup.findUnique.mockResolvedValue({ id: 'g1' });
    prismaMock.wellbeingGroup.update.mockResolvedValue(groupRow());
    await updateGroup('a', 'g1', { logo: null });
    expect(prismaMock.wellbeingGroup.update.mock.calls[0]![0].data).toEqual({ logoData: null, logoContentType: null });
    await updateGroup('a', 'g1', { logo: { contentType: 'image/png', dataBase64: PNG.toString('base64') } });
    expect(prismaMock.wellbeingGroup.update.mock.calls[1]![0].data.logoContentType).toBe('image/png');
  });
});

describe('deleteGroup', () => {
  it('deletes an existing group and audits; false when missing', async () => {
    prismaMock.wellbeingGroup.findUnique.mockResolvedValueOnce({ id: 'g1' }).mockResolvedValueOnce(null);
    expect(await deleteGroup('a', 'g1')).toBe(true);
    expect(prismaMock.wellbeingGroup.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'ADMIN_GROUP_DELETE' }));
    expect(await deleteGroup('a', 'g2')).toBe(false);
  });
});

describe('listGroupsForAdmin', () => {
  it('counts members and only genuinely pending (unexpired) invitations', async () => {
    prismaMock.wellbeingGroup.findMany.mockResolvedValue([
      groupRow({
        invitations: [
          { status: 'PENDING', expiresAt: new Date(Date.now() + 60_000) },
          { status: 'PENDING', expiresAt: new Date(Date.now() - 60_000) },
        ],
      }),
    ]);
    const [group] = await listGroupsForAdmin();
    expect(group).toMatchObject({ id: 'g1', memberCount: 2, challengeCount: 1, pendingInvitationCount: 1 });
  });
});

describe('getGroupDetailForAdmin', () => {
  it('lists members with last sync + connected providers, and invitations with their state', async () => {
    prismaMock.wellbeingGroup.findUnique.mockResolvedValue(
      groupRow({
        members: [
          {
            createdAt: NOW,
            user: {
              id: 'u1',
              email: 'a@x.com',
              profile: { fullName: 'Anna' },
              wearableConnections: [
                { provider: 'OURA', status: 'CONNECTED', lastSyncAt: new Date('2026-10-09T10:00:00Z') },
                { provider: 'APPLE_HEALTH', status: 'CONNECTED', lastSyncAt: new Date('2026-10-10T08:00:00Z') },
                { provider: 'FITBIT', status: 'DISCONNECTED', lastSyncAt: null },
              ],
            },
          },
          { createdAt: NOW, user: { id: 'u2', email: 'b@x.com', profile: null, wearableConnections: [] } },
        ],
      }),
    );
    prismaMock.groupInvitation.findMany.mockResolvedValue([
      { id: 'i1', email: 'c@x.com', status: 'PENDING', expiresAt: new Date(Date.now() + 60_000), lastSentAt: NOW },
      { id: 'i2', email: 'd@x.com', status: 'PENDING', expiresAt: new Date(Date.now() - 60_000), lastSentAt: NOW },
    ]);

    const detail = await getGroupDetailForAdmin('g1');

    expect(detail!.members[0]).toMatchObject({
      userId: 'u1',
      fullName: 'Anna',
      lastSyncAt: '2026-10-10T08:00:00.000Z',
      connectedProviders: ['OURA', 'APPLE_HEALTH'],
    });
    expect(detail!.members[1]).toMatchObject({ userId: 'u2', fullName: null, lastSyncAt: null, connectedProviders: [] });
    expect(detail!.invitations.map((i) => [i.email, i.state])).toEqual([
      ['c@x.com', 'PENDING'],
      ['d@x.com', 'EXPIRED'],
    ]);
    expect(prismaMock.groupInvitation.findMany.mock.calls[0]![0].where).toEqual({ groupId: 'g1', status: 'PENDING' });
  });

  it('returns null for an unknown group', async () => {
    prismaMock.wellbeingGroup.findUnique.mockResolvedValue(null);
    expect(await getGroupDetailForAdmin('nope')).toBeNull();
  });
});

describe('getGroupLogo', () => {
  it('returns the bytes and type, or null when there is no logo / group', async () => {
    prismaMock.wellbeingGroup.findUnique
      .mockResolvedValueOnce({ logoData: PNG, logoContentType: 'image/png' })
      .mockResolvedValueOnce({ logoData: null, logoContentType: null })
      .mockResolvedValueOnce(null);
    expect((await getGroupLogo('g1'))!.contentType).toBe('image/png');
    expect(await getGroupLogo('g1')).toBeNull();
    expect(await getGroupLogo('nope')).toBeNull();
  });
});

describe('removeMembership / removeMemberAsAdmin', () => {
  it('removes the membership and the person from that group’s challenges only', async () => {
    prismaMock.groupMembership.findUnique.mockResolvedValue({ id: 'm1' });
    expect(await removeMembership('g1', 'u1')).toBe(true);
    expect(prismaMock.groupChallengeParticipant.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', challenge: { groupId: 'g1' } },
    });
    expect(prismaMock.groupMembership.delete).toHaveBeenCalledWith({
      where: { groupId_userId: { groupId: 'g1', userId: 'u1' } },
    });
  });

  it('is false (and deletes nothing) when the user is not a member', async () => {
    prismaMock.groupMembership.findUnique.mockResolvedValue(null);
    expect(await removeMembership('g1', 'u1')).toBe(false);
    expect(prismaMock.groupMembership.delete).not.toHaveBeenCalled();
  });

  it('audits an admin removal, but not a no-op', async () => {
    prismaMock.groupMembership.findUnique.mockResolvedValueOnce({ id: 'm1' }).mockResolvedValueOnce(null);
    await removeMemberAsAdmin('admin', 'g1', 'u1');
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_GROUP_REMOVE_MEMBER', actorUserId: 'admin', targetUserId: 'u1' }),
    );
    recordAuditLog.mockClear();
    await removeMemberAsAdmin('admin', 'g1', 'u2');
    expect(recordAuditLog).not.toHaveBeenCalled();
  });
});

describe('listMyGroups', () => {
  it('maps the caller’s memberships', async () => {
    prismaMock.groupMembership.findMany.mockResolvedValue([
      { createdAt: NOW, group: { id: 'g1', name: 'Acme', logoContentType: 'image/png', updatedAt: NOW, _count: { members: 7 } } },
    ]);
    const groups = await listMyGroups('u1');
    expect(prismaMock.groupMembership.findMany.mock.calls[0]![0].where).toEqual({ userId: 'u1' });
    expect(groups).toEqual([
      { id: 'g1', name: 'Acme', logoUrl: `/api/groups/g1/logo?v=${NOW.getTime()}`, memberCount: 7, joinedAt: NOW.toISOString() },
    ]);
  });
});

describe('pure helpers', () => {
  it('invitationState flips to EXPIRED exactly at expiresAt', () => {
    expect(invitationState({ expiresAt: new Date('2026-10-10T12:00:00Z') }, new Date('2026-10-10T11:59:59Z'))).toBe('PENDING');
    expect(invitationState({ expiresAt: new Date('2026-10-10T12:00:00Z') }, new Date('2026-10-10T12:00:00Z'))).toBe('EXPIRED');
  });
  it('groupLogoUrl is null without a logo', () => {
    expect(groupLogoUrl({ id: 'g', hasLogo: false, updatedAt: NOW })).toBeNull();
  });
});
