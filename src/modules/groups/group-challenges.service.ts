import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logging/logger';
import { recordAuditLog } from '@/lib/audit/audit-log.service';
import { countQualifyingPeriodsFor, dailyTotalsFor, sumMetricFor } from '@/modules/challenges/challenges.service';
import { createNotification, createNotificationsForUsers } from '@/modules/notifications/notifications.service';
import { listMemberIds } from './groups.service';
import {
  buildCollectiveSeries,
  goalReachedNotification,
  collectiveCreatorSummaryNotification,
  collectiveParticipantSummaryNotification,
  collectiveProgress,
  creatorSummaryNotification,
  describeChallengeTarget,
  describeCollectiveTarget,
  groupChallengeStatus,
  memberProgress,
  newChallengeNotification,
  participantSummaryNotification,
  summarizeCollective,
  summarizeTeam,
  type CollectiveProgress,
  type CollectiveSeries,
  type GroupChallengeMode,
  type GroupChallengeStatus,
  type GroupChallengeType,
  type MemberProgress,
  type TeamSummary,
} from './group-progress';
import type { CreateGroupChallengeInput as ParsedGroupChallengeInput } from '@/lib/validation/group.schemas';

/** The parsed request body; `mode` and `targetTotal` may be left out (= INDIVIDUAL, no team total). */
type CreateGroupChallengeInput = Omit<ParsedGroupChallengeInput, 'mode' | 'targetTotal' | 'description'> &
  Partial<Pick<ParsedGroupChallengeInput, 'mode' | 'targetTotal' | 'description'>>;

/* eslint-disable @typescript-eslint/no-explicit-any */

const DAY_MS = 24 * 60 * 60 * 1000;

export class GroupChallengeError extends Error {
  constructor(
    public readonly code: 'not_member' | 'not_found' | 'ended' | 'invalid_dates',
    message: string,
  ) {
    super(message);
    this.name = 'GroupChallengeError';
  }
}

export interface GroupChallengeDTO {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  type: GroupChallengeType;
  threshold: number;
  requiredCount: number;
  /** INDIVIDUAL: every participant has their own goal. COLLECTIVE: one shared team total. */
  mode: GroupChallengeMode;
  /** The team total to reach (steps or workouts) — COLLECTIVE only, else null. */
  targetTotal: number | null;
  /** First and last day, both inclusive (`yyyy-mm-dd`, UTC). */
  startDate: string;
  endDate: string;
  status: GroupChallengeStatus;
  /** "5 nights with a sleep score above 80". */
  target: string;
  /** Whole days left (ACTIVE only), else null. */
  daysRemaining: number | null;
}

/** A COLLECTIVE challenge always carries its `targetTotal`; rows from before the mode existed have neither. */
export function isCollectiveChallenge(row: { mode?: string; targetTotal?: number | null }): boolean {
  return row.mode === 'COLLECTIVE' && typeof row.targetTotal === 'number' && row.targetTotal > 0;
}

export function toChallengeDTO(row: any, now: Date = new Date()): GroupChallengeDTO {
  const status = groupChallengeStatus(row, now);
  const collective = isCollectiveChallenge(row);
  return {
    id: row.id,
    groupId: row.groupId,
    name: row.name,
    description: row.description ?? null,
    type: row.type,
    threshold: row.threshold,
    requiredCount: row.requiredCount,
    mode: collective ? 'COLLECTIVE' : 'INDIVIDUAL',
    targetTotal: collective ? row.targetTotal : null,
    startDate: row.startsAt.toISOString().slice(0, 10),
    endDate: new Date(row.endsAt.getTime() - DAY_MS).toISOString().slice(0, 10),
    status,
    target: collective
      ? describeCollectiveTarget(row.type, row.targetTotal)
      : describeChallengeTarget(row.type, row.threshold, row.requiredCount),
    daysRemaining: status === 'ACTIVE' ? Math.max(1, Math.ceil((row.endsAt.getTime() - now.getTime()) / DAY_MS)) : null,
  };
}

