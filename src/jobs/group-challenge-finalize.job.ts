import { Worker } from 'bullmq';
import { getRedisConnection } from '@/lib/queue/connection';
import { getQueue, GROUP_CHALLENGE_FINALIZE_QUEUE_NAME } from '@/lib/queue/queues';
import { finalizeEndedGroupChallenges, notifyReachedCollectiveGoals } from '@/modules/groups/group-challenges.service';

/**
 * Corporate wellbeing: sends the "team goal reached" notifications and the
 * end-of-challenge summaries. Runs hourly; the work itself is idempotent (each challenge is claimed via
 * `summarySentAt`), and the challenge endpoints also call it lazily, so a
 * stopped worker only delays — never loses or duplicates — a summary.
 */
const FINALIZE_CRON = '5 * * * *';
const FINALIZE_SCHEDULER_ID = 'group-challenge-finalize';

export async function scheduleGroupChallengeFinalize(): Promise<void> {
  const queue = getQueue(GROUP_CHALLENGE_FINALIZE_QUEUE_NAME);
  await queue.upsertJobScheduler(FINALIZE_SCHEDULER_ID, { pattern: FINALIZE_CRON }, { name: 'finalize' });
}

/** Each hourly run: announce reached team goals, then summarise the challenges that have ended. */
export async function runGroupChallengeChecks(): Promise<{ finalized: number; goalsAnnounced: number }> {
  const { announced } = await notifyReachedCollectiveGoals();
  const { finalized } = await finalizeEndedGroupChallenges();
  return { finalized, goalsAnnounced: announced };
}

export function startGroupChallengeFinalizeWorker(): Worker {
  return new Worker(GROUP_CHALLENGE_FINALIZE_QUEUE_NAME, runGroupChallengeChecks, {
    connection: getRedisConnection(),
  });
}
