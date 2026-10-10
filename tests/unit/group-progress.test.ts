import { describe, it, expect } from 'vitest';
import {
  creatorSummaryNotification,
  describeChallengeTarget,
  groupChallengeStatus,
  memberProgress,
  newChallengeNotification,
  participantSummaryNotification,
  summarizeTeam,
} from '@/modules/groups/group-progress';

const at = (iso: string) => new Date(iso);

describe('groupChallengeStatus', () => {
  const challenge = { startsAt: at('2026-10-10T00:00:00Z'), endsAt: at('2026-10-17T00:00:00Z') };
  it('is UPCOMING before the start, ACTIVE inside, ENDED from the exclusive end on', () => {
    expect(groupChallengeStatus(challenge, at('2026-10-09T23:59:59Z'))).toBe('UPCOMING');
    expect(groupChallengeStatus(challenge, at('2026-10-10T00:00:00Z'))).toBe('ACTIVE');
    expect(groupChallengeStatus(challenge, at('2026-10-16T23:59:59Z'))).toBe('ACTIVE');
    expect(groupChallengeStatus(challenge, at('2026-10-17T00:00:00Z'))).toBe('ENDED');
  });
});

describe('memberProgress', () => {
  it('computes a rounded percentage and the completed flag', () => {
    expect(memberProgress(1, 3)).toEqual({ currentCount: 1, requiredCount: 3, percent: 33, completed: false });
    expect(memberProgress(3, 3)).toMatchObject({ percent: 100, completed: true });
  });
  it('caps at 100% when the goal is exceeded and never goes negative', () => {
    expect(memberProgress(9, 3)).toMatchObject({ percent: 100, completed: true, currentCount: 9 });
    expect(memberProgress(-2, 3)).toMatchObject({ percent: 0, currentCount: 0 });
  });
  it('treats a zero/negative requirement as 1 instead of dividing by zero', () => {
    expect(memberProgress(0, 0)).toMatchObject({ requiredCount: 1, percent: 0, completed: false });
  });
});

describe('summarizeTeam', () => {
  it('counts participants, completions and the mean of the capped percentages', () => {
    const team = summarizeTeam([memberProgress(3, 3), memberProgress(1, 3), memberProgress(0, 3)], 5);
    expect(team).toEqual({ participants: 3, members: 5, completed: 1, averagePercent: 44 });
  });
  it('handles nobody having joined (average 0, no NaN)', () => {
    expect(summarizeTeam([], 4)).toEqual({ participants: 0, members: 4, completed: 0, averagePercent: 0 });
  });
  it('never reports fewer members than participants', () => {
    expect(summarizeTeam([memberProgress(1, 1)], 0).members).toBe(1);
  });
});

describe('describeChallengeTarget', () => {
  it('words each challenge type and handles the singular', () => {
    expect(describeChallengeTarget('SLEEP_SCORE', 80, 5)).toBe('5 nights with a sleep score above 80');
    expect(describeChallengeTarget('SLEEP_SCORE', 80, 1)).toBe('1 night with a sleep score above 80');
    expect(describeChallengeTarget('DAILY_STEPS', 8000, 10)).toBe('10 days with more than 8000 steps');
    expect(describeChallengeTarget('WEEKLY_WORKOUTS', 2, 3)).toBe('3 weeks with more than 2 workouts');
    expect(describeChallengeTarget('WEEKLY_WORKOUTS', 1, 1)).toBe('1 week with more than 1 workout');
  });
});

describe('notification texts', () => {
  it('announces a new challenge with target and dates', () => {
    const n = newChallengeNotification({
      groupName: 'Acme',
      name: 'October steps',
      type: 'DAILY_STEPS',
      threshold: 8000,
      requiredCount: 10,
      startsAt: at('2026-10-10T00:00:00Z'),
      endsAt: at('2026-10-31T00:00:00Z'),
    });
    expect(n.title).toBe('New group challenge: October steps');
    expect(n.body).toContain('Acme');
    expect(n.body).toContain('10 days with more than 8000 steps');
    expect(n.body).toContain('2026-10-10');
    expect(n.body).toContain('2026-10-31');
  });

  it("summarises a participant's own result and the team's", () => {
    const team = summarizeTeam([memberProgress(3, 3), memberProgress(1, 3)], 4);
    const done = participantSummaryNotification({ groupName: 'Acme', name: 'C', me: memberProgress(3, 3), team });
    expect(done.body).toContain('You reached the goal (3 of 3).');
    expect(done.body).toContain('Team: 1 of 2 participants reached the goal, average progress 67%.');
    const missed = participantSummaryNotification({ groupName: 'Acme', name: 'C', me: memberProgress(1, 3), team });
    expect(missed.body).toContain('You got to 1 of 3 (33%).');
  });

  it('summarises for the creator with participation numbers', () => {
    const team = summarizeTeam([memberProgress(3, 3)], 4);
    expect(creatorSummaryNotification({ groupName: 'Acme', name: 'C', team }).body).toContain(
      '1 of 4 members took part; 1 reached the goal, average progress 100%.',
    );
  });
});
