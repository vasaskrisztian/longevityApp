import { countDistinctWorkouts } from '@/modules/wearable/domain/workout-count';
import { prisma } from '@/lib/db/prisma';
import type { Challenge } from '@prisma/client';
import type { CreateChallengeInput, UpdateChallengeInput } from '@/lib/validation/challenge.schemas';

/**
 * Ownership (IDOR/BOLA) checks, and the "a challenge's terms are read-only
 * once activated" rule, happen in the Route Handler — see
 * src/app/api/challenges/[id]/route.ts — BEFORE any of the by-id functions
 * below are called. These functions assume the caller has already verified
 * the right to act on `id` and (for update) that the challenge is still a
 * draft.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export type ChallengeStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'FAILED';

export interface ChallengeProgress {
  status: ChallengeStatus;
  /** How many qualifying periods (nights/days/weeks) have been reached so far. 0 while DRAFT. */
  currentCount: number;
  requiredCount: number;
  /** Whole days left before expiry — null while DRAFT (not started) or once resolved (COMPLETED/FAILED). */
  daysRemaining: number | null;
}

export type ChallengeWithProgress = Challenge & { progress: ChallengeProgress };

/**
 * Counts how many individual days in [from, to] (both inclusive, UTC) have
 * `column`'s DailyHealthMetric value strictly above `threshold` — the
 * SLEEP_SCORE / DAILY_STEPS challenge types' qualifying-period count.
 */
async function countQualifyingDays(
  userId: string,
  column: 'sleepScore' | 'steps',
  from: Date,
  to: Date,
  threshold: number,
): Promise<number> {
  return prisma.dailyHealthMetric.count({
    where: {
      userId,
      date: { gte: utcMidnight(from), lte: utcMidnight(to) },
      [column]: { gt: threshold },
    },
  });
}

/**
 * Counts how many consecutive 7-day chunks starting at `from` (the last one
 * clipped to `to`) had more than `threshold` workouts — the
 * WEEKLY_WORKOUTS challenge type's qualifying-period count. A chunk already
 * qualifies as soon as its count exceeds the threshold, even before the
 * chunk's 7 days are up — the user only needs to hit the count.
 */
async function countQualifyingWeeks(
  userId: string,
  from: Date,
  to: Date,
  threshold: number,
): Promise<number> {
  const windowStart = utcMidnight(from);
  const windowEndExclusive = new Date(utcMidnight(to).getTime() + DAY_MS);

  const chunks: { start: Date; end: Date }[] = [];
  let cursor = windowStart;
  while (cursor.getTime() < windowEndExclusive.getTime()) {
    const end = new Date(Math.min(cursor.getTime() + 7 * DAY_MS, windowEndExclusive.getTime()));
    chunks.push({ start: cursor, end });
    cursor = end;
  }

  const counts = await Promise.all(
    chunks.map((chunk) =>
      prisma.workout
        .findMany({
          where: { userId, startedAt: { gte: chunk.start, lt: chunk.end } },
          select: { startedAt: true, endedAt: true, durationMin: true, activityType: true, source: true },
        })
        .then(countDistinctWorkouts),
    ),
  );
  return counts.filter((count: number) => count > threshold).length;
}

async function countQualifyingPeriods(challenge: Challenge, from: Date, to: Date): Promise<number> {
  switch (challenge.type) {
    case 'SLEEP_SCORE':
      return countQualifyingDays(challenge.userId, 'sleepScore', from, to, challenge.threshold);
    case 'DAILY_STEPS':
      return countQualifyingDays(challenge.userId, 'steps', from, to, challenge.threshold);
    case 'WEEKLY_WORKOUTS':
      return countQualifyingWeeks(challenge.userId, from, to, challenge.threshold);
    default:
      // Exhaustiveness guard — a new ChallengeType added to the enum without
      // a case here would otherwise silently return 0 forever.
      throw new Error(`Unhandled challenge type: ${challenge.type as string}`);
  }
}

/** DRAFT/ACTIVE/COMPLETED/FAILED and the current qualifying-period count are
 * always computed on read, never stored — see the Challenge model's doc
 * comment for why. */
export async function computeProgress(challenge: Challenge): Promise<ChallengeProgress> {
  if (!challenge.activatedAt || !challenge.expiresAt) {
    return { status: 'DRAFT', currentCount: 0, requiredCount: challenge.requiredCount, daysRemaining: null };
  }

  const now = new Date();
  const windowEnd = now.getTime() < challenge.expiresAt.getTime() ? now : challenge.expiresAt;
  const currentCount = await countQualifyingPeriods(challenge, challenge.activatedAt, windowEnd);

  if (currentCount >= challenge.requiredCount) {
    return { status: 'COMPLETED', currentCount, requiredCount: challenge.requiredCount, daysRemaining: null };
  }
  if (now.getTime() >= challenge.expiresAt.getTime()) {
    return { status: 'FAILED', currentCount, requiredCount: challenge.requiredCount, daysRemaining: null };
  }
  const daysRemaining = Math.ceil((challenge.expiresAt.getTime() - now.getTime()) / DAY_MS);
  return { status: 'ACTIVE', currentCount, requiredCount: challenge.requiredCount, daysRemaining };
}

async function withProgress(challenge: Challenge): Promise<ChallengeWithProgress> {
  return { ...challenge, progress: await computeProgress(challenge) };
}

export async function listChallenges(userId: string): Promise<ChallengeWithProgress[]> {
  const challenges = await prisma.challenge.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  return Promise.all(challenges.map(withProgress));
}

export async function getChallengeById(id: string): Promise<ChallengeWithProgress | null> {
  const challenge = await prisma.challenge.findUnique({ where: { id } });
  if (!challenge) return null;
  return withProgress(challenge);
}

/** Created as a draft — `activatedAt`/`expiresAt` stay null until
 * activateChallenge runs. Returns progress (always DRAFT here) rather than
 * a bare Challenge — every Challenge the client renders shows a status
 * badge, so every by-id/create/update function returns the same shape. */
export async function createChallenge(
  userId: string,
  input: CreateChallengeInput,
): Promise<ChallengeWithProgress> {
  const challenge = await prisma.challenge.create({ data: { userId, ...input } });
  return withProgress(challenge);
}

/** Only ever called on a still-draft challenge — see the [id] route. */
export async function updateChallenge(
  id: string,
  input: UpdateChallengeInput,
): Promise<ChallengeWithProgress> {
  const challenge = await prisma.challenge.update({ where: { id }, data: input });
  return withProgress(challenge);
}

/** Starts the clock: sets activatedAt to now and expiresAt to `windowDays`
 * days out. `windowDays` is passed in (not re-fetched) because the [id]
 * route already loaded the challenge to check ownership and draft status. */
export async function activateChallenge(id: string, windowDays: number): Promise<ChallengeWithProgress> {
  const activatedAt = new Date();
  const expiresAt = new Date(activatedAt.getTime() + windowDays * DAY_MS);
  const challenge = await prisma.challenge.update({ where: { id }, data: { activatedAt, expiresAt } });
  return withProgress(challenge);
}

export async function deleteChallenge(id: string): Promise<void> {
  await prisma.challenge.delete({ where: { id } });
}
