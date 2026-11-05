/**
 * Pure rules for group challenges (no I/O): lifecycle status from the dates,
 * one person's progress, the team aggregate, and the human-readable target and
 * summary texts. Everything the admin screens, the member screens and the
 * end-of-challenge notifications show is derived here, so they cannot disagree.
 */

import { DEFAULT_LANGUAGE, type Language } from '@/lib/i18n/languages';
import { lowerFirst, st } from '@/lib/i18n/messages';

export type GroupChallengeType = 'SLEEP_SCORE' | 'DAILY_STEPS' | 'WEEKLY_WORKOUTS' | 'VIDEO_SESSIONS';
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

/** When a participant joined and in which time zone their days are counted. */
export interface ParticipantJoin {
  joinedAt: Date;
  timezone?: string | null;
}

/**
 * First calendar day (UTC midnight of that date) a participant's data counts
 * from: the day they joined, in their own time zone. Data is stored per day, so
 * the joining day itself cannot be split into before/after and counts as a
 * whole; everything earlier is history and never counts. Sleep scores are the
 * exception — the score dated a day is last night's sleep, which was over
 * before the person joined — so those start the day after (`afterJoinDay`).
 */
export function participantFirstDay(join: ParticipantJoin, options: { afterJoinDay?: boolean } = {}): Date {
  let day: string;
  try {
    day = new Intl.DateTimeFormat('en-CA', {
      timeZone: join.timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(join.joinedAt);
  } catch {
    day = join.joinedAt.toISOString().slice(0, 10);
  }
  const first = new Date(`${day}T00:00:00.000Z`);
  return options.afterJoinDay ? new Date(first.getTime() + 24 * 60 * 60 * 1000) : first;
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
  language?: Language;
}): { title: string; body: string } {
  const language = params.language ?? DEFAULT_LANGUAGE;
  const { collective } = params;
  const total = describeCollectiveAmount(params.type, collective.total, language);
  const target = formatNumber(collective.targetTotal, language);
  const left =
    params.daysRemaining <= 1
      ? st(language, 'notif.goal.lastDay')
      : st(language, 'notif.goal.daysToGo', { days: params.daysRemaining });
  const common = { group: params.groupName, name: params.name, total, target, left };
  return {
    title: st(language, 'notif.goal.title', { name: params.name }),
    body: st(language, params.audience === 'participant' ? 'notif.goal.participant' : 'notif.goal.creator', common),
  };
}

/** 100000 → "100 000" (English / Hungarian: plain space, German: dot). */
const formatNumber = (value: number, language: Language = DEFAULT_LANGUAGE) =>
  value.toLocaleString('en-US').replace(/,/g, language === 'de' ? '.' : ' ');

/** "100 000 steps" / "40 workouts" — the unit of a team total. */
export function describeCollectiveAmount(type: GroupChallengeType, amount: number, language: Language = DEFAULT_LANGUAGE): string {
  const key = type === 'DAILY_STEPS' ? 'challenge.unit.steps' : type === 'VIDEO_SESSIONS' ? 'challenge.unit.videoSession' : 'challenge.unit.workout';
  return st(language, key, { amount: formatNumber(amount, language), count: amount });
}

/** "Together reach 100 000 steps" — what a COLLECTIVE challenge asks for. */
export function describeCollectiveTarget(type: GroupChallengeType, targetTotal: number, language: Language = DEFAULT_LANGUAGE): string {
  return st(language, 'challenge.target.collective', { amount: describeCollectiveAmount(type, targetTotal, language) });
}

/** "5 nights with a sleep score above 80" — what the challenge asks for. */
export function describeChallengeTarget(
  type: GroupChallengeType,
  threshold: number,
  requiredCount: number,
  language: Language = DEFAULT_LANGUAGE,
): string {
  switch (type) {
    case 'SLEEP_SCORE':
      return st(language, 'challenge.target.sleep', { count: requiredCount, threshold });
    case 'DAILY_STEPS':
      return st(language, 'challenge.target.steps', { count: requiredCount, threshold });
    case 'WEEKLY_WORKOUTS':
      return st(language, 'challenge.target.workouts', {
        count: requiredCount,
        threshold,
        workouts: st(language, 'challenge.word.workout', { count: threshold }),
      });
    case 'VIDEO_SESSIONS':
      return st(language, 'challenge.target.video', { count: requiredCount });
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
  language?: Language;
}): { title: string; body: string } {
  const language = params.language ?? DEFAULT_LANGUAGE;
  const range = st(language, 'challenge.range', { from: formatDay(params.startsAt), to: formatDay(params.endsAt) });
  const common = { group: params.groupName, name: params.name, range };
  const collective = params.mode === 'COLLECTIVE' && params.targetTotal;
  const kind = collective ? (params.type === 'VIDEO_SESSIONS' ? 'teamVideo' : 'team') : params.type === 'VIDEO_SESSIONS' ? 'video' : 'group';
  const target = lowerFirst(
    collective
      ? describeCollectiveTarget(params.type, params.targetTotal as number, language)
      : describeChallengeTarget(params.type, params.threshold, params.requiredCount, language),
  );
  const title = `notif.new.${kind}.title` as const;
  const body = `notif.new.${kind}.body` as const;
  return { title: st(language, title, common), body: st(language, body, { ...common, target }) };
}

export function collectiveParticipantSummaryNotification(params: {
  groupName: string;
  name: string;
  type: GroupChallengeType;
  collective: CollectiveProgress;
  myContribution: number;
  participants: number;
  language?: Language;
}): { title: string; body: string } {
  const language = params.language ?? DEFAULT_LANGUAGE;
  const { collective } = params;
  const amounts = {
    total: describeCollectiveAmount(params.type, collective.total, language),
    target: formatNumber(collective.targetTotal, language),
    percent: collective.percent,
  };
  const result = st(language, collective.reached ? 'notif.teamDone.reached' : 'notif.teamDone.notReached', amounts);
  return {
    title: st(language, 'notif.teamDone.title', { name: params.name }),
    body: st(language, 'notif.teamDone.participant', {
      group: params.groupName,
      result,
      share: formatNumber(params.myContribution, language),
      people: st(language, 'notif.teamDone.people', { count: params.participants }),
    }),
  };
}

export function collectiveCreatorSummaryNotification(params: {
  groupName: string;
  name: string;
  type: GroupChallengeType;
  collective: CollectiveProgress;
  participants: number;
  members: number;
  language?: Language;
}): { title: string; body: string } {
  const language = params.language ?? DEFAULT_LANGUAGE;
  const { collective } = params;
  return {
    title: st(language, 'notif.teamDone.title', { name: params.name }),
    body: st(language, 'notif.teamDone.creator', {
      group: params.groupName,
      state: st(language, collective.reached ? 'notif.teamDone.stateReached' : 'notif.teamDone.stateMissed'),
      total: describeCollectiveAmount(params.type, collective.total, language),
      target: formatNumber(collective.targetTotal, language),
      percent: collective.percent,
      participants: params.participants,
      members: params.members,
    }),
  };
}

export function participantSummaryNotification(params: {
  groupName: string;
  name: string;
  me: MemberProgress;
  team: TeamSummary;
  language?: Language;
}): { title: string; body: string } {
  const language = params.language ?? DEFAULT_LANGUAGE;
  const { me, team } = params;
  const mine = me.completed
    ? st(language, 'notif.done.mineReached', { current: me.currentCount, required: me.requiredCount })
    : st(language, 'notif.done.mineNot', { current: me.currentCount, required: me.requiredCount, percent: me.percent });
  const teamLine = st(language, 'notif.done.team', {
    completed: team.completed,
    count: team.participants,
    average: team.averagePercent,
  });
  return {
    title: st(language, 'notif.done.title', { name: params.name }),
    body: st(language, 'notif.done.participant', { group: params.groupName, mine, teamLine }),
  };
}

export function creatorSummaryNotification(params: {
  groupName: string;
  name: string;
  team: TeamSummary;
  language?: Language;
}): { title: string; body: string } {
  const language = params.language ?? DEFAULT_LANGUAGE;
  const { team } = params;
  return {
    title: st(language, 'notif.done.title', { name: params.name }),
    body: st(language, 'notif.done.creator', {
      group: params.groupName,
      participants: team.participants,
      members: team.members,
      completed: team.completed,
      average: team.averagePercent,
    }),
  };
}

/** Share of the video that must really have been watched (and elapsed) for a viewing to count. */
export const VIDEO_COMPLETION_RATIO = 0.9;
/** A started viewing is only valid for this long — a stale one cannot be completed. */
export const VIDEO_WATCH_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export type VideoCompletionCheck =
  | { ok: true }
  | { ok: false; reason: 'too_early' | 'not_watched' | 'expired' };

/**
 * Decides whether a viewing counts. Two independent checks, both against the
 * length the admin gave: real time since the viewing started (so skipping to
 * the end gives nothing) and the playing time the player reported.
 */
export function evaluateVideoCompletion(params: {
  durationSec: number;
  startedAt: Date;
  now: Date;
  watchedSeconds: number;
}): VideoCompletionCheck {
  const needed = Math.floor(params.durationSec * VIDEO_COMPLETION_RATIO);
  const elapsedMs = params.now.getTime() - params.startedAt.getTime();
  if (elapsedMs > VIDEO_WATCH_MAX_AGE_MS) return { ok: false, reason: 'expired' };
  if (elapsedMs < needed * 1000) return { ok: false, reason: 'too_early' };
  if (params.watchedSeconds < needed) return { ok: false, reason: 'not_watched' };
  return { ok: true };
}

/** The person's own calendar day of `moment` (UTC midnight of that date) — the day a viewing is credited to. */
export function videoSessionDay(moment: Date, timezone?: string | null): Date {
  return participantFirstDay({ joinedAt: moment, timezone });
}
