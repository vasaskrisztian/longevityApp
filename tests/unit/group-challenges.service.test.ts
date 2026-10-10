import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  wellbeingGroup: { findUnique: vi.fn() },
  groupMembership: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  groupChallenge: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), delete: vi.fn(), updateMany: vi.fn() },
  groupChallengeParticipant: { upsert: vi.fn(), deleteMany: vi.fn() },
};
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logging/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
const recordAuditLog = vi.fn();
vi.mock('@/lib/audit/audit-log.service', () => ({ recordAuditLog }));
const countQualifyingPeriodsFor = vi.fn();
vi.mock('@/modules/challenges/challenges.service', () => ({ countQualifyingPeriodsFor }));
const createNotification = vi.fn();
const createNotificationsForUsers = vi.fn();
vi.mock('@/modules/notifications/notifications.service', () => ({ createNotification, createNotificationsForUsers }));
const listMemberIds = vi.fn();
vi.mock('@/modules/groups/groups.service', () => ({ listMemberIds }));

const {
  toChallengeDTO,
  computeParticipantProgress,
  createGroupChallenge,
  deleteGroupChallenge,
  listGroupChallengesForAdmin,
  getGroupChallengeDetailForAdmin,
  listMyGroupChallenges,
  joinGroupChallenge,
  leaveGroupChallenge,
  finalizeEndedGroupChallenges,
} = await import('@/modules/groups/group-challenges.service');

const NOW = new Date('2026-10-12T09:00:00Z');
const challengeRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  groupId: 'g1',
  createdById: 'admin',
  name: 'Steps',
  description: null,
  type: 'DAILY_STEPS',
  threshold: 8000,
  requiredCount: 5,
  startsAt: new Date('2026-10-10T00:00:00Z'),
  endsAt: new Date('2026-10-17T00:00:00Z'), // last day = 2026-10-16
  summarySentAt: null,
  participants: [] as { userId: string }[],
  ...overrides,
});
const user = (id: string, fullName: string | null = null) => ({ id, email: `${id}@x.com`, profile: fullName ? { fullName } : null });

beforeEach(() => {
  vi.clearAllMocks();
  countQualifyingPeriodsFor.mockResolvedValue(0);
});

describe('toChallengeDTO', () => {
  it('reports the inclusive last day, the status and the days left', () => {
    const dto = toChallengeDTO(challengeRow(), NOW);
    expect(dto).toMatchObject({
      startDate: '2026-10-10',
      endDate: '2026-10-16',
      status: 'ACTIVE',
      target: '5 days with more than 8000 steps',
      daysRemaining: 5,
    });
  });
  it('has no daysRemaining before the start or after the end', () => {
    expect(toChallengeDTO(challengeRow(), new Date('2026-10-01T00:00:00Z'))).toMatchObject({ status: 'UPCOMING', daysRemaining: null });
    expect(toChallengeDTO(challengeRow(), new Date('2026-10-20T00:00:00Z'))).toMatchObject({ status: 'ENDED', daysRemaining: null });
  });
});

describe('computeParticipantProgress', () => {
  it('counts from the start up to now while active', async () => {
    countQualifyingPeriodsFor.mockResolvedValue(3);
    const progress = await computeParticipantProgress(challengeRow() as never, 'u1', NOW);
    expect(countQualifyingPeriodsFor).toHaveBeenCalledWith({
      userId: 'u1',
      type: 'DAILY_STEPS',
      threshold: 8000,
      from: new Date('2026-10-10T00:00:00Z'),
      to: NOW,
    });
    expect(progress).toMatchObject({ currentCount: 3, requiredCount: 5, percent: 60, completed: false });
  });
  it('clips the window to the last millisecond of the final day once ended (so the final day counts, the day after does not)', async () => {
    await computeParticipantProgress(challengeRow() as never, 'u1', new Date('2026-10-20T00:00:00Z'));
    expect(countQualifyingPeriodsFor.mock.calls[0]![0].to).toEqual(new Date('2026-10-16T23:59:59.999Z'));
  });
  it('does not query before the challenge starts', async () => {
    const progress = await computeParticipantProgress(challengeRow() as never, 'u1', new Date('2026-10-01T00:00:00Z'));
    expect(countQualifyingPeriodsFor).not.toHaveBeenCalled();
    expect(progress.currentCount).toBe(0);
  });
});

