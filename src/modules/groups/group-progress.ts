/**
 * Pure rules for group challenges (no I/O): lifecycle status from the dates,
 * one person's progress, the team aggregate, and the human-readable target and
 * summary texts. Everything the admin screens, the member screens and the
 * end-of-challenge notifications show is derived here, so they cannot disagree.
 */

export type GroupChallengeType = 'SLEEP_SCORE' | 'DAILY_STEPS' | 'WEEKLY_WORKOUTS';
export type GroupChallengeMode = 'INDIVIDUAL' | 'COLLECTIVE';
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

/** Team-total progress of a COLLECTIVE challenge. */
export interface CollectiveProgress {
  /** Everything the participants have added up so far (steps, or workouts). */
  total: number;
  targetTotal: number;
  /** 0–100, capped. */
  percent: number;
  reached: boolean;
}

export function collectiveProgress(total: number, targetTotal: number): CollectiveProgress {
  const target = Math.max(1, targetTotal);
  const sum = Math.max(0, total);
  return { total: sum, targetTotal: target, percent: Math.min(100, Math.round((sum / target) * 100)), reached: sum >= target };
}

/** The team aggregate of a COLLECTIVE challenge, in the same shape the individual mode uses. */
export function summarizeCollective(collective: CollectiveProgress, participants: number, memberCount: number): TeamSummary {
  return {
    participants,
    members: Math.max(memberCount, participants),
    completed: collective.reached ? participants : 0,
    averagePercent: collective.percent,
  };
}

const formatNumber = (value: number) => value.toLocaleString('en-US').replace(/,/g, ' ');

/** "100 000 steps" / "40 workouts" — the unit of a team total. */
export function describeCollectiveAmount(type: GroupChallengeType, amount: number): string {
  const word = type === 'DAILY_STEPS' ? 'steps' : amount === 1 ? 'workout' : 'workouts';
  return `${formatNumber(amount)} ${word}`;
}

/** "Together reach 100 000 steps" — what a COLLECTIVE challenge asks for. */
export function describeCollectiveTarget(type: GroupChallengeType, targetTotal: number): string {
  return `Together reach ${describeCollectiveAmount(type, targetTotal)}`;
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
  /** COLLECTIVE challenges only. */
  mode?: GroupChallengeMode;
  targetTotal?: number | null;
  startsAt: Date;
  endsAt: Date;
}): { title: string; body: string } {
  const range = `from ${formatDay(params.startsAt)} to ${formatDay(params.endsAt)}`;
  if (params.mode === 'COLLECTIVE' && params.targetTotal) {
    return {
      title: `New team challenge: ${params.name}`,
      body: `${params.groupName} started a team challenge — ${describeCollectiveTarget(params.type, params.targetTotal).toLowerCase()}, ${range}. Everyone who joins adds to the shared total. Join it from the Wellbeing page if you want to take part.`,
    };
  }
  return {
    title: `New group challenge: ${params.name}`,
    body: `${params.groupName} started a challenge — ${describeChallengeTarget(params.type, params.threshold, params.requiredCount)}, ${range}. Join it from the Wellbeing page if you want to take part.`,
  };
}

export function collectiveParticipantSummaryNotification(params: {
  groupName: string;
  name: string;
  type: GroupChallengeType;
  collective: CollectiveProgress;
  myContribution: number;
  participants: number;
}): { title: string; body: string } {
  const { collective } = params;
  const result = collective.reached
    ? `Goal reached: the team added up ${describeCollectiveAmount(params.type, collective.total)} of ${formatNumber(collective.targetTotal)}.`
    : `The team added up ${describeCollectiveAmount(params.type, collective.total)} of ${formatNumber(collective.targetTotal)} (${collective.percent}%).`;
  return {
    title: `Team challenge finished: ${params.name}`,
    body: `${params.groupName} — ${result} Your share: ${formatNumber(params.myContribution)}. ${params.participants} ${params.participants === 1 ? 'person' : 'people'} took part.`,
  };
}

export function collectiveCreatorSummaryNotification(params: {
  groupName: string;
  name: string;
  type: GroupChallengeType;
  collective: CollectiveProgress;
  participants: number;
  members: number;
}): { title: string; body: string } {
  const { collective } = params;
  return {
    title: `Team challenge finished: ${params.name}`,
    body: `${params.groupName} — ${collective.reached ? 'goal reached' : 'goal missed'}: ${describeCollectiveAmount(params.type, collective.total)} of ${formatNumber(collective.targetTotal)} (${collective.percent}%), ${params.participants} of ${params.members} members took part.`,
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
