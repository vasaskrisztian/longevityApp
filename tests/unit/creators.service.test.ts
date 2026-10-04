import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  protocol: {
    updateMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  challenge: {
    updateMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  dailyHealthMetric: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  follow: {
    count: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
};

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

const computeProgressMock = vi.fn();
vi.mock('@/modules/challenges/challenges.service', () => ({
  computeProgress: computeProgressMock,
}));

const {
  canPublishPublicly,
  getPublicProfileStatus,
  setPublicProfileConsent,
  revokePublicProfileConsent,
  getCreatorPublicProfile,
  getCreatorTeaser,
  listPublicCreators,
  followCreator,
  unfollowCreator,
  isFollowing,
  getFollowerCount,
  listMyFollowing,
  NotACreatorError,
  CreatorNotFollowableError,
} = await import('@/modules/creators/creators.service');

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
});

describe('canPublishPublicly', () => {
  it('is false when the user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(canPublishPublicly('missing')).resolves.toBe(false);
  });

  it('is false for a plain MEMBER account', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ accountType: 'MEMBER', publicProfileConsentAt: null });
    await expect(canPublishPublicly('u1')).resolves.toBe(false);
  });

  it('is false for a CREATOR who has not consented', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ accountType: 'CREATOR', publicProfileConsentAt: null });
    await expect(canPublishPublicly('u1')).resolves.toBe(false);
  });

  it('is true for a consenting CREATOR', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      accountType: 'CREATOR',
      publicProfileConsentAt: new Date('2026-01-01'),
    });
    await expect(canPublishPublicly('u1')).resolves.toBe(true);
  });
});

describe('getPublicProfileStatus', () => {
  it('defaults to MEMBER/canPublish:false when the user row is missing', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(getPublicProfileStatus('missing')).resolves.toEqual({
      accountType: 'MEMBER',
      canPublish: false,
    });
  });

  it('reports a plain MEMBER account as canPublish:false', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ accountType: 'MEMBER', publicProfileConsentAt: null });
    await expect(getPublicProfileStatus('u1')).resolves.toEqual({ accountType: 'MEMBER', canPublish: false });
  });

  it('reports a non-consenting CREATOR as canPublish:false but accountType:CREATOR', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ accountType: 'CREATOR', publicProfileConsentAt: null });
    await expect(getPublicProfileStatus('u1')).resolves.toEqual({ accountType: 'CREATOR', canPublish: false });
  });

  it('reports a consenting CREATOR as canPublish:true', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      accountType: 'CREATOR',
      publicProfileConsentAt: new Date('2026-01-01'),
    });
    await expect(getPublicProfileStatus('u1')).resolves.toEqual({ accountType: 'CREATOR', canPublish: true });
  });
});

describe('setPublicProfileConsent', () => {
  it('throws NotACreatorError for a MEMBER account and never writes', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ accountType: 'MEMBER' });
    await expect(setPublicProfileConsent('u1')).rejects.toBeInstanceOf(NotACreatorError);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('sets publicProfileConsentAt for a CREATOR account', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ accountType: 'CREATOR' });
    prismaMock.user.update.mockResolvedValue({});
    await setPublicProfileConsent('u1');
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { publicProfileConsentAt: expect.any(Date) },
    });
  });
});

describe('revokePublicProfileConsent', () => {
  it('clears consent AND flips every protocol/challenge back to PRIVATE in one transaction', async () => {
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.protocol.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.challenge.updateMany.mockResolvedValue({ count: 1 });

    await revokePublicProfileConsent('u1');

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { publicProfileConsentAt: null },
    });
    expect(prismaMock.protocol.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { visibility: 'PRIVATE' },
    });
    expect(prismaMock.challenge.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { visibility: 'PRIVATE' },
    });
  });
});