/** Counting window for a challenge: [startsAt, min(now, last moment)], or null before the start. */
function countingWindow(challenge: { startsAt: Date; endsAt: Date }, now: Date): { from: Date; to: Date } | null {
  if (now.getTime() < challenge.startsAt.getTime()) return null;
  const lastMoment = new Date(challenge.endsAt.getTime() - 1);
  return { from: challenge.startsAt, to: now.getTime() < lastMoment.getTime() ? now : lastMoment };
}

/**
 * One person's result: the qualifying-period count towards their own goal
 * (INDIVIDUAL), or their contribution to the shared total, shown against the
 * team target (COLLECTIVE). 0 before the start.
 */
export async function computeParticipantProgress(
  challenge: {
    type: GroupChallengeType;
    threshold: number;
    requiredCount: number;
    mode?: GroupChallengeMode;
    targetTotal?: number | null;
    startsAt: Date;
    endsAt: Date;
  },
  userId: string,
  now: Date = new Date(),
): Promise<MemberProgress> {
  const window = countingWindow(challenge, now);
  if (isCollectiveChallenge(challenge)) {
    const target = challenge.targetTotal as number;
    if (!window) return memberProgress(0, target);
    const contribution = await sumMetricFor({
      userId,
      type: challenge.type as 'DAILY_STEPS' | 'WEEKLY_WORKOUTS',
      from: window.from,
      to: window.to,
    });
    return memberProgress(contribution, target);
  }
  if (!window) return memberProgress(0, challenge.requiredCount);
  const count = await countQualifyingPeriodsFor({
    userId,
    type: challenge.type,
    threshold: challenge.threshold,
    from: window.from,
    to: window.to,
  });
  return memberProgress(count, challenge.requiredCount);
}

