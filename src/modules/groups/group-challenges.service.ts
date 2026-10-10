import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logging/logger';
import { recordAuditLog } from '@/lib/audit/audit-log.service';
import { countQualifyingPeriodsFor } from '@/modules/challenges/challenges.service';
import { createNotification, createNotificationsForUsers } from '@/modules/notifications/notifications.service';
import { listMemberIds } from './groups.service';
import {
  creatorSummaryNotification,
  describeChallengeTarget,
  groupChallengeStatus,
  memberProgress,
  newChallengeNotification,
  participantSummaryNotification,
  summarizeTeam,
  type GroupChallengeStatus,
  type GroupChallengeType,
  type MemberProgress,
  type TeamSummary,
} from './group-progress';
import type { CreateGroupChallengeInput } from '@/lib/validation/group.schemas';

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
  /** First and last day, both inclusive (`yyyy-mm-dd`, UTC). */
  startDate: string;
  endDate: string;
  status: GroupChallengeStatus;
  /** "5 nights with a sleep score above 80". */
  target: string;
  /** Whole days left (ACTIVE only), else null. */
  daysRemaining: number | null;
}

export function toChallengeDTO(row: any, now: Date = new Date()): GroupChallengeDTO {
  const status = groupChallengeStatus(row, now);
  return {
    id: row.id,
    groupId: row.groupId,
    name: row.name,
    description: row.description ?? null,
    type: row.type,
    threshold: row.threshold,
    requiredCount: row.requiredCount,
    startDate: row.startsAt.toISOString().slice(0, 10),
    endDate: new Date(row.endsAt.getTime() - DAY_MS).toISOString().slice(0, 10),
    status,
    target: describeChallengeTarget(row.type, row.threshold, row.requiredCount),
    daysRemaining: status === 'ACTIVE' ? Math.max(1, Math.ceil((row.endsAt.getTime() - now.getTime()) / DAY_MS)) : null,
  };
}

/** The qualifying-period count for one person, over [startsAt, min(now, last day)]. 0 before the start. */
export async function computeParticipantProgress(
  challenge: { type: GroupChallengeType; threshold: number; requiredCount: number; startsAt: Date; endsAt: Date },
  userId: string,
  now: Date = new Date(),
): Promise<MemberProgress> {
  if (now.getTime() < challenge.startsAt.getTime()) return memberProgress(0, challenge.requiredCount);
  const lastMoment = new Date(challenge.endsAt.getTime() - 1);
  const to = now.getTime() < lastMoment.getTime() ? now : lastMoment;
  const count = await countQualifyingPeriodsFor({
    userId,
    type: challenge.type,
    threshold: challenge.threshold,
    from: challenge.startsAt,
    to,
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

async function teamProgress(challenge: any, participantIds: string[], now: Date) {
  const progresses = await Promise.all(participantIds.map((userId) => computeParticipantProgress(challenge, userId, now)));
  return progresses;
}

export interface AdminGroupChallengeListItem extends GroupChallengeDTO {
  team: TeamSummary;
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
      const progresses = await teamProgress(
        challenge,
        challenge.participants.map((p: any) => p.userId),
        now,
      );
      return { ...toChallengeDTO(challenge, now), team: summarizeTeam(progresses, memberCount) };
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
  const progresses = await teamProgress(
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
    team: summarizeTeam(participants.map((p) => p.progress), memberships.length),
    participants,
    notJoined,
  };
}

export interface MyGroupChallengeDTO extends GroupChallengeDTO {
  joined: boolean;
  /** The caller's own progress — null until they join. */
  me: MemberProgress | null;
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
      const progresses = await teamProgress(challenge, participantIds, now);
      const myIndex = participantIds.indexOf(userId);
      return {
        ...toChallengeDTO(challenge, now),
        joined: myIndex >= 0,
        me: myIndex >= 0 ? (progresses[myIndex] as MemberProgress) : null,
        team: summarizeTeam(progresses, memberCount),
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
      const progresses = await teamProgress(challenge, participantIds, now);
      const memberCount = await prisma.groupMembership.count({ where: { groupId: challenge.groupId } });
      const team = summarizeTeam(progresses, memberCount);
      const data = { groupId: challenge.groupId, challengeId: challenge.id };

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
