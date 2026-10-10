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

/** One day of a team-total chart. */
export interface SeriesPoint {
  /** `yyyy-mm-dd` (UTC). */
  date: string;
  /** What the team added that day. */
  amount: number;
  /** Running total up to and including that day. */
  cumulative: number;
}

export interface CollectiveSeries {
  targetTotal: number;
  points: SeriesPoint[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The team's running total, one point per day from the first day up to
 * `lastDay` (inclusive), days without data counting 0. `lastDay` is the last
 * day with real numbers (today, or the challenge's last day) — the chart never
 * extends into the future.
 */
export function buildCollectiveSeries(
  firstDay: string,
  lastDay: string,
  amountsByDay: Map<string, number>,
  targetTotal: number,
): CollectiveSeries {
  const points: SeriesPoint[] = [];
  let cumulative = 0;
  const end = Date.parse(`${lastDay}T00:00:00Z`);
  for (let t = Date.parse(`${firstDay}T00:00:00Z`); t <= end; t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    const amount = amountsByDay.get(date) ?? 0;
    cumulative += amount;
    points.push({ date, amount, cumulative });
  }
  return { targetTotal, points };
}

export function goalReachedNotification(params: {
  groupName: string;
  name: string;
  type: GroupChallengeType;
  collective: CollectiveProgress;
  daysRemaining: number;
  /** The admin who set the challenge gets a slightly different line than the participants. */
  audience: 'participant' | 'creator';
}): { title: string; body: string } {
  const { collective } = params;
  const total = describeCollectiveAmount(params.type, collective.total);
  const target = formatNumber(collective.targetTotal);
  const left =
    params.daysRemaining <= 1
      ? 'on the last day'
      : `with ${params.daysRemaining} days still to go`;
  return {
    title: `Team goal reached: ${params.name}`,
    body:
      params.audience === 'participant'
        ? `${params.groupName} — together you have added up ${total} (target ${target}) ${left}. Thank you for taking part — keep going if you like, everything you add still counts towards the final result.`
        : `${params.groupName} — the team has reached the target of "${params.name}": ${total} of ${target} ${left}.`,
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
