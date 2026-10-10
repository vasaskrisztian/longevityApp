import type { CollectiveProgress, GroupChallengeStatus, GroupChallengeType, TeamSummary } from './groups-api';

/** "2026-10-10" → "10 Oct 2026" (UTC, so the date never shifts with the viewer's timezone). */
export function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatDateRange(startDate: string, endDate: string): string {
  return startDate === endDate ? formatDay(startDate) : `${formatDay(startDate)} – ${formatDay(endDate)}`;
}

export const STATUS_LABEL: Record<GroupChallengeStatus, string> = {
  UPCOMING: 'Upcoming',
  ACTIVE: 'Active',
  ENDED: 'Ended',
};

/** "3 days left" / "Last day" / null when not active. */
export function daysLeftLabel(daysRemaining: number | null): string | null {
  if (daysRemaining === null) return null;
  return daysRemaining <= 1 ? 'Last day' : `${daysRemaining} days left`;
}

/** The team line members and admins both see. */
export function teamStatusLine(team: TeamSummary): string {
  if (team.participants === 0) return 'Nobody has joined yet.';
  const who = team.participants === 1 ? '1 participant' : `${team.participants} participants`;
  return `${team.completed} of ${who} reached the goal · average progress ${team.averagePercent}%`;
}

/** 100000 → "100 000" (plain spaces, the same in every browser and locale). */
export function formatAmount(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** "100 000 steps" / "1 workout" / "40 workouts" — a count in the unit of a team total. */
export function collectiveAmountLabel(type: GroupChallengeType, amount: number): string {
  const unit = type === 'DAILY_STEPS' ? 'steps' : amount === 1 ? 'workout' : 'workouts';
  return `${formatAmount(amount)} ${unit}`;
}

/** "75 000 of 100 000 steps · 75%" / "… · goal reached" — the team's shared total. */
export function collectiveLine(type: GroupChallengeType, collective: CollectiveProgress): string {
  const unit = collectiveAmountLabel(type, collective.targetTotal).split(' ').slice(-1)[0];
  return `${formatAmount(collective.total)} of ${formatAmount(collective.targetTotal)} ${unit}${collective.reached ? ' · goal reached' : ` · ${collective.percent}%`}`;
}

/** "12 300 steps · 12% of the team target" — one person's share of a team total. */
export function contributionLine(type: GroupChallengeType, contribution: number, targetTotal: number): string {
  const percent = Math.min(100, Math.round((contribution / Math.max(1, targetTotal)) * 100));
  return `${collectiveAmountLabel(type, contribution)} · ${percent}% of the team target`;
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
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 31) return `${days} d ago`;
  return formatDay(iso.slice(0, 10));
}

export function minutesToHoursLabel(minutes: number | null): string {
  if (minutes === null) return '—';
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
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