describe('getCreatorPublicProfile', () => {
  it('returns null when the user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(getCreatorPublicProfile('missing')).resolves.toBeNull();
  });

  it('returns null for a MEMBER account (not just a 403 — same shape as "does not exist")', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      accountType: 'MEMBER',
      publicProfileConsentAt: null,
      createdAt: new Date(),
      profile: null,
    });
    await expect(getCreatorPublicProfile('u1')).resolves.toBeNull();
  });

  it('returns null for a CREATOR who has not consented', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      accountType: 'CREATOR',
      publicProfileConsentAt: null,
      createdAt: new Date(),
      profile: null,
    });
    await expect(getCreatorPublicProfile('u1')).resolves.toBeNull();
  });

  it('returns the shaped public profile for a consenting creator, with computed challenge progress', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      accountType: 'CREATOR',
      publicProfileConsentAt: new Date('2026-01-01'),
      createdAt: new Date('2025-01-01'),
      profile: { fullName: 'Ada Lovelace' },
    });
    prismaMock.follow.count.mockResolvedValue(42);
    prismaMock.protocol.findMany.mockResolvedValue([{ id: 'p1', supplements: [] }]);
    const challenge = { id: 'c1', type: 'SLEEP_SCORE' };
    prismaMock.challenge.findMany.mockResolvedValue([challenge]);
    prismaMock.dailyHealthMetric.findMany.mockResolvedValue([
      { date: new Date('2026-01-02'), sleepScore: 85, steps: 9000, restingHeartRate: 55, averageHrv: 42, activeCalories: 300 },
    ]);
    computeProgressMock.mockResolvedValue({ status: 'ACTIVE', currentCount: 2, requiredCount: 5, daysRemaining: 10 });

    const profile = await getCreatorPublicProfile('u1');

    expect(profile?.fullName).toBe('Ada Lovelace');
    expect(profile?.followerCount).toBe(42);
    expect(profile?.protocols).toHaveLength(1);
    expect(profile?.challenges[0]).toEqual({ ...challenge, progress: { status: 'ACTIVE', currentCount: 2, requiredCount: 5, daysRemaining: 10 } });
    expect(profile?.recentMetrics).toHaveLength(1);
    // Only PUBLIC rows are ever queried.
    expect(prismaMock.protocol.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', visibility: 'PUBLIC' } }),
    );
    expect(prismaMock.challenge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', visibility: 'PUBLIC' } }),
    );
  });
});

describe('getCreatorTeaser', () => {
  const consentedCreator = {
    id: 'c1',
    accountType: 'CREATOR',
    publicProfileConsentAt: new Date('2026-02-01'),
    createdAt: new Date('2026-01-01'),
    profile: { fullName: 'Ada Lovelace' },
  };

  it('returns null for missing, non-creator and non-consenting users', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    await expect(getCreatorTeaser('x')).resolves.toBeNull();
    prismaMock.user.findUnique.mockResolvedValueOnce({ ...consentedCreator, accountType: 'MEMBER' });
    await expect(getCreatorTeaser('x')).resolves.toBeNull();
    prismaMock.user.findUnique.mockResolvedValueOnce({ ...consentedCreator, publicProfileConsentAt: null });
    await expect(getCreatorTeaser('x')).resolves.toBeNull();
    expect(prismaMock.dailyHealthMetric.count).not.toHaveBeenCalled();
  });

  it('returns only name, join date and counts — never content or metrics', async () => {
    prismaMock.user.findUnique.mockResolvedValue(consentedCreator);
    prismaMock.follow.count.mockResolvedValue(5);
    prismaMock.protocol.count.mockResolvedValue(2);
    prismaMock.challenge.count.mockResolvedValue(1);
    prismaMock.dailyHealthMetric.count.mockResolvedValue(200);

    const teaser = await getCreatorTeaser('c1');

    expect(teaser).toEqual({
      id: 'c1',
      fullName: 'Ada Lovelace',
      memberSince: new Date('2026-01-01'),
      followerCount: 5,
      publicProtocolCount: 2,
      publicChallengeCount: 1,
      trackedDays: 200,
    });
    expect(prismaMock.protocol.findMany).not.toHaveBeenCalled();
    expect(prismaMock.challenge.findMany).not.toHaveBeenCalled();
    expect(prismaMock.dailyHealthMetric.findMany).not.toHaveBeenCalled();
    expect(prismaMock.protocol.count).toHaveBeenCalledWith({ where: { userId: 'c1', visibility: 'PUBLIC' } });
  });
});

