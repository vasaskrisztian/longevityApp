import { locale, t } from '@/src/i18n';
import type { CollectiveProgress, GroupChallengeStatus, GroupChallengeType, TeamSummary } from '@/src/api/groups';

/** "2026-10-10" → "10 Oct 2026" (UTC, so the date never shifts with the viewer's timezone). */
export function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatDateRange(startDate: string, endDate: string): string {
  return startDate === endDate ? formatDay(startDate) : `${formatDay(startDate)} – ${formatDay(endDate)}`;
}

/** Translated at access time (getters), so the labels follow the current language. */
export const STATUS_LABEL: Record<GroupChallengeStatus, string> = {
  get UPCOMING() {
    return t('wellbeing.status.UPCOMING');
  },
  get ACTIVE() {
    return t('wellbeing.status.ACTIVE');
  },
  get ENDED() {
    return t('wellbeing.status.ENDED');
  },
};

/** "3 days left" / "Last day" / null when not active. */
export function daysLeftLabel(daysRemaining: number | null): string | null {
  if (daysRemaining === null) return null;
  return daysRemaining <= 1 ? t('wellbeing.daysLeft.last') : t('wellbeing.daysLeft', { count: daysRemaining });
}

/** The team line members and admins both see. */
export function teamStatusLine(team: TeamSummary): string {
  if (team.participants === 0) return t('wellbeing.team.nobody');
  return t('wellbeing.team.status', { count: team.participants, completed: team.completed, percent: team.averagePercent });
}

/** 100000 → "100 000" (plain spaces, the same in every browser and locale). */
export function formatAmount(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** The unit noun of a team total ("steps", "workout(s)", "video session(s)"); the short form of video sessions is "session(s)". */
function unitFor(type: GroupChallengeType, amount: number, short = false): string {
  if (type === 'DAILY_STEPS') return t('wellbeing.unit.steps');
  if (type === 'VIDEO_SESSIONS') return short ? t('wellbeing.unit.session', { count: amount }) : t('wellbeing.unit.videoSession', { count: amount });
  return t('wellbeing.unit.workout', { count: amount });
}

/** "100 000 steps" / "1 workout" / "40 workouts" — a count in the unit of a team total. */
export function collectiveAmountLabel(type: GroupChallengeType, amount: number): string {
  return `${formatAmount(amount)} ${unitFor(type, amount)}`;
}

/**
 * What a challenge asks for, in the app's language ("5 nights with a sleep score above 80",
 * "Together reach 100 000 steps"). Built here from the challenge's numbers — the server's own
 * `target` sentence is English-only.
 */
export function challengeTargetText(challenge: {
  type: GroupChallengeType;
  mode?: 'INDIVIDUAL' | 'COLLECTIVE';
  threshold: number;
  requiredCount: number;
  targetTotal?: number | null;
}): string {
  if (challenge.mode === 'COLLECTIVE' && challenge.targetTotal) {
    return t('wellbeing.target.collective', { amount: collectiveAmountLabel(challenge.type, challenge.targetTotal) });
  }
  const { threshold, requiredCount: count } = challenge;
  switch (challenge.type) {
    case 'SLEEP_SCORE':
      return t('wellbeing.target.sleep', { count, threshold });
    case 'DAILY_STEPS':
      return t('wellbeing.target.steps', { count, threshold });
    case 'WEEKLY_WORKOUTS':
      return t('wellbeing.target.workouts', { count, threshold, workouts: t('wellbeing.unit.workout', { count: threshold }) });
    case 'VIDEO_SESSIONS':
      return t('wellbeing.target.video', { count });
  }
}

/** "75 000 of 100 000 steps · 75%" / "… · goal reached" — the team's shared total. */
export function collectiveLine(type: GroupChallengeType, collective: CollectiveProgress): string {
  return t(collective.reached ? 'wellbeing.collective.lineReached' : 'wellbeing.collective.linePercent', {
    total: formatAmount(collective.total),
    target: formatAmount(collective.targetTotal),
    unit: unitFor(type, collective.targetTotal, true),
    percent: collective.percent,
  });
}

/** "12 300 steps · 12% of the team target" — one person's share of a team total. */
export function contributionLine(type: GroupChallengeType, contribution: number, targetTotal: number): string {
  const percent = Math.min(100, Math.round((contribution / Math.max(1, targetTotal)) * 100));
  return t('wellbeing.collective.contribution', { amount: collectiveAmountLabel(type, contribution), percent });
}

/** "2026-10-10" → "10 Oct" — the short x-axis label of the team chart (UTC). */
export function chartDayLabel(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString(locale(), { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** 100000 → "100k", 1500 → "1.5k", 2000000 → "2M", 40 → "40" — compact y-axis ticks. */
export function compactAmount(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) =>
    new Intl.NumberFormat(locale(), { maximumFractionDigits: 1, useGrouping: false }).format(Math.round(n * 10) / 10);
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 1000) return `${trim(value / 1000)}k`;
  return String(Math.round(value));
}

/**
 * The top of a chart's y axis: the smallest "round" value at or above `value`
 * whose quarters (the four gridline steps) are also whole, round numbers —
 * 105 000 → 120 000 (ticks 30k, 60k, 90k, 120k), 42 → 48 (12, 24, 36, 48).
 */
export function niceAxisMax(value: number): number {
  const needed = Math.max(4, Math.ceil(value));
  for (let power = 0; power < 12; power += 1) {
    for (const multiplier of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8]) {
      const step = multiplier * 10 ** power;
      if (!Number.isInteger(step)) continue;
      if (step * 4 >= needed) return step * 4;
    }
  }
  return needed;
}

const PROVIDER_LABEL: Record<string, string> = {
  OURA: 'Oura',
  APPLE_HEALTH: 'Apple Health',
};
export const providerLabel = (provider: string): string => PROVIDER_LABEL[provider] ?? provider;

/** "just now" / "5 min ago" / "3 h ago" / "2 d ago" / a date for anything older than a month. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.floor((now.getTime() - then) / 60_000);
  if (minutes < 1) return t('wellbeing.time.justNow');
  if (minutes < 60) return t('wellbeing.time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('wellbeing.time.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 31) return t('wellbeing.time.daysAgo', { count: days });
  return formatDay(iso.slice(0, 10));
}

export function minutesToHoursLabel(minutes: number | null): string {
  if (minutes === null) return '—';
  return t('wellbeing.duration.hoursMinutes', { hours: Math.floor(minutes / 60), minutes: String(minutes % 60).padStart(2, '0') });
}

export const displayName = (person: { fullName: string | null; email: string }): string => person.fullName ?? person.email;

/** Today as yyyy-mm-dd (UTC), the default start date of a new challenge. */
export function todayDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Split a pasted blob of addresses the way the server does, for the live "n addresses" hint. */
export function parseEmails(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,;]+/)
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export const isLikelyEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