function parseDay(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function createGroupChallenge(
  adminId: string,
  groupId: string,
  input: CreateGroupChallengeInput,
  now: Date = new Date(),
): Promise<GroupChallengeDTO | null> {
  const group: any = await prisma.wellbeingGroup.findUnique({ where: { id: groupId }, select: { id: true, name: true } });
  if (!group) return null;

  const startsAt = parseDay(input.startDate);
  const endsAt = new Date(parseDay(input.endDate).getTime() + DAY_MS); // end date is inclusive
  if (endsAt.getTime() <= now.getTime()) {
    throw new GroupChallengeError('invalid_dates', 'The challenge cannot end in the past');
  }

  const row: any = await prisma.groupChallenge.create({
    data: {
      groupId,
      createdById: adminId,
      name: input.name,
      description: input.description || null,
      type: input.type,
      threshold: input.threshold,
      requiredCount: input.requiredCount,
      mode: input.mode ?? 'INDIVIDUAL',
      targetTotal: input.targetTotal ?? null,
      startsAt,
      endsAt,
    },
  });

  const memberIds = await listMemberIds(groupId);
  const message = newChallengeNotification({
    groupName: group.name,
    name: row.name,
    type: row.type,
    threshold: row.threshold,
    requiredCount: row.requiredCount,
    mode: row.mode,
    targetTotal: row.targetTotal,
    startsAt,
    endsAt: new Date(endsAt.getTime() - DAY_MS),
  });
  await createNotificationsForUsers(memberIds, {
    type: 'GROUP_CHALLENGE_NEW',
    ...message,
    data: { groupId, challengeId: row.id },
  });

  await recordAuditLog({
    actorUserId: adminId,
    targetUserId: null,
    action: 'ADMIN_GROUP_CHALLENGE_CREATE',
    entityType: 'GroupChallenge',
    entityId: row.id,
  });
  return toChallengeDTO(row, now);
}

export async function deleteGroupChallenge(adminId: string, groupId: string, challengeId: string): Promise<boolean> {
  const row: any = await prisma.groupChallenge.findUnique({ where: { id: challengeId }, select: { id: true, groupId: true } });
  if (!row || row.groupId !== groupId) return false;
  await prisma.groupChallenge.delete({ where: { id: challengeId } });
  await recordAuditLog({
    actorUserId: adminId,
    targetUserId: null,
    action: 'ADMIN_GROUP_CHALLENGE_DELETE',
    entityType: 'GroupChallenge',
    entityId: challengeId,
  });
  return true;
}

interface TeamProgress {
  /** One entry per participant, in `participantIds` order. */
  progresses: MemberProgress[];
  /** The shared total — COLLECTIVE challenges only, else null. */
  collective: CollectiveProgress | null;
  team: TeamSummary;
}

async function teamProgress(challenge: any, participantIds: string[], memberCount: number, now: Date): Promise<TeamProgress> {
  const progresses = await Promise.all(participantIds.map((userId) => computeParticipantProgress(challenge, userId, now)));
  if (!isCollectiveChallenge(challenge)) {
    return { progresses, collective: null, team: summarizeTeam(progresses, memberCount) };
  }
  const total = progresses.reduce((sum, p) => sum + p.currentCount, 0);
  const collective = collectiveProgress(total, challenge.targetTotal);
  return { progresses, collective, team: summarizeCollective(collective, participantIds.length, memberCount) };
}

/**
 * The team's running total per day, for the chart — COLLECTIVE challenges
 * only. Aggregate numbers only (nothing per person), so members may see it.
 */
async function collectiveSeriesFor(challenge: any, participantIds: string[], now: Date): Promise<CollectiveSeries | null> {
  if (!isCollectiveChallenge(challenge)) return null;
  const window = countingWindow(challenge, now);
  if (!window) return { targetTotal: challenge.targetTotal, points: [] };
  const amounts = await dailyTotalsFor({
    userIds: participantIds,
    type: challenge.type as 'DAILY_STEPS' | 'WEEKLY_WORKOUTS',
    from: window.from,
    to: window.to,
  });
  return buildCollectiveSeries(
    challenge.startsAt.toISOString().slice(0, 10),
    window.to.toISOString().slice(0, 10),
    amounts,
    challenge.targetTotal,
  );
}

export interface AdminGroupChallengeListItem extends GroupChallengeDTO {
  team: TeamSummary;
  /** The shared total and its progress — COLLECTIVE challenges only, else null. */
  collective: CollectiveProgress | null;
}

/** All of a group's challenges (newest first) with the team aggregate — the admin overview. */
export async function listGroupChallengesForAdmin(groupId: string, now: Date = new Date()): Promise<AdminGroupChallengeListItem[]> {
  const [challenges, memberCount]: [any[], number] = await Promise.all([
    prisma.groupChallenge.findMany({
      where: { groupId },
      orderBy: { startsAt: 'desc' },
      include: { participants: { select: { userId: true } } },
    }),
    prisma.groupMembership.count({ where: { groupId } }),
  ]);
  return Promise.all(
    challenges.map(async (challenge) => {
      const { team, collective } = await teamProgress(
        challenge,
        challenge.participants.map((p: any) => p.userId),
        memberCount,
        now,
      );
      return { ...toChallengeDTO(challenge, now), team, collective };
    }),
  );
}

export interface AdminParticipantRow {
  userId: string;
  email: string;
  fullName: string | null;
  progress: MemberProgress;
}

export interface AdminGroupChallengeDetail {
  challenge: GroupChallengeDTO;
  team: TeamSummary;
  /** The shared total and its progress — COLLECTIVE challenges only, else null. */
  collective: CollectiveProgress | null;
  /** The team's running total per day (the chart) — COLLECTIVE only, else null. */
  series: CollectiveSeries | null;
  /** Who joined and how far each person is — best first. */
  participants: AdminParticipantRow[];
  /** Group members who have not joined this challenge. */
  notJoined: { userId: string; email: string; fullName: string | null }[];
}

export async function getGroupChallengeDetailForAdmin(
  groupId: string,
  challengeId: string,
  now: Date = new Date(),
): Promise<AdminGroupChallengeDetail | null> {
  const challenge: any = await prisma.groupChallenge.findUnique({
    where: { id: challengeId },
    include: {
      participants: {
        select: { user: { select: { id: true, email: true, profile: { select: { fullName: true } } } } },
      },
    },
  });
  if (!challenge || challenge.groupId !== groupId) return null;

  const memberships: any[] = await prisma.groupMembership.findMany({
    where: { groupId },
    select: { user: { select: { id: true, email: true, profile: { select: { fullName: true } } } } },
  });

  const participantUsers: any[] = challenge.participants.map((p: any) => p.user);
  const { progresses, collective, team } = await teamProgress(
    challenge,
    participantUsers.map((user) => user.id),
    memberships.length,
    now,
  );
  const series = await collectiveSeriesFor(
    challenge,
    participantUsers.map((user) => user.id),
    now,
  );
  const participants: AdminParticipantRow[] = participantUsers
    .map((user, index) => ({
      userId: user.id,
      email: user.email,
      fullName: user.profile?.fullName ?? null,
      progress: progresses[index] as MemberProgress,
    }))
    .sort((a, b) => b.progress.currentCount - a.progress.currentCount || a.email.localeCompare(b.email));

  const joined = new Set(participantUsers.map((user) => user.id));
  const notJoined = memberships
    .map((membership) => membership.user)
    .filter((user) => !joined.has(user.id))
    .map((user) => ({ userId: user.id, email: user.email, fullName: user.profile?.fullName ?? null }));

  return {
    challenge: toChallengeDTO(challenge, now),
    team,
    collective,
    series,
    participants,
    notJoined,
  };
}

export interface MyGroupChallengeDTO extends GroupChallengeDTO {
  joined: boolean;
  /** The caller's own progress — null until they join. COLLECTIVE: their contribution, against the team target. */
  me: MemberProgress | null;
  /** The shared total and its progress — COLLECTIVE challenges only, else null. No other person's data. */
  collective: CollectiveProgress | null;
  /** The team's running total per day (the chart) — COLLECTIVE only; aggregate numbers, nothing per person. */
  series: CollectiveSeries | null;
  /** Aggregate only: how many joined, how many reached the goal, mean progress. No other person's data. */
  team: TeamSummary;
}

async function requireMembership(groupId: string, userId: string) {
  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!membership) throw new GroupChallengeError('not_member', 'You are not a member of this group');
}