describe('createGroupChallenge', () => {
  const input = {
    name: 'Steps',
    type: 'DAILY_STEPS' as const,
    threshold: 8000,
    requiredCount: 5,
    startDate: '2026-10-10',
    endDate: '2026-10-16',
  };

  it('returns null for an unknown group', async () => {
    prismaMock.wellbeingGroup.findUnique.mockResolvedValue(null);
    expect(await createGroupChallenge('admin', 'nope', input, NOW)).toBeNull();
  });

  it('stores whole-day bounds (end date inclusive → exclusive next midnight) and notifies every member', async () => {
    prismaMock.wellbeingGroup.findUnique.mockResolvedValue({ id: 'g1', name: 'Acme' });
    prismaMock.groupChallenge.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'c1', ...data }));
    listMemberIds.mockResolvedValue(['u1', 'u2']);

    const dto = await createGroupChallenge('admin', 'g1', input, NOW);

    const data = prismaMock.groupChallenge.create.mock.calls[0]![0].data;
    expect(data.startsAt).toEqual(new Date('2026-10-10T00:00:00Z'));
    expect(data.endsAt).toEqual(new Date('2026-10-17T00:00:00Z'));
    expect(data.createdById).toBe('admin');
    expect(dto).toMatchObject({ id: 'c1', startDate: '2026-10-10', endDate: '2026-10-16' });
    expect(createNotificationsForUsers).toHaveBeenCalledWith(
      ['u1', 'u2'],
      expect.objectContaining({
        type: 'GROUP_CHALLENGE_NEW',
        title: 'New group challenge: Steps',
        data: { groupId: 'g1', challengeId: 'c1' },
      }),
    );
    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'ADMIN_GROUP_CHALLENGE_CREATE' }));
  });

  it('rejects a challenge that already ended and creates nothing', async () => {
    prismaMock.wellbeingGroup.findUnique.mockResolvedValue({ id: 'g1', name: 'Acme' });
    await expect(
      createGroupChallenge('admin', 'g1', { ...input, startDate: '2026-09-01', endDate: '2026-09-30' }, NOW),
    ).rejects.toMatchObject({ code: 'invalid_dates' });
    expect(prismaMock.groupChallenge.create).not.toHaveBeenCalled();
  });

  it('allows a challenge that ends today (end date inclusive)', async () => {
    prismaMock.wellbeingGroup.findUnique.mockResolvedValue({ id: 'g1', name: 'Acme' });
    prismaMock.groupChallenge.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'c1', ...data }));
    listMemberIds.mockResolvedValue([]);
    await expect(
      createGroupChallenge('admin', 'g1', { ...input, startDate: '2026-10-12', endDate: '2026-10-12' }, NOW),
    ).resolves.toMatchObject({ endDate: '2026-10-12' });
  });
});

describe('deleteGroupChallenge', () => {
  it('deletes only a challenge of that group', async () => {
    prismaMock.groupChallenge.findUnique
      .mockResolvedValueOnce({ id: 'c1', groupId: 'g1' })
      .mockResolvedValueOnce({ id: 'c1', groupId: 'other' })
      .mockResolvedValueOnce(null);
    expect(await deleteGroupChallenge('a', 'g1', 'c1')).toBe(true);
    expect(await deleteGroupChallenge('a', 'g1', 'c1')).toBe(false);
    expect(await deleteGroupChallenge('a', 'g1', 'c1')).toBe(false);
    expect(prismaMock.groupChallenge.delete).toHaveBeenCalledTimes(1);
  });
});

describe('listGroupChallengesForAdmin', () => {
  it('adds the team aggregate per challenge', async () => {
    prismaMock.groupChallenge.findMany.mockResolvedValue([challengeRow({ participants: [{ userId: 'u1' }, { userId: 'u2' }] })]);
    prismaMock.groupMembership.count.mockResolvedValue(4);
    countQualifyingPeriodsFor.mockResolvedValueOnce(5).mockResolvedValueOnce(1);

    const [item] = await listGroupChallengesForAdmin('g1', NOW);

    expect(item!.team).toEqual({ participants: 2, members: 4, completed: 1, averagePercent: 60 });
    expect(prismaMock.groupChallenge.findMany.mock.calls[0]![0].where).toEqual({ groupId: 'g1' });
  });
});

