import { describe, it, expect, vi, beforeEach } from 'vitest';

const upsertJobScheduler = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/queue/queues', () => ({
  getQueue: vi.fn(() => ({ upsertJobScheduler })),
  GROUP_CHALLENGE_FINALIZE_QUEUE_NAME: 'group-challenge-finalize',
}));
vi.mock('@/lib/queue/connection', () => ({ getRedisConnection: vi.fn(() => ({})) }));
const finalizeEndedGroupChallenges = vi.fn().mockResolvedValue({ finalized: 0 });
const notifyReachedCollectiveGoals = vi.fn().mockResolvedValue({ announced: 2 });
vi.mock('@/modules/groups/group-challenges.service', () => ({ finalizeEndedGroupChallenges, notifyReachedCollectiveGoals }));

const workerCtor = vi.fn();
vi.mock('bullmq', () => ({
  Worker: class {
    constructor(name: string, processor: () => unknown, options: unknown) {
      workerCtor(name, processor, options);
    }
  },
}));

const { scheduleGroupChallengeFinalize, startGroupChallengeFinalizeWorker } = await import(
  '@/jobs/group-challenge-finalize.job'
);

beforeEach(() => vi.clearAllMocks());

describe('group challenge finalize job', () => {
  it('registers one hourly repeatable scheduler (idempotent upsert, minute 5)', async () => {
    await scheduleGroupChallengeFinalize();
    expect(upsertJobScheduler).toHaveBeenCalledWith('group-challenge-finalize', { pattern: '5 * * * *' }, { name: 'finalize' });
  });

  it('the worker announces reached team goals, then runs the idempotent finalize, on the dedicated queue', async () => {
    startGroupChallengeFinalizeWorker();
    const [name, processor] = workerCtor.mock.calls[0]!;
    expect(name).toBe('group-challenge-finalize');
    expect(await processor()).toEqual({ finalized: 0, goalsAnnounced: 2 });
    expect(notifyReachedCollectiveGoals).toHaveBeenCalledTimes(1);
    expect(finalizeEndedGroupChallenges).toHaveBeenCalledTimes(1);
  });
});
