import { prisma } from '@/lib/db/prisma';
import type { Challenge, Protocol, ProtocolSupplement } from '@prisma/client';
import { computeProgress, type ChallengeWithProgress } from '@/modules/challenges/challenges.service';

/**
 * Phase 13 (Creators & Followers) — ARCHITECTURE.md §4.2's private-by-default
 * model gets its first deliberate exception here. Two independent gates
 * decide whether ANYTHING about a user is ever visible to anyone but
 * themself (or an admin):
 *
 *   1. User.accountType === 'CREATOR' — admin-granted only (see
 *      admin.service.ts's setUserAccountType). A plain MEMBER can never be
 *      looked up by id through this module's public* functions.
 *   2. User.publicProfileConsentAt is set — the creator's own explicit,
 *      separate opt-in (src/app/api/creators/me/consent/route.ts), distinct
 *      from the registration-time termsAcceptedAt/privacyAcceptedAt.
 *
 * Both are re-checked on every public-profile read (canPublishPublicly,
 * getCreatorPublicProfile, listPublicCreators, followCreator) — never
 * cached or assumed from an earlier check, so a revoked consent or an
 * admin demotion takes effect on the very next request, not just on new
 * writes. Individual Protocol/Challenge rows have their own `visibility`
 * column on top of this — a creator still chooses which of their own
 * protocols/challenges to publish; going CREATOR + consenting does not
 * retroactively publish anything.
 *
 * Followers are anonymous to each other AND to the creator by product
 * decision — nothing below ever selects Follow.followerId for a
 * creator-facing read, only Follow.count().
 */

const PUBLIC_METRICS_DAYS = 90;

export class NotACreatorError extends Error {}
export class CreatorNotFollowableError extends Error {}

/** True only when both gates above hold. Used by the Route Handlers that
 * guard Protocol/Challenge `visibility: 'PUBLIC'` writes, and by
 * followCreator below. */
export async function canPublishPublicly(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountType: true, publicProfileConsentAt: true },
  });
  return Boolean(user && user.accountType === 'CREATOR' && user.publicProfileConsentAt);
}

export interface PublicProfileStatus {
  accountType: 'MEMBER' | 'CREATOR' | 'ADMIN';
  canPublish: boolean;
}

/**
 * Phase 20 (mobile): the web app's profile/page.tsx is a server component
 * that queries `accountType`/`publicProfileConsentAt` directly to decide
 * whether to render the CreatorConsentToggle section at all (only ever
 * shown to an admin-granted CREATOR) and what its initial state is. Mobile
 * has no server component to do that inline, so this bundles the same two
 * facts into one mobile-reachable read: `accountType` decides whether the
 * consent toggle is shown; `canPublish` (the same gate every Protocol/
 * Challenge Publish button already checks server-side) is its current
 * value. Both are re-derived live here, same as canPublishPublicly above —
 * never cached.
 */
export async function getPublicProfileStatus(userId: string): Promise<PublicProfileStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountType: true, publicProfileConsentAt: true },
  });
  return {
    accountType: (user?.accountType ?? 'MEMBER') as PublicProfileStatus['accountType'],
    canPublish: Boolean(user && user.accountType === 'CREATOR' && user.publicProfileConsentAt),
  };
}

/** The CREATOR's own opt-in — see this module's doc comment. Throws
 * NotACreatorError if the account isn't CREATOR (an admin must grant that
 * first); the route maps this to 403. */
export async function setPublicProfileConsent(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { accountType: true } });
  if (!user || user.accountType !== 'CREATOR') {
    throw new NotACreatorError('Only CREATOR accounts can enable a public profile');
  }
  await prisma.user.update({ where: { id: userId }, data: { publicProfileConsentAt: new Date() } });
}

/** Revoking consent takes the creator's content down immediately — clears
 * publicProfileConsentAt AND flips every one of their Protocol/Challenge
 * rows back to PRIVATE, in one transaction, rather than leaving
 * already-PUBLIC rows reachable by a stale direct link. */