describe('getGroupChallengeDetailForAdmin', () => {
  it('ranks participants by progress and lists the members who did not join', async () => {
    prismaMock.groupChallenge.findUnique.mockResolvedValue(
      challengeRow({ participants: [{ user: user('u1', 'Anna') }, { user: user('u2') }] }),
    );
    prismaMock.groupMembership.findMany.mockResolvedValue([{ user: user('u1', 'Anna') }, { user: user('u2') }, { user: user('u3', 'Cili') }]);
    countQualifyingPeriodsFor.mockResolvedValueOnce(1).mockResolvedValueOnce(4);

    const detail = await getGroupChallengeDetailForAdmin('g1', 'c1', NOW);

    expect(detail!.participants.map((p) => [p.userId, p.progress.currentCount])).toEqual([
      ['u2', 4],
      ['u1', 1],
    ]);
    expect(detail!.notJoined).toEqual([{ userId: 'u3', email: 'u3@x.com', fullName: 'Cili' }]);
    expect(detail!.team).toMatchObject({ participants: 2, members: 3 });
  });

  it('is null for another group’s challenge or an unknown id', async () => {
    prismaMock.groupChallenge.findUnique.mockResolvedValueOnce(challengeRow({ groupId: 'other' })).mockResolvedValueOnce(null);
    expect(await getGroupChallengeDetailForAdmin('g1', 'c1', NOW)).toBeNull();
    expect(await getGroupChallengeDetailForAdmin('g1', 'c1', NOW)).toBeNull();
  });
});

describe('member view', () => {
  it('only members can list the group’s challenges', async () => {
    prismaMock.groupMembership.findUnique.mockResolvedValue(null);
    await expect(listMyGroupChallenges('u1', 'g1', NOW)).rejects.toMatchObject({ code: 'not_member' });
    expect(prismaMock.groupChallenge.findMany).not.toHaveBeenCalled();
  });

  it('shows own progress when joined, only the aggregate for the team, and no other person’s identity', async () => {
    prismaMock.groupMembership.findUnique.mockResolvedValue({ id: 'm' });
    prismaMock.groupMembership.count.mockResolvedValue(3);
    prismaMock.groupChallenge.findMany.mockResolvedValue([
      challengeRow({ participants: [{ userId: 'u1' }, { userId: 'u2' }] }),
      challengeRow({ id: 'c2', participants: [{ userId: 'u2' }] }),
    ]);
    countQualifyingPeriodsFor.mockImplementation(async ({ userId }: { userId: string }) => (userId === 'u1' ? 5 : 1));

    const [joined, notJoined] = await listMyGroupChallenges('u1', 'g1', NOW);

    expect(joined).toMatchObject({ joined: true, me: { currentCount: 5, completed: true }, team: { participants: 2, completed: 1, averagePercent: 60 } });
    expect(notJoined).toMatchObject({ id: 'c2', joined: false, me: null, team: { participants: 1 } });
    expect(JSON.stringify([joined, notJoined])).not.toContain('u2');
  });

  it('join: needs membership, the challenge in that group, and not ended', async () => {
    prismaMock.groupMembership.findUnique.mockResolvedValue({ id: 'm' });
    prismaMock.groupChallenge.findUnique.mockResolvedValue(challengeRow());
    await joinGroupChallenge('u1', 'g1', 'c1', NOW);
    expect(prismaMock.groupChallengeParticipant.upsert).toHaveBeenCalledWith({
      where: { challengeId_userId: { challengeId: 'c1', userId: 'u1' } },
      create: { challengeId: 'c1', userId: 'u1' },
      update: {},
    });

    prismaMock.groupChallenge.findUnique.mockResolvedValue(challengeRow({ groupId: 'other' }));
    await expect(joinGroupChallenge('u1', 'g1', 'c1', NOW)).rejects.toMatchObject({ code: 'not_found' });
    prismaMock.groupChallenge.findUnique.mockResolvedValue(challengeRow());
    await expect(joinGroupChallenge('u1', 'g1', 'c1', new Date('2026-10-20T00:00:00Z'))).rejects.toMatchObject({ code: 'ended' });
    prismaMock.groupMembership.findUnique.mockResolvedValue(null);
    await expect(joinGroupChallenge('u1', 'g1', 'c1', NOW)).rejects.toMatchObject({ code: 'not_member' });
  });

  it('leave: allowed while running, refused once ended (a finished result is final)', async () => {
    prismaMock.groupMembership.findUnique.mockResolvedValue({ id: 'm' });
    prismaMock.groupChallenge.findUnique.mockResolvedValue(challengeRow());
    await leaveGroupChallenge('u1', 'g1', 'c1', NOW);
    expect(prismaMock.groupChallengeParticipant.deleteMany).toHaveBeenCalledWith({ where: { challengeId: 'c1', userId: 'u1' } });
    await expect(leaveGroupChallenge('u1', 'g1', 'c1', new Date('2026-10-20T00:00:00Z'))).rejects.toMatchObject({ code: 'ended' });
  });
});

