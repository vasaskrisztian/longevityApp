/**
 * Pure rules for group challenges (no I/O): lifecycle status from the dates,
 * one person's progress, the team aggregate, and the human-readable target and
 * summary texts. Everything the admin screens, the member screens and the
 * end-of-challenge notifications show is derived here, so they cannot disagree.
 */

export type GroupChallengeType = 'SLEEP_SCORE' | 'DAILY_STEPS' | 'WEEKLY_WORKOUTS';
export type GroupChallengeStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED';

export function groupChallengeStatus(
  challenge: { startsAt: Date; endsAt: Date },
  now: Date = new Date(),
): GroupChallengeStatus {
  if (now.getTime() < challenge.startsAt.getTime()) return 'UPCOMING';
  if (now.getTime() >= challenge.endsAt.getTime()) return 'ENDED';
  return 'ACTIVE';
}

export interface MemberProgress {
  currentCount: number;
  requiredCount: number;
  /** 0–100, capped — never above 100 even if the person overshoots the goal. */
  percent: number;
  completed: boolean;
}

export function memberProgress(currentCount: number, requiredCount: number): MemberProgress {
  const required = Math.max(1, requiredCount);
  const current = Math.max(0, currentCount);
  return {
    currentCount: current,
    requiredCount: required,
    percent: Math.min(100, Math.round((current / required) * 100)),
    completed: current >= required,
  };
}

export interface TeamSummary {
  /** Members who joined the challenge. */
  participants: number;
  /** Everyone in the group (the pool that could have joined). */
  members: number;
  /** Participants who reached the goal. */
  completed: number;
  /** Mean of the participants' capped percentages (0 when nobody joined). */
  averagePercent: number;
}

export function summarizeTeam(progresses: MemberProgress[], memberCount: number): TeamSummary {
  const participants = progresses.length;
  const completed = progresses.filter((p) => p.completed).length;
  const averagePercent =
    participants === 0 ? 0 : Math.round(progresses.reduce((sum, p) => sum + p.percent, 0) / participants);
  return { participants, members: Math.max(memberCount, participants), completed, averagePercent };
}

/** "5 nights with a sleep score above 80" — what the challenge asks for. */
export function describeChallengeTarget(type: GroupChallengeType, threshold: number, requiredCount: number): string {
  switch (type) {
    case 'SLEEP_SCORE':
      return `${requiredCount} ${requiredCount === 1 ? 'night' : 'nights'} with a sleep score above ${threshold}`;
    case 'DAILY_STEPS':
      return `${requiredCount} ${requiredCount === 1 ? 'day' : 'days'} with more than ${threshold} steps`;
    case 'WEEKLY_WORKOUTS':
      return `${requiredCount} ${requiredCount === 1 ? 'week' : 'weeks'} with more than ${threshold} ${threshold === 1 ? 'workout' : 'workouts'}`;
  }
}

const formatDay = (date: Date) => date.toISOString().slice(0, 10);

export function newChallengeNotification(params: {
  groupName: string;
  name: string;
  type: GroupChallengeType;
  threshold: number;
  requiredCount: number;
  startsAt: Date;
  endsAt: Date;
}): { title: string; body: string } {
  return {
    title: `New group challenge: ${params.name}`,
    body: `${params.groupName} started a challenge — ${describeChallengeTarget(params.type, params.threshold, params.requiredCount)}, from ${formatDay(params.startsAt)} to ${formatDay(params.endsAt)}. Join it from the Wellbeing page if you want to take part.`,
  };
}

export function participantSummaryNotification(params: {
  groupName: string;
  name: string;
  me: MemberProgress;
  team: TeamSummary;
}): { title: string; body: string } {
  const { me, team } = params;
  const mine = me.completed
    ? `You reached the goal (${me.currentCount} of ${me.requiredCount}).`
    : `You got to ${me.currentCount} of ${me.requiredCount} (${me.percent}%).`;
  const teamLine = `Team: ${team.completed} of ${team.participants} ${team.participants === 1 ? 'participant' : 'participants'} reached the goal, average progress ${team.averagePercent}%.`;
  return {
    title: `Challenge finished: ${params.name}`,
    body: `${params.groupName} — ${mine} ${teamLine}`,
  };
}

export function creatorSummaryNotification(params: {
  groupName: string;
  name: string;
  team: TeamSummary;
}): { title: string; body: string } {
  const { team } = params;
  return {
    title: `Challenge finished: ${params.name}`,
    body: `${params.groupName} — ${team.participants} of ${team.members} members took part; ${team.completed} reached the goal, average progress ${team.averagePercent}%.`,
  };
}