export async function revokePublicProfileConsent(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { publicProfileConsentAt: null } }),
    prisma.protocol.updateMany({ where: { userId }, data: { visibility: 'PRIVATE' } }),
    prisma.challenge.updateMany({ where: { userId }, data: { visibility: 'PRIVATE' } }),
  ]);
}

export interface PublicMetricPoint {
  date: Date;
  sleepScore: number | null;
  steps: number | null;
  restingHeartRate: number | null;
  averageHrv: number | null;
  activeCalories: number | null;
}

export type PublicProtocol = Protocol & { supplements: ProtocolSupplement[] };

export interface CreatorPublicProfile {
  id: string;
  fullName: string | null;
  memberSince: Date;
  followerCount: number;
  protocols: PublicProtocol[];
  challenges: ChallengeWithProgress[];
  /** Last PUBLIC_METRICS_DAYS days only — a creator's whole multi-year
   * health history is deliberately not dumped onto a public page, even
   * once they've consented to a public profile. */
  recentMetrics: PublicMetricPoint[];
}

/** Returns null — not a 403 — for a user that doesn't exist, isn't a
 * CREATOR, or hasn't consented, so a probing caller can't distinguish
 * "no such user" from "exists but private" (same 404-not-403 shape as
 * admin.service.ts's getUserDetailForAdmin). */
