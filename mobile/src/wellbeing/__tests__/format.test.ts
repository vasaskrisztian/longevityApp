import {
  addDays,
  niceAxisMax,
  chartDayLabel,
  compactAmount,
  collectiveAmountLabel,
  collectiveLine,
  contributionLine,
  formatAmount,
  daysLeftLabel,
  displayName,
  formatDateRange,
  formatDay,
  isLikelyEmail,
  minutesToHoursLabel,
  parseEmails,
  teamStatusLine,
  timeAgo,
  todayDay,
} from '../format';

describe('dates', () => {
  it('formats a day independent of the viewer timezone', () => {
    expect(formatDay('2026-10-10')).toBe('10 Oct 2026');
    expect(formatDay('nope')).toBe('nope');
  });
  it('collapses a one-day range', () => {
    expect(formatDateRange('2026-10-10', '2026-10-10')).toBe('10 Oct 2026');
    expect(formatDateRange('2026-10-10', '2026-10-17')).toBe('10 Oct 2026 – 17 Oct 2026');
  });
  it('adds days across month ends', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('returns the UTC day', () => {
    expect(todayDay(new Date('2026-10-10T23:59:00Z'))).toBe('2026-10-10');
  });
});

describe('labels', () => {
  it('days left', () => {
    expect(daysLeftLabel(null)).toBeNull();
    expect(daysLeftLabel(1)).toBe('Last day');
    expect(daysLeftLabel(5)).toBe('5 days left');
  });
  it('team line', () => {
    expect(teamStatusLine({ participants: 0, completed: 0, averagePercent: 0 } as never)).toBe('Nobody has joined yet.');
    expect(teamStatusLine({ participants: 1, completed: 1, averagePercent: 100 } as never)).toBe(
      '1 of 1 participant reached the goal · average progress 100%',
    );
    expect(teamStatusLine({ participants: 4, completed: 2, averagePercent: 63 } as never)).toContain('2 of 4 participants');
  });
  it('time ago', () => {
    const now = new Date('2026-10-10T12:00:00Z');
    expect(timeAgo('2026-10-10T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-10-10T11:30:00Z', now)).toBe('30 min ago');
    expect(timeAgo('2026-10-10T07:00:00Z', now)).toBe('5 h ago');
    expect(timeAgo('2026-10-08T12:00:00Z', now)).toBe('2 d ago');
    expect(timeAgo('2026-06-01T12:00:00Z', now)).toBe('1 Jun 2026');
    expect(timeAgo('garbage', now)).toBe('');
  });
  it('minutes and names', () => {
    expect(minutesToHoursLabel(null)).toBe('—');
    expect(minutesToHoursLabel(421)).toBe('7 h 01 min');
    expect(displayName({ fullName: null, email: 'a@b.hu' })).toBe('a@b.hu');
    expect(displayName({ fullName: 'Jane', email: 'a@b.hu' })).toBe('Jane');
  });
});

describe('email parsing', () => {
  it('splits, lowercases and dedupes pasted lists', () => {
    expect(parseEmails('A@x.hu, b@x.hu;\n a@X.hu  c@x.hu')).toEqual(['a@x.hu', 'b@x.hu', 'c@x.hu']);
    expect(parseEmails('  ')).toEqual([]);
  });
  it('rough validity', () => {
    expect(isLikelyEmail('a@b.hu')).toBe(true);
    expect(isLikelyEmail('a@b')).toBe(false);
    expect(isLikelyEmail('a b@c.hu')).toBe(false);
  });
});

describe('team-total (collective) challenge labels', () => {
  it('groups thousands with plain spaces', () => {
    expect(formatAmount(999)).toBe('999');
    expect(formatAmount(1000)).toBe('1 000');
    expect(formatAmount(100000)).toBe('100 000');
    expect(formatAmount(12345678)).toBe('12 345 678');
  });
  it('uses the right unit', () => {
    expect(collectiveAmountLabel('DAILY_STEPS', 100000)).toBe('100 000 steps');
    expect(collectiveAmountLabel('WEEKLY_WORKOUTS', 1)).toBe('1 workout');
    expect(collectiveAmountLabel('WEEKLY_WORKOUTS', 40)).toBe('40 workouts');
  });
  it('shows the team total and whether the goal is reached', () => {
    expect(collectiveLine('DAILY_STEPS', { total: 75000, targetTotal: 100000, percent: 75, reached: false })).toBe('75 000 of 100 000 steps · 75%');
    expect(collectiveLine('WEEKLY_WORKOUTS', { total: 41, targetTotal: 40, percent: 100, reached: true })).toBe('41 of 40 workouts · goal reached');
  });
  it("shows a person's share of the target, capped at 100%", () => {
    expect(contributionLine('DAILY_STEPS', 12300, 100000)).toBe('12 300 steps · 12% of the team target');
    expect(contributionLine('DAILY_STEPS', 150000, 100000)).toBe('150 000 steps · 100% of the team target');
  });
});

describe('team chart labels', () => {
  it('shortens a day for the x axis', () => {
    expect(chartDayLabel('2026-10-10')).toBe('10 Oct');
    expect(chartDayLabel('nope')).toBe('nope');
  });
  it('compacts y-axis ticks', () => {
    expect(compactAmount(0)).toBe('0');
    expect(compactAmount(40)).toBe('40');
    expect(compactAmount(999)).toBe('999');
    expect(compactAmount(1500)).toBe('1.5k');
    expect(compactAmount(25000)).toBe('25k');
    expect(compactAmount(100000)).toBe('100k');
    expect(compactAmount(2000000)).toBe('2M');
  });
});

describe('niceAxisMax', () => {
  it('rounds up to a value whose quarters are round numbers', () => {
    expect(niceAxisMax(105000)).toBe(120000);
    expect(niceAxisMax(100000)).toBe(100000);
    expect(niceAxisMax(42)).toBe(48);
    expect(niceAxisMax(0)).toBe(4);
    expect(niceAxisMax(5.25)).toBe(8);
    expect(niceAxisMax(2_100_000)).toBe(2_400_000);
  });
  it('never returns less than the value', () => {
    for (const value of [1, 7, 39, 41, 99, 1234, 56789, 99999, 100001, 7_654_321]) {
      expect(niceAxisMax(value)).toBeGreaterThanOrEqual(value);
    }
  });
});
