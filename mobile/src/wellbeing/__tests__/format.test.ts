import {
  addDays,
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