export async function getCreatorPublicProfile(userId: string): Promise<CreatorPublicProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      accountType: true,
      publicProfileConsentAt: true,
      createdAt: true,
      profile: { select: { fullName: true } },
    },
  });
  if (!user || user.accountType !== 'CREATOR' || !user.publicProfileConsentAt) {
    return null;
  }

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - PUBLIC_METRICS_DAYS);

  const [followerCount, protocols, challenges, metrics] = await Promise.all([
    prisma.follow.count({ where: { creatorId: userId } }),
    prisma.protocol.findMany({
      where: { userId, visibility: 'PUBLIC' },
      include: { supplements: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.challenge.findMany({
      where: { userId, visibility: 'PUBLIC' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.dailyHealthMetric.findMany({
      where: { userId, date: { gte: since } },
      orderBy: { date: 'desc' },
      select: {
        date: true,
        sleepScore: true,
        steps: true,
        restingHeartRate: true,
        averageHrv: true,
        activeCalories: true,
      },
    }),
  ]);

  const challengesWithProgress = await Promise.all(
    challenges.map(async (challenge: Challenge) => ({
      ...challenge,
      progress: await computeProgress(challenge),
    })),
  );

  return {
    id: user.id,
    fullName: user.profile?.fullName ?? null,
    memberSince: user.createdAt,
    followerCount,
    protocols,
    challenges: challengesWithProgress,
    // averageHrv is a Prisma `Decimal` column (schema.prisma) — the real
    // generated client returns a Decimal.js instance, not a plain number,
    // so it must be converted explicitly (same read-site conversion
    // dashboard.service.ts's toDailyMetricFields and inbody.service.ts's
    // toDecimalOrNull already apply; the local stubbed client didn't model
    // this distinction, which is why this only surfaced in Railway's build).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recentMetrics: metrics.map((m: any) => ({
      date: m.date,
      sleepScore: m.sleepScore,
      steps: m.steps,
      restingHeartRate: m.restingHeartRate,
      averageHrv: m.averageHrv === null || m.averageHrv === undefined ? null : Number(m.averageHrv),
      activeCalories: m.activeCalories,
    })),
  };
}

export interface CreatorDirectoryItem {
  id: string;
  fullName: string | null;
  memberSince: Date;
  followerCount: number;
  publicProtocolCount: number;
  publicChallengeCount: number;
}

/**
 * The public, unauthenticated `/creators` directory. Deliberately N+1
 * queries (count per creator) rather than a filtered relation `_count` —
 * this list is expected to stay small (a handful of named creators), and
 * groupBy/filtered-_count edge cases aren't worth the risk given this
 * codebase's known Prisma-stub-vs-real-client type gap (see
 * docs/phase-1-summary.md) — simple per-row counts behave identically
 * under every Prisma version.
 */
export async function listPublicCreators(): Promise<CreatorDirectoryItem[]> {
  const creators = await prisma.user.findMany({
    where: { accountType: 'CREATOR', publicProfileConsentAt: { not: null } },
    select: { id: true, createdAt: true, profile: { select: { fullName: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return Promise.all(
    creators.map(async (creator: { id: string; createdAt: Date; profile: { fullName: string } | null }) => {
      const [followerCount, publicProtocolCount, publicChallengeCount] = await Promise.all([
        prisma.follow.count({ where: { creatorId: creator.id } }),
        prisma.protocol.count({ where: { userId: creator.id, visibility: 'PUBLIC' } }),
        prisma.challenge.count({ where: { userId: creator.id, visibility: 'PUBLIC' } }),
      ]);
      return {
        id: creator.id,
        fullName: creator.profile?.fullName ?? null,
        memberSince: creator.createdAt,
        followerCount,
        publicProtocolCount,
        publicChallengeCount,
      };
    }),
  );
}

/** Follows are idempotent: following an already-followed creator succeeds
 * silently rather than erroring (a double-click on the UI's Follow button
 * must never surface a 500/409). */
export async function followCreator(followerId: string, creatorId: string): Promise<void> {
  if (followerId === creatorId) {
    throw new CreatorNotFollowableError('Cannot follow yourself');
  }
  const eligible = await canPublishPublicly(creatorId);
  if (!eligible) {
    throw new CreatorNotFollowableError('This account is not a public creator');
  }
  try {
    await prisma.follow.create({ data: { followerId, creatorId } });
  } catch (error) {
    // P2002: unique constraint on (followerId, creatorId) — already
    // following; treated as success, not an error.
    if ((error as { code?: string } | null)?.code !== 'P2002') {
      throw error;
    }
  }
}

/** No-op (not a 404) if the caller wasn't following this creator — an
 * unfollow is idempotent the same way a follow is. */
export async function unfollowCreator(followerId: string, creatorId: string): Promise<void> {
  await prisma.follow.deleteMany({ where: { followerId, creatorId } });
}

export async function isFollowing(followerId: string, creatorId: string): Promise<boolean> {
  const row = await prisma.follow.findUnique({
    where: { followerId_creatorId: { followerId, creatorId } },
  });
  return Boolean(row);
}

export async function getFollowerCount(creatorId: string): Promise<number> {
  return prisma.follow.count({ where: { creatorId } });
}

export interface FollowedCreatorSummary {
  id: string;
  fullName: string | null;
  followedAt: Date;
  publicProtocolCount: number;
  publicChallengeCount: number;
}

/** Feeds src/app/profile/discover/page.tsx's "You follow" list. */
export async function listMyFollowing(followerId: string): Promise<FollowedCreatorSummary[]> {
  const rows = await prisma.follow.findMany({
    where: { followerId },
    orderBy: { createdAt: 'desc' },
    include: { creator: { select: { id: true, profile: { select: { fullName: true } } } } },
  });

  return Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows.map(async (row: any) => {
      const [publicProtocolCount, publicChallengeCount] = await Promise.all([
        prisma.protocol.count({ where: { userId: row.creatorId, visibility: 'PUBLIC' } }),
        prisma.challenge.count({ where: { userId: row.creatorId, visibility: 'PUBLIC' } }),
      ]);
      return {
        id: row.creator.id,
        fullName: row.creator.profile?.fullName ?? null,
        followedAt: row.createdAt,
        publicProtocolCount,
        publicChallengeCount,
      };
    }),
  );
}