/** A member's view of their group's challenges: own status + team aggregate. */
export async function listMyGroupChallenges(
  userId: string,
  groupId: string,
  now: Date = new Date(),
): Promise<MyGroupChallengeDTO[]> {
  await requireMembership(groupId, userId);
  const [challenges, memberCount]: [any[], number] = await Promise.all([
    prisma.groupChallenge.findMany({
      where: { groupId },
      orderBy: { startsAt: 'desc' },
      include: { participants: { select: { userId: true } } },
    }),
    prisma.groupMembership.count({ where: { groupId } }),
  ]);

  return Promise.all(
    challenges.map(async (challenge) => {
      const participantIds: string[] = challenge.participants.map((p: any) => p.userId);
      const { progresses, collective, team } = await teamProgress(challenge, participantIds, memberCount, now);
      const series = await collectiveSeriesFor(challenge, participantIds, now);
      const myIndex = participantIds.indexOf(userId);
      return {
        ...toChallengeDTO(challenge, now),
        joined: myIndex >= 0,
        me: myIndex >= 0 ? (progresses[myIndex] as MemberProgress) : null,
        collective,
        series,
        team,
      };
    }),
  );
}

export async function joinGroupChallenge(userId: string, groupId: string, challengeId: string, now: Date = new Date()) {
  await requireMembership(groupId, userId);
  const challenge: any = await prisma.groupChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.groupId !== groupId) throw new GroupChallengeError('not_found', 'Challenge not found');
  if (groupChallengeStatus(challenge, now) === 'ENDED') throw new GroupChallengeError('ended', 'This challenge has already ended');
  await prisma.groupChallengeParticipant.upsert({
    where: { challengeId_userId: { challengeId, userId } },
    create: { challengeId, userId },
    update: {},
  });
}

