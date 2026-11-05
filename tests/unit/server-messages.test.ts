import { describe, it, expect } from 'vitest';
import { serverCatalogs, st } from '@/lib/i18n/messages';
import {
  describeChallengeTarget,
  describeCollectiveTarget,
  goalReachedNotification,
  newChallengeNotification,
  participantSummaryNotification,
} from '@/modules/groups/group-progress';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('server message catalogues', () => {
  const keys = Object.keys(serverCatalogs.en);

  it.each(['hu', 'de'] as const)('%s has the keys and placeholders of the English source', (language) => {
    expect(Object.keys(serverCatalogs[language]).sort()).toEqual([...keys].sort());
    const mismatched = keys.filter((k) => placeholders(serverCatalogs.en[k]!) !== placeholders(serverCatalogs[language][k]!));
    expect(mismatched).toEqual([]);
  });

  it('keeps plural pairs together', () => {
    for (const key of keys.filter((k) => k.endsWith('_one'))) expect(keys).toContain(key.replace(/_one$/, '_other'));
  });
});

describe('challenge texts per language', () => {
  it('describes targets in each language with the right plural', () => {
    expect(describeChallengeTarget('SLEEP_SCORE', 80, 1)).toBe('1 night with a sleep score above 80');
    expect(describeChallengeTarget('SLEEP_SCORE', 80, 5, 'de')).toBe('5 Nächte mit einem Schlafwert über 80');
    expect(describeChallengeTarget('SLEEP_SCORE', 80, 1, 'de')).toBe('1 Nacht mit einem Schlafwert über 80');
    expect(describeChallengeTarget('WEEKLY_WORKOUTS', 3, 2, 'de')).toBe('2 Wochen mit mehr als 3 Workouts');
    expect(describeChallengeTarget('DAILY_STEPS', 8000, 4, 'hu')).toContain('8000');
    expect(describeCollectiveTarget('DAILY_STEPS', 100000, 'hu')).toBe('Együtt érjetek el 100 000 lépés');
    expect(describeCollectiveTarget('DAILY_STEPS', 100000, 'de')).toBe('Erreicht gemeinsam 100.000 Schritte');
  });

  it('writes a new-challenge notification in the recipient language', () => {
    const base = {
      groupName: 'Kardi-soft',
      name: 'Desk stretch',
      type: 'VIDEO_SESSIONS' as const,
      threshold: 0,
      requiredCount: 5,
      startsAt: new Date('2026-11-01T00:00:00Z'),
      endsAt: new Date('2026-11-30T00:00:00Z'),
    };
    expect(newChallengeNotification(base).title).toBe('New video challenge: Desk stretch');
    const hu = newChallengeNotification({ ...base, language: 'hu' });
    expect(hu.title).toBe('Új videókihívás: Desk stretch');
    expect(hu.body).toContain('2026-11-01 és 2026-11-30 között');
    const de = newChallengeNotification({ ...base, language: 'de' });
    expect(de.title).toBe('Neue Video-Challenge: Desk stretch');
    expect(de.body).toContain('an 5 Tagen das Video bis zum Ende ansehen');
    expect(de.body).toContain('vom 2026-11-01 bis 2026-11-30');
  });

  it('writes summaries and goal notices in German and Hungarian', () => {
    const me = { currentCount: 4, requiredCount: 5, percent: 80, completed: false };
    const team = { participants: 3, members: 8, completed: 1, averagePercent: 60 };
    expect(participantSummaryNotification({ groupName: 'G', name: 'N', me, team, language: 'de' }).body).toBe(
      'G — Du hast 4 von 5 geschafft (80 %). Team: 1 von 3 Teilnehmern haben das Ziel erreicht, durchschnittlicher Fortschritt 60 %.',
    );
    expect(participantSummaryNotification({ groupName: 'G', name: 'N', me, team, language: 'hu' }).title).toBe('Kihívás lezárult: N');
    const collective = { total: 105000, targetTotal: 100000, percent: 100, reached: true };
    const goal = goalReachedNotification({ groupName: 'G', name: 'N', type: 'DAILY_STEPS', collective, daysRemaining: 1, audience: 'participant', language: 'hu' });
    expect(goal.title).toBe('Csapatcél elérve: N');
    expect(goal.body).toContain('105 000 lépés');
    expect(goal.body).toContain('az utolsó napon');
  });

  it('falls back to English for the plain call', () => {
    expect(st('en', 'notif.invitation.title', { group: 'Acme' })).toBe('Invitation to Acme');
    expect(st('de', 'notif.invitation.title', { group: 'Acme' })).toBe('Einladung zu Acme');
  });
});
