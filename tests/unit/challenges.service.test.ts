import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const prismaMock = {
  challenge: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  dailyHealthMetric: {
    count: vi.fn(),
  },
  workout: {
    count: vi.fn(),
  },
};

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

const {
  computeProgress,
  listChallenges,
  getChallengeById,
  createChallenge,
  updateChallenge,
  activateChallenge,
  deleteChallenge,
} = await import('@/modules/challenges/challenges.service');

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-01-15T00:00:00.000Z');

const DRAFT_SLEEP_CHALLENGE = {
  id: 'c1',
  userId: 'u1',
  type: 'SLEEP_SCORE' as const,
  name: '10 good nights',
  requiredCount: 10,
  threshold: 80,
  windowDays: 21,
  activatedAt: null,
  expiresAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('computeProgress', () => {
  it('returns DRAFT with currentCount 0 and no daysRemaining for a never-activated challenge', async () => {
    const progress = await computeProgress(DRAFT_SLEEP_CHALLENGE as never);

    expect(progress).toEqual({
      status: 'DRAFT',
      currentCount: 0,
      requiredCount: 10,
      daysRemaining: null,
    });
    expect(prismaMock.dailyHealthMetric.count).not.toHaveBeenCalled();
  });

  it('returns ACTIVE with the live qualifying-day count (SLEEP_SCORE) while below target and before expiry', async () => {
    const activatedAt = new Date(NOW.getTime() - 2 * DAY_MS);
    const expiresAt = new Date(NOW.getTime() + 5 * DAY_MS);
    prismaMock.dailyHealthMetric.count.mockResolvedValue(3);

    const progress = await computeProgress({
      ...DRAFT_SLEEP_CHALLENGE,
      activatedAt,
      expiresAt,
    } as never);

    expect(progress.status).toBe('ACTIVE');
    expect(progress.currentCount).toBe(3);
    expect(progress.daysRemaining).toBe(5);
    expect(prismaMock.dailyHealthMetric.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'u1', sleepScore: { gt: 80 } }),
      }),
    );
  });

  it('returns COMPLETED once the qualifying count reaches requiredCount, even before expiry', async () => {
    const activatedAt = new Date(NOW.getTime() - 2 * DAY_MS);
    const expiresAt = new Date(NOW.getTime() + 5 * DAY_MS);
    prismaMock.dailyHealthMetric.count.mockResolvedValue(10);

    const progress = await computeProgress({
      ...DRAFT_SLEEP_CHALLENGE,
      activatedAt,
      expiresAt,
    } as never);

    expect(progress.status).toBe('COMPLETED');
    expect(progress.currentCount).toBe(10);
    expect(progress.daysRemaining).toBeNull();
  });

  it('returns FAILED once expiresAt has passed without reaching requiredCount', async () => {
    const activatedAt = new Date(NOW.getTime() - 21 * DAY_MS);
    const expiresAt = new Date(NOW.getTime() - 1 * DAY_MS);
    prismaMock.dailyHealthMetric.count.mockResolvedValue(4);

    const progress = await computeProgress({
      ...DRAFT_SLEEP_CHALLENGE,
      activatedAt,
      expiresAt,
    } as never);

    expect(progress.status).toBe('FAILED');
    expect(progress.currentCount).toBe(4);
    expect(progress.daysRemaining).toBeNull();
  });

  it('queries the steps column for a DAILY_STEPS challenge', async () => {
    const activatedAt = new Date(NOW.getTime() - 2 * DAY_MS);
    const expiresAt = new Date(NOW.getTime() + 5 * DAY_MS);
    prismaMock.dailyHealthMetric.count.mockResolvedValue(1);

    await computeProgress({
      ...DRAFT_SLEEP_CHALLENGE,
      type: 'DAILY_STEPS',
      threshold: 10000,
      activatedAt,
      expiresAt,
    } as never);

    expect(prismaMock.dailyHealthMetric.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ steps: { gt: 10000 } }),
      }),
    );
  });

  describe('WEEKLY_WORKOUTS chunk-bucketing', () => {
    it('counts a chunk as qualifying as soon as its workout count exceeds the threshold', async () => {
      const activatedAt = new Date(NOW.getTime() - 14 * DAY_MS);
      const expiresAt = new Date(NOW.getTime() + 14 * DAY_MS);
      prismaMock.workout.count.mockResolvedValue(5); // exceeds threshold on every chunk

      const progress = await computeProgress({
        ...DRAFT_SLEEP_CHALLENGE,
        type: 'WEEKLY_WORKOUTS',
        threshold: 2,
        requiredCount: 4,
        activatedAt,
        expiresAt,
      } as never);

      const chunkCalls = prismaMock.workout.count.mock.calls.length;
      expect(chunkCalls).toBeGreaterThan(0);
      // Every chunk's mocked count (5) exceeds the threshold (2), so every
      // queried chunk should count toward currentCount.
      expect(progress.currentCount).toBe(chunkCalls);
    });

    it('does not count a chunk whose workout count is at or below the threshold', async () => {
      const activatedAt = new Date(NOW.getTime() - 14 * DAY_MS);
      const expiresAt = new Date(NOW.getTime() + 14 * DAY_MS);
      prismaMock.workout.count.mockResolvedValue(1); // below threshold on every chunk

      const progress = await computeProgress({
        ...DRAFT_SLEEP_CHALLENGE,
        type: 'WEEKLY_WORKOUTS',
        threshold: 2,
        requiredCount: 4,
        activatedAt,
        expiresAt,
      } as never);

      expect(progress.currentCount).toBe(0);
    });

    it('scopes each chunk query to the challenge owner', async () => {
      const activatedAt = new Date(NOW.getTime() - 7 * DAY_MS);
      const expiresAt = new Date(NOW.getTime() + 7 * DAY_MS);
      prismaMock.workout.count.mockResolvedValue(0);

      await computeProgress({
        ...DRAFT_SLEEP_CHALLENGE,
        type: 'WEEKLY_WORKOUTS',
        threshold: 2,
        activatedAt,
        expiresAt,
      } as never);

      expect(prismaMock.workout.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 'u1' }) }),
      );
    });
  });
});