describe('finalizeEndedGroupChallenges', () => {
  const AFTER = new Date('2026-10-18T00:00:00Z');
  const ended = (overrides: Record<string, unknown> = {}) =>
    challengeRow({ group: { name: 'Acme' }, participants: [{ userId: 'u1' }, { userId: 'u2' }], ...overrides });

  it('looks only for ended, not-yet-summarised challenges', async () => {
    prismaMock.groupChallenge.findMany.mockResolvedValue([]);
    expect(await finalizeEndedGroupChallenges(AFTER)).toEqual({ finalized: 0 });
    expect(prismaMock.groupChallenge.findMany.mock.calls[0]![0].where).toEqual({ endsAt: { lte: AFTER }, summarySentAt: null });
  });

  it('claims the challenge first, then sends each participant their own result plus the team’s, and one to the creator', async () => {
    prismaMock.groupChallenge.findMany.mockResolvedValue([ended()]);
    prismaMock.groupChallenge.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.groupMembership.count.mockResolvedValue(4);
    countQualifyingPeriodsFor.mockImplementation(async ({ userId }: { userId: string }) => (userId === 'u1' ? 5 : 2));

    expect(await finalizeEndedGroupChallenges(AFTER)).toEqual({ finalized: 1 });

    expect(prismaMock.groupChallenge.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', summarySentAt: null },
      data: { summarySentAt: AFTER },
    });
    const byUser = new Map(createNotification.mock.calls.map(([id, n]) => [id, n]));
    expect(byUser.get('u1')!.body).toContain('You reached the goal (5 of 5).');
    expect(byUser.get('u2')!.body).toContain('You got to 2 of 5 (40%).');
    expect(byUser.get('u1')!.body).toContain('Team: 1 of 2 participants reached the goal, average progress 70%.');
    expect(byUser.get('u1')!.type).toBe('GROUP_CHALLENGE_SUMMARY');
    expect(byUser.get('u1')!.data).toEqual({ groupId: 'g1', challengeId: 'c1' });
    expect(byUser.get('admin')!.body).toContain('2 of 4 members took part');
    expect(createNotification).toHaveBeenCalledTimes(3);
  });

  it('sends nothing when another caller already claimed it (exactly-once under concurrency)', async () => {
    prismaMock.groupChallenge.findMany.mockResolvedValue([ended()]);
    prismaMock.groupChallenge.updateMany.mockResolvedValue({ count: 0 });
    expect(await finalizeEndedGroupChallenges(AFTER)).toEqual({ finalized: 0 });
    expect(createNotification).not.toHaveBeenCalled();
    expect(countQualifyingPeriodsFor).not.toHaveBeenCalled();
  });

  it('a challenge nobody joined still summarises to the creator', async () => {
    prismaMock.groupChallenge.findMany.mockResolvedValue([ended({ participants: [] })]);
    prismaMock.groupChallenge.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.groupMembership.count.mockResolvedValue(4);
    await finalizeEndedGroupChallenges(AFTER);
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(createNotification.mock.calls[0]![0]).toBe('admin');
    expect(createNotification.mock.calls[0]![1].body).toContain('0 of 4 members took part');
  });

  it('one failing challenge does not stop the others', async () => {
    prismaMock.groupChallenge.findMany.mockResolvedValue([ended({ id: 'bad' }), ended({ id: 'good' })]);
    prismaMock.groupChallenge.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.groupMembership.count.mockResolvedValue(2);
    countQualifyingPeriodsFor.mockRejectedValueOnce(new Error('db blip')).mockResolvedValue(1);
    const result = await finalizeEndedGroupChallenges(AFTER);
    expect(result.finalized).toBe(1);
  });
});
