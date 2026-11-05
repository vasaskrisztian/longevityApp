import { setLanguage } from '@/src/i18n';
import { groupErrorMessage } from '@/src/api/groups';
import { COLLECTIVE_FIELDS, validateGoal } from '../challengeForm';
import {
  STATUS_LABEL,
  collectiveLine,
  compactAmount,
  daysLeftLabel,
  formatDay,
  minutesToHoursLabel,
  teamStatusLine,
  timeAgo,
} from '../format';
import { playerErrorMessage, watchedLabel } from '../videoWatch';

afterEach(() => setLanguage('en', { persist: false }));

describe('wellbeing texts follow the language', () => {
  it('translates helpers at call time', () => {
    setLanguage('hu', { persist: false });
    expect(STATUS_LABEL.ACTIVE).toBe('Aktív');
    expect(daysLeftLabel(5)).toBe('5 nap van hátra');
    expect(teamStatusLine({ participants: 4, completed: 2, averagePercent: 63, members: 5 })).toBe(
      '4 résztvevőből 2 elérte a célt · átlagos haladás: 63%',
    );
    expect(collectiveLine('VIDEO_SESSIONS', { total: 40, targetTotal: 200, percent: 20, reached: false })).toBe('40 / 200 alkalom · 20%');
    expect(minutesToHoursLabel(421)).toBe('7 ó 01 p');
    expect(compactAmount(1500)).toBe('1,5k');
    expect(timeAgo('2026-10-10T11:30:00Z', new Date('2026-10-10T12:00:00Z'))).toBe('30 perccel ezelőtt');
    expect(formatDay('2026-10-10')).toMatch(/2026/);
    expect(watchedLabel(83, 300, (n) => String(n))).toBe('83 / 300');
    expect(playerErrorMessage(100)).toBe('Ez a videó már nem érhető el.');
    expect(COLLECTIVE_FIELDS.VIDEO_SESSIONS?.typeLabel).toBe('Videó');
    expect(validateGoal({ mode: 'COLLECTIVE', type: 'DAILY_STEPS', threshold: '', requiredCount: '', targetTotal: '0' }).targetTotal).toMatch(/Egész szám/);
  });

  it('translates to German with plurals', () => {
    setLanguage('de', { persist: false });
    expect(daysLeftLabel(1)).toBe('Letzter Tag');
    expect(teamStatusLine({ participants: 1, completed: 1, averagePercent: 100, members: 1 })).toContain('1 von 1 Teilnehmenden hat');
    expect(collectiveLine('DAILY_STEPS', { total: 75000, targetTotal: 100000, percent: 75, reached: true })).toBe(
      '75 000 von 100 000 Schritte · Ziel erreicht',
    );
  });

  it('maps known server refusals and keeps unknown messages', () => {
    setLanguage('de', { persist: false });
    expect(groupErrorMessage(new Error('not_watched'), 'x')).toBe('Das Video wurde nicht bis zum Ende angesehen.');
    expect(groupErrorMessage(new Error('The video has not been played long enough yet'), 'x')).toBe(
      'Das Video wurde noch nicht lange genug abgespielt.',
    );
    expect(groupErrorMessage(new Error('Something else'), 'x')).toBe('Something else');
    expect(groupErrorMessage(new Error(''), 'fallback')).toBe('fallback');
    expect(groupErrorMessage('boom', 'fallback')).toBe('fallback');
  });
});

describe('challengeTargetText', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { challengeTargetText } = require('@/src/wellbeing/format') as typeof import('@/src/wellbeing/format');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { setLanguage } = require('@/src/i18n') as typeof import('@/src/i18n');

  afterEach(() => setLanguage('en', { persist: false }));

  it('describes what a challenge asks for in each language', () => {
    const sleep = { type: 'SLEEP_SCORE' as const, threshold: 80, requiredCount: 5 };
    expect(challengeTargetText(sleep)).toBe('5 nights with a sleep score above 80');
    setLanguage('de', { persist: false });
    expect(challengeTargetText(sleep)).toBe('5 Nächte mit einem Schlafwert über 80');
    expect(challengeTargetText({ type: 'WEEKLY_WORKOUTS', threshold: 1, requiredCount: 1 })).toBe('1 Woche mit mehr als 1 Workout');
    setLanguage('hu', { persist: false });
    expect(challengeTargetText({ type: 'DAILY_STEPS', mode: 'COLLECTIVE', threshold: 0, requiredCount: 1, targetTotal: 100000 })).toBe(
      'Együtt érjetek el 100 000 lépés',
    );
  });
});