describe('listPublicCreators', () => {
  it('only queries consenting CREATORs and attaches per-creator counts', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', createdAt: new Date('2025-06-01'), profile: { fullName: 'Ada Lovelace' } },
    ]);
    prismaMock.follow.count.mockResolvedValue(3);
    prismaMock.protocol.count.mockResolvedValue(2);
    prismaMock.challenge.count.mockResolvedValue(1);

    const creators = await listPublicCreators();

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountType: 'CREATOR', publicProfileConsentAt: { not: null } },
      }),
    );
    expect(creators).toEqual([
      {
        id: 'u1',
        fullName: 'Ada Lovelace',
        memberSince: new Date('2025-06-01'),
        followerCount: 3,
        publicProtocolCount: 2,
        publicChallengeCount: 1,
      },
    ]);
  });
});

describe('followCreator', () => {
  it('throws CreatorNotFollowableError on self-follow and never writes', async () => {
    await expect(followCreator('u1', 'u1')).rejects.toBeInstanceOf(CreatorNotFollowableError);
    expect(prismaMock.follow.create).not.toHaveBeenCalled();
  });

  it('throws CreatorNotFollowableError when the target is not an eligible public creator', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ accountType: 'MEMBER', publicProfileConsentAt: null });
    await expect(followCreator('u1', 'u2')).rejects.toBeInstanceOf(CreatorNotFollowableError);
    expect(prismaMock.follow.create).not.toHaveBeenCalled();
  });

  it('creates the Follow row for an eligible creator', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      accountType: 'CREATOR',
      publicProfileConsentAt: new Date(),
    });
    prismaMock.follow.create.mockResolvedValue({});

    await followCreator('u1', 'u2');

    expect(prismaMock.follow.create).toHaveBeenCalledWith({ data: { followerId: 'u1', creatorId: 'u2' } });
  });

  it('treats a P2002 unique-constraint error as already-following, not a failure', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      accountType: 'CREATOR',
      publicProfileConsentAt: new Date(),
    });
    prismaMock.follow.create.mockRejectedValue({ code: 'P2002' });

    await expect(followCreator('u1', 'u2')).resolves.toBeUndefined();
  });

  it('rethrows a non-P2002 error', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      accountType: 'CREATOR',
      publicProfileConsentAt: new Date(),
    });
    prismaMock.follow.create.mockRejectedValue(new Error('db down'));

    await expect(followCreator('u1', 'u2')).rejects.toThrow('db down');
  });
});

describe('unfollowCreator / isFollowing / getFollowerCount', () => {
  it('unfollowCreator deletes by the (follower, creator) pair', async () => {
    prismaMock.follow.deleteMany.mockResolvedValue({ count: 1 });
    await unfollowCreator('u1', 'u2');
    expect(prismaMock.follow.deleteMany).toHaveBeenCalledWith({ where: { followerId: 'u1', creatorId: 'u2' } });
  });

  it('isFollowing is true only when a Follow row exists', async () => {
    prismaMock.follow.findUnique.mockResolvedValue({ id: 'f1' });
    await expect(isFollowing('u1', 'u2')).resolves.toBe(true);

    prismaMock.follow.findUnique.mockResolvedValue(null);
    await expect(isFollowing('u1', 'u2')).resolves.toBe(false);
  });

  it('getFollowerCount counts Follow rows scoped to the creator', async () => {
    prismaMock.follow.count.mockResolvedValue(7);
    await expect(getFollowerCount('u2')).resolves.toBe(7);
    expect(prismaMock.follow.count).toHaveBeenCalledWith({ where: { creatorId: 'u2' } });
  });
});

describe('listMyFollowing', () => {
  it('maps each Follow row to the creator summary, with public-only counts', async () => {
    prismaMock.follow.findMany.mockResolvedValue([
      { creatorId: 'u2', createdAt: new Date('2026-02-01'), creator: { id: 'u2', profile: { fullName: 'Ada' } } },
    ]);
    prismaMock.protocol.count.mockResolvedValue(4);
    prismaMock.challenge.count.mockResolvedValue(2);

    const following = await listMyFollowing('u1');

    expect(following).toEqual([
      {
        id: 'u2',
        fullName: 'Ada',
        followedAt: new Date('2026-02-01'),
        publicProtocolCount: 4,
        publicChallengeCount: 2,
      },
    ]);
  });
});