export async function leaveGroupChallenge(userId: string, groupId: string, challengeId: string, now: Date = new Date()) {
  await requireMembership(groupId, userId);
  const challenge: any = await prisma.groupChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.groupId !== groupId) throw new GroupChallengeError('not_found', 'Challenge not found');
  // Dropping out after the end would rewrite a finished result.
  if (groupChallengeStatus(challenge, now) === 'ENDED') throw new GroupChallengeError('ended', 'This challenge has already ended');
  await prisma.groupChallengeParticipant.deleteMany({ where: { challengeId, userId } });
}

/**
 * Sends the end-of-challenge summaries for every group challenge that has
 * ended and not been summarised yet. Safe to call from anywhere, any number
 * of times, concurrently: each challenge is claimed with a conditional
 * `summarySentAt` update first, so exactly one caller sends its
 * notifications. (Called hourly by the worker and lazily from the
 * challenge/notification endpoints, so a summary still goes out if the
 * worker is down.) A failure after the claim is logged and not retried —
 * a missed summary is preferable to a duplicate one.
 */
export async function finalizeEndedGroupChallenges(now: Date = new Date()): Promise<{ finalized: number }> {
  const due: any[] = await prisma.groupChallenge.findMany({
    where: { endsAt: { lte: now }, summarySentAt: null },
    include: { group: { select: { name: true } }, participants: { select: { userId: true } } },
  });

  let finalized = 0;
  for (const challenge of due) {
    const claim = await prisma.groupChallenge.updateMany({
      where: { id: challenge.id, summarySentAt: null },
      data: { summarySentAt: now },
    });
    if (claim.count !== 1) continue;

    try {
      const participantIds: string[] = challenge.participants.map((p: any) => p.userId);
      const memberCount = await prisma.groupMembership.count({ where: { groupId: challenge.groupId } });
      const { progresses, collective, team } = await teamProgress(challenge, participantIds, memberCount, now);
      const data = { groupId: challenge.groupId, challengeId: challenge.id };

      if (collective) {
        await Promise.all(
          participantIds.map((userId, index) =>
            createNotification(userId, {
              type: 'GROUP_CHALLENGE_SUMMARY',
              ...collectiveParticipantSummaryNotification({
                groupName: challenge.group.name,
                name: challenge.name,
                type: challenge.type,
                collective,
                myContribution: (progresses[index] as MemberProgress).currentCount,
                participants: team.participants,
              }),
              data,
            }),
          ),
        );
        await createNotification(challenge.createdById, {
          type: 'GROUP_CHALLENGE_SUMMARY',
          ...collectiveCreatorSummaryNotification({
            groupName: challenge.group.name,
            name: challenge.name,
            type: challenge.type,
            collective,
            participants: team.participants,
            members: team.members,
          }),
          data,
        });
        finalized += 1;
        continue;
      }

      await Promise.all(
        participantIds.map((userId, index) =>
          createNotification(userId, {
            type: 'GROUP_CHALLENGE_SUMMARY',
            ...participantSummaryNotification({
              groupName: challenge.group.name,
              name: challenge.name,
              me: progresses[index] as MemberProgress,
              team,
            }),
            data,
          }),
        ),
      );
      await createNotification(challenge.createdById, {
        type: 'GROUP_CHALLENGE_SUMMARY',
        ...creatorSummaryNotification({ groupName: challenge.group.name, name: challenge.name, team }),
        data,
      });
      finalized += 1;
    } catch (error) {
      logger.error('group_challenge_finalize_failed', { message: (error as Error).message });
    }
  }
  return { finalized };
}

