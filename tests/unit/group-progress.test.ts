import { describe, it, expect } from 'vitest';
import {
  buildCollectiveSeries,
  goalReachedNotification,
  collectiveCreatorSummaryNotification,
  collectiveParticipantSummaryNotification,
  collectiveProgress,
  describeCollectiveAmount,
  describeCollectiveTarget,
  summarizeCollective,
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

describe('collective (team total) challenges', () => {
  it('collectiveProgress caps the percentage at 100 and flags the goal', () => {
    expect(collectiveProgress(25_000, 100_000)).toEqual({ total: 25_000, targetTotal: 100_000, percent: 25, reached: false });
    expect(collectiveProgress(130_000, 100_000)).toMatchObject({ percent: 100, reached: true });
    expect(collectiveProgress(-5, 0)).toMatchObject({ total: 0, targetTotal: 1, percent: 0, reached: false });
  });

  it('summarizeCollective reports the team percentage and who shares the goal', () => {
    expect(summarizeCollective(collectiveProgress(50_000, 100_000), 4, 10)).toEqual({ participants: 4, members: 10, completed: 0, averagePercent: 50 });
    expect(summarizeCollective(collectiveProgress(100_000, 100_000), 4, 3)).toEqual({ participants: 4, members: 4, completed: 4, averagePercent: 100 });
  });

  it('describes the total with thousands separated by spaces and the right unit', () => {
    expect(describeCollectiveAmount('DAILY_STEPS', 100000)).toBe('100 000 steps');
    expect(describeCollectiveAmount('WEEKLY_WORKOUTS', 1)).toBe('1 workout');
    expect(describeCollectiveAmount('WEEKLY_WORKOUTS', 40)).toBe('40 workouts');
    expect(describeCollectiveTarget('DAILY_STEPS', 100000)).toBe('Together reach 100 000 steps');
  });

  it('the new-challenge notification names the shared target', () => {
    const message = newChallengeNotification({
      groupName: 'Acme',
      name: 'October walk',
      type: 'DAILY_STEPS',
      threshold: 0,
      requiredCount: 1,
      mode: 'COLLECTIVE',
      targetTotal: 100000,
      startsAt: at('2026-10-01T00:00:00Z'),
      endsAt: at('2026-10-31T00:00:00Z'),
    });
    expect(message.title).toBe('New team challenge: October walk');
    expect(message.body).toContain('together reach 100 000 steps');
    expect(message.body).toContain('from 2026-10-01 to 2026-10-31');
  });

  it('summaries tell the team result, and each person their own share', () => {
    const reached = collectiveProgress(104_000, 100_000);
    const person = collectiveParticipantSummaryNotification({
      groupName: 'Acme',
      name: 'October walk',
      type: 'DAILY_STEPS',
      collective: reached,
      myContribution: 12_345,
      participants: 8,
    });
    expect(person.body).toContain('Goal reached');
    expect(person.body).toContain('Your share: 12 345');
    const missed = collectiveCreatorSummaryNotification({
      groupName: 'Acme',
      name: 'October walk',
      type: 'DAILY_STEPS',
      collective: collectiveProgress(80_000, 100_000),
      participants: 8,
      members: 12,
    });
    expect(missed.body).toContain('goal missed');
    expect(missed.body).toContain('80 000 steps of 100 000 (80%)');
    expect(missed.body).toContain('8 of 12 members');
  });
});

describe('team chart series and the goal-reached notification', () => {
  it('builds one point per day with a running total, days without data counting 0', () => {
    const series = buildCollectiveSeries('2026-10-30', '2026-11-02', new Map([['2026-10-30', 4000], ['2026-11-01', 1000]]), 100000);
    expect(series).toEqual({
      targetTotal: 100000,
      points: [
        { date: '2026-10-30', amount: 4000, cumulative: 4000 },
        { date: '2026-10-31', amount: 0, cumulative: 4000 },
        { date: '2026-11-01', amount: 1000, cumulative: 5000 },
        { date: '2026-11-02', amount: 0, cumulative: 5000 },
      ],
    });
  });

  it('a single day is one point; an end before the start is no points', () => {
    expect(buildCollectiveSeries('2026-10-10', '2026-10-10', new Map(), 10).points).toHaveLength(1);
    expect(buildCollectiveSeries('2026-10-11', '2026-10-10', new Map(), 10).points).toEqual([]);
  });

  it('the goal-reached text tells the total, the target and how long is left', () => {
    const base = {
      groupName: 'Acme',
      name: 'October walk',
      type: 'DAILY_STEPS' as const,
      collective: collectiveProgress(103_500, 100_000),
    };
    const people = goalReachedNotification({ ...base, daysRemaining: 6, audience: 'participant' });
    expect(people.title).toBe('Team goal reached: October walk');
    expect(people.body).toContain('103 500 steps (target 100 000) with 6 days still to go');
    expect(goalReachedNotification({ ...base, daysRemaining: 1, audience: 'participant' }).body).toContain('on the last day');
    expect(goalReachedNotification({ ...base, daysRemaining: 2, audience: 'creator' }).body).toContain('has reached the target of "October walk"');
  });
});
