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
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  workout: {
    findMany: vi.fn(),
  },
};

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

/** n distinct 30-minute running sessions, three hours apart — countDistinctWorkouts counts exactly n. */
function sessions(n: number) {
  const base = new Date('2026-06-01T08:00:00Z').getTime();
  return Array.from({ length: n }, (_, i) => ({
    startedAt: new Date(base + i * 3 * 3_600_000),
    endedAt: new Date(base + i * 3 * 3_600_000 + 30 * 60_000),
    durationMin: 30,
    activityType: 'running',
    source: 'confirmed',
  }));
}

const {
  sumMetricFor,
  dailyTotalsFor,
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
      prismaMock.workout.findMany.mockResolvedValue(sessions(5)); // exceeds threshold on every chunk

      const progress = await computeProgress({
        ...DRAFT_SLEEP_CHALLENGE,
        type: 'WEEKLY_WORKOUTS',
        threshold: 2,
        requiredCount: 4,
        activatedAt,
        expiresAt,
      } as never);

      const chunkCalls = prismaMock.workout.findMany.mock.calls.length;
      expect(chunkCalls).toBeGreaterThan(0);
      // Every chunk's mocked count (5) exceeds the threshold (2), so every
      // queried chunk should count toward currentCount.
      expect(progress.currentCount).toBe(chunkCalls);
    });

    it('does not count a chunk whose workout count is at or below the threshold', async () => {
      const activatedAt = new Date(NOW.getTime() - 14 * DAY_MS);
      const expiresAt = new Date(NOW.getTime() + 14 * DAY_MS);
      prismaMock.workout.findMany.mockResolvedValue(sessions(1)); // below threshold on every chunk

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

    it('does not count unconfirmed auto-detected walks or duplicate recordings of one session as workouts', async () => {
      const activatedAt = new Date(NOW.getTime() - 7 * DAY_MS);
      const expiresAt = new Date(NOW.getTime() + 7 * DAY_MS);
      const [run] = sessions(1);
      prismaMock.workout.findMany.mockResolvedValue([
        run,
        { ...run, startedAt: new Date(run!.startedAt.getTime() + 60_000) }, // same session recorded twice
        ...Array.from({ length: 6 }, (_, i) => ({
          startedAt: new Date('2026-06-02T08:00:00Z').getTime() + i * 3_600_000,
          endedAt: new Date('2026-06-02T08:30:00Z').getTime() + i * 3_600_000,
          durationMin: 30,
          activityType: 'walking',
          source: 'autodetected',
        })).map((w) => ({ ...w, startedAt: new Date(w.startedAt), endedAt: new Date(w.endedAt) })),
      ]);

      const progress = await computeProgress({
        ...DRAFT_SLEEP_CHALLENGE,
        type: 'WEEKLY_WORKOUTS',
        threshold: 1,
        requiredCount: 1,
        activatedAt,
        expiresAt,
      } as never);

      // Only one real session per chunk -> never exceeds the threshold of 1.
      expect(progress.currentCount).toBe(0);
    });

    it('scopes each chunk query to the challenge owner', async () => {
      const activatedAt = new Date(NOW.getTime() - 7 * DAY_MS);
      const expiresAt = new Date(NOW.getTime() + 7 * DAY_MS);
      prismaMock.workout.findMany.mockResolvedValue([]);

      await computeProgress({
        ...DRAFT_SLEEP_CHALLENGE,
        type: 'WEEKLY_WORKOUTS',
        threshold: 2,
        activatedAt,
        expiresAt,
      } as never);

      expect(prismaMock.workout.findMany).toHaveBeenCalledWith(
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

describe('sumMetricFor (team-total group challenges)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sums a person\'s steps over the inclusive UTC day range', async () => {
    prismaMock.dailyHealthMetric.aggregate.mockResolvedValue({ _sum: { steps: 54_321 } });
    const total = await sumMetricFor({
      userId: 'u1',
      type: 'DAILY_STEPS',
      from: new Date('2026-10-01T00:00:00Z'),
      to: new Date('2026-10-12T09:00:00Z'),
    });
    expect(total).toBe(54_321);
    expect(prismaMock.dailyHealthMetric.aggregate).toHaveBeenCalledWith({
      where: { userId: 'u1', date: { gte: new Date('2026-10-01T00:00:00Z'), lte: new Date('2026-10-12T00:00:00Z') } },
      _sum: { steps: true },
    });
  });

  it('is 0 when there is no step data at all', async () => {
    prismaMock.dailyHealthMetric.aggregate.mockResolvedValue({ _sum: { steps: null } });
    expect(await sumMetricFor({ userId: 'u1', type: 'DAILY_STEPS', from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-10-02T00:00:00Z') })).toBe(0);
  });

  it('counts distinct workouts over the whole window, through the last day inclusive', async () => {
    prismaMock.workout.findMany.mockResolvedValue(sessions(3));
    const total = await sumMetricFor({
      userId: 'u1',
      type: 'WEEKLY_WORKOUTS',
      from: new Date('2026-10-01T00:00:00Z'),
      to: new Date('2026-10-12T09:00:00Z'),
    });
    expect(total).toBe(3);
    expect(prismaMock.workout.findMany.mock.calls[0]![0].where).toEqual({
      userId: 'u1',
      startedAt: { gte: new Date('2026-10-01T00:00:00Z'), lt: new Date('2026-10-13T00:00:00Z') },
    });
  });
});

describe('dailyTotalsFor (team chart of a collective group challenge)', () => {
  beforeEach(() => vi.clearAllMocks());
  const from = new Date('2026-10-01T00:00:00Z');
  const to = new Date('2026-10-03T09:00:00Z');

  it('nobody joined → nothing to query', async () => {
    expect((await dailyTotalsFor({ userIds: [], type: 'DAILY_STEPS', from, to })).size).toBe(0);
    expect(prismaMock.dailyHealthMetric.groupBy).not.toHaveBeenCalled();
  });

  it('adds the participants\' steps up per UTC day', async () => {
    prismaMock.dailyHealthMetric.groupBy.mockResolvedValue([
      { date: new Date('2026-10-01T00:00:00Z'), _sum: { steps: 20_000 } },
      { date: new Date('2026-10-03T00:00:00Z'), _sum: { steps: null } },
    ]);
    const totals = await dailyTotalsFor({ userIds: ['u1', 'u2'], type: 'DAILY_STEPS', from, to });
    expect(Object.fromEntries(totals)).toEqual({ '2026-10-01': 20_000, '2026-10-03': 0 });
    expect(prismaMock.dailyHealthMetric.groupBy).toHaveBeenCalledWith({
      by: ['date'],
      where: { userId: { in: ['u1', 'u2'] }, date: { gte: new Date('2026-10-01T00:00:00Z'), lte: new Date('2026-10-03T00:00:00Z') } },
      _sum: { steps: true },
    });
  });

  it('counts each person\'s distinct workout sessions on the day they started, summed over people', async () => {
    const at = (iso: string, minutes = 30) => ({
      startedAt: new Date(iso),
      endedAt: new Date(new Date(iso).getTime() + minutes * 60_000),
      durationMin: minutes,
      activityType: 'running',
      source: 'confirmed',
    });
    prismaMock.workout.findMany.mockResolvedValue([
      { userId: 'u1', ...at('2026-10-01T08:00:00Z') },
      { userId: 'u1', ...at('2026-10-01T08:05:00Z') }, // same session recorded twice → merged
      { userId: 'u1', ...at('2026-10-02T18:00:00Z') },
      { userId: 'u2', ...at('2026-10-01T08:00:00Z') }, // another person, same time → counts separately
      { userId: 'u2', ...at('2026-10-02T09:00:00Z', 5) }, // too short → ignored
    ]);
    const totals = await dailyTotalsFor({ userIds: ['u1', 'u2'], type: 'WEEKLY_WORKOUTS', from, to });
    expect(Object.fromEntries(totals)).toEqual({ '2026-10-01': 2, '2026-10-02': 1 });
    expect(prismaMock.workout.findMany.mock.calls[0]![0].where).toEqual({
      userId: { in: ['u1', 'u2'] },
      startedAt: { gte: new Date('2026-10-01T00:00:00Z'), lt: new Date('2026-10-04T00:00:00Z') },
    });
  });
});