let lastGoalCheckAt = 0;

/**
 * Sends the "team goal reached" notifications for every ACTIVE team-total
 * challenge whose shared target has been reached and not announced yet. Like
 * the end-of-challenge summaries it is idempotent and safe to call from
 * anywhere: each challenge is claimed with a conditional `goalReachedAt`
 * update, so exactly one caller notifies. A challenge announces its goal once
 * even if the total later drops (someone leaves) — the final summary tells
 * the real result.
 *
 * `minIntervalMs` throttles the (read-heavy) check per process for the lazy
 * callers that run on frequent reads; the hourly worker passes nothing.
 */
export async function notifyReachedCollectiveGoals(
  now: Date = new Date(),
  options: { minIntervalMs?: number } = {},
): Promise<{ announced: number }> {
  if (options.minIntervalMs && now.getTime() - lastGoalCheckAt < options.minIntervalMs) return { announced: 0 };
  lastGoalCheckAt = now.getTime();

  const candidates: any[] = await prisma.groupChallenge.findMany({
    where: { mode: 'COLLECTIVE', goalReachedAt: null, startsAt: { lte: now }, endsAt: { gt: now } },
    include: { group: { select: { name: true } }, participants: { select: { userId: true } } },
  });

  let announced = 0;
  for (const challenge of candidates) {
    if (!isCollectiveChallenge(challenge) || groupChallengeStatus(challenge, now) !== 'ACTIVE') continue;
    try {
      const participantIds: string[] = challenge.participants.map((p: any) => p.userId);
      if (participantIds.length === 0) continue;
      const memberCount = await prisma.groupMembership.count({ where: { groupId: challenge.groupId } });
      const { collective } = await teamProgress(challenge, participantIds, memberCount, now);
      if (!collective || !collective.reached) continue;

      const claim = await prisma.groupChallenge.updateMany({
        where: { id: challenge.id, goalReachedAt: null },
        data: { goalReachedAt: now },
      });
      if (claim.count !== 1) continue;

      const daysRemaining = Math.max(1, Math.ceil((challenge.endsAt.getTime() - now.getTime()) / DAY_MS));
      const common = { groupName: challenge.group.name, name: challenge.name, type: challenge.type, collective, daysRemaining };
      const data = { groupId: challenge.groupId, challengeId: challenge.id };
      await createNotificationsForUsers(participantIds, {
        type: 'GROUP_CHALLENGE_GOAL_REACHED',
        ...goalReachedNotification({ ...common, audience: 'participant' }),
        data,
      });
      if (!participantIds.includes(challenge.createdById)) {
        await createNotification(challenge.createdById, {
          type: 'GROUP_CHALLENGE_GOAL_REACHED',
          ...goalReachedNotification({ ...common, audience: 'creator' }),
          data,
        });
      }
      announced += 1;
    } catch (error) {
      logger.error('group_challenge_goal_check_failed', { message: (error as Error).message });
    }
  }
  return { announced };
}

const LAZY_GOAL_CHECK_INTERVAL_MS = 5 * 60_000;

/**
 * What the read endpoints run before answering: the due end-of-challenge
 * summaries, plus the "team goal reached" check (at most every five minutes
 * per process — it sums everyone's numbers). A failure is the caller's to log;
 * the hourly worker repeats both anyway.
 */
export async function lazyGroupChallengeChecks(now: Date = new Date()): Promise<void> {
  await notifyReachedCollectiveGoals(now, { minIntervalMs: LAZY_GOAL_CHECK_INTERVAL_MS });
  await finalizeEndedGroupChallenges(now);
}