describe('listChallenges', () => {
  it('lists challenges scoped to the given userId, newest first, each with computed progress', async () => {
    prismaMock.challenge.findMany.mockResolvedValue([DRAFT_SLEEP_CHALLENGE]);

    const result = await listChallenges('u1');

    expect(prismaMock.challenge.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.progress.status).toBe('DRAFT');
  });
});

describe('getChallengeById', () => {
  it('returns the challenge with computed progress when found', async () => {
    prismaMock.challenge.findUnique.mockResolvedValue(DRAFT_SLEEP_CHALLENGE);

    const result = await getChallengeById('c1');

    expect(prismaMock.challenge.findUnique).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(result?.id).toBe('c1');
    expect(result?.progress.status).toBe('DRAFT');
  });

  it('returns null when not found', async () => {
    prismaMock.challenge.findUnique.mockResolvedValue(null);
    await expect(getChallengeById('missing')).resolves.toBeNull();
  });
});

describe('createChallenge', () => {
  it('creates a challenge scoped to the given userId, as a draft', async () => {
    const input = { type: 'SLEEP_SCORE' as const, requiredCount: 10, threshold: 80, windowDays: 21 };
    prismaMock.challenge.create.mockResolvedValue({ id: 'c1', userId: 'u1', ...input });

    const result = await createChallenge('u1', input);

    expect(prismaMock.challenge.create).toHaveBeenCalledWith({ data: { userId: 'u1', ...input } });
    expect(result.id).toBe('c1');
    // A brand-new challenge has no activatedAt yet, so its computed status
    // must be DRAFT rather than a missing/undefined progress field.
    expect(result.progress.status).toBe('DRAFT');
  });
});

describe('updateChallenge', () => {
  it('updates the challenge by id and returns it with computed progress', async () => {
    prismaMock.challenge.update.mockResolvedValue({ ...DRAFT_SLEEP_CHALLENGE, name: 'Renamed' });

    const result = await updateChallenge('c1', { name: 'Renamed' });

    expect(prismaMock.challenge.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { name: 'Renamed' } });
    expect(result.name).toBe('Renamed');
    expect(result.progress.status).toBe('DRAFT');
  });
});

describe('activateChallenge', () => {
  it('sets activatedAt to now and expiresAt to windowDays days out, and returns it with computed progress', async () => {
    prismaMock.challenge.update.mockImplementation(({ data }: { data: { activatedAt: Date; expiresAt: Date } }) =>
      Promise.resolve({ ...DRAFT_SLEEP_CHALLENGE, ...data }),
    );
    prismaMock.dailyHealthMetric.count.mockResolvedValue(0);

    const result = await activateChallenge('c1', 21);

    expect(result.activatedAt?.getTime()).toBe(NOW.getTime());
    expect(result.expiresAt?.getTime()).toBe(NOW.getTime() + 21 * DAY_MS);
    expect(prismaMock.challenge.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { activatedAt: expect.any(Date), expiresAt: expect.any(Date) },
    });
    // The activate response feeds straight into the UI, which always reads
    // .progress.status — must never come back undefined (see createChallenge/
    // updateChallenge, which have the same requirement).
    expect(result.progress.status).toBe('ACTIVE');
  });
});

describe('deleteChallenge', () => {
  it('deletes the challenge by id', async () => {
    prismaMock.challenge.delete.mockResolvedValue({});
    await deleteChallenge('c1');
    expect(prismaMock.challenge.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });
});
