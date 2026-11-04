import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseYouTubeVideoId } from '@/lib/video/youtube';
import { CreateGroupChallengeSchema, CompleteVideoWatchSchema } from '@/lib/validation/group.schemas';
import {
  describeChallengeTarget,
  describeCollectiveTarget,
  evaluateVideoCompletion,
  newChallengeNotification,
  videoSessionDay,
} from '@/modules/groups/group-progress';

const prismaMock = {
  wellbeingGroup: { findUnique: vi.fn() },
  groupMembership: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  groupChallenge: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), delete: vi.fn(), updateMany: vi.fn() },
  groupChallengeParticipant: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  groupVideoWatch: { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
  groupVideoSession: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  profile: { findUnique: vi.fn() },
};
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logging/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/audit/audit-log.service', () => ({ recordAuditLog: vi.fn() }));
vi.mock('@/modules/challenges/challenges.service', () => ({
  countQualifyingPeriodsFor: vi.fn(),
  sumMetricFor: vi.fn(),
  dailyTotalsFor: vi.fn(),
}));
const createNotificationsForUsers = vi.fn();
vi.mock('@/modules/notifications/notifications.service', () => ({
  createNotification: vi.fn(),
  createNotificationsForUsers,
}));
const listMemberIds = vi.fn();
vi.mock('@/modules/groups/groups.service', () => ({ listMemberIds }));

const {
  toChallengeDTO,
  computeParticipantProgress,
  createGroupChallenge,
  startVideoWatch,
  completeVideoWatch,
  listMyGroupChallenges,
} = await import('@/modules/groups/group-challenges.service');
const { groupChallengeErrorResponse } = await import('@/modules/groups/group-challenge-http');
const { GroupChallengeError } = await import('@/modules/groups/group-challenges.service');

const NOW = new Date('2026-10-12T09:00:00Z');
const videoRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  groupId: 'g1',
  createdById: 'admin',
  name: 'Desk stretch',
  description: null,
  type: 'VIDEO_SESSIONS',
  threshold: 0,
  requiredCount: 5,
  mode: 'INDIVIDUAL',
  targetTotal: null,
  videoId: 'dQw4w9WgXcQ',
  videoTitle: '5-minute desk stretch',
  videoDurationSec: 300,
  startsAt: new Date('2026-10-10T00:00:00Z'),
  endsAt: new Date('2026-10-17T00:00:00Z'),
  summarySentAt: null,
  participants: [] as { userId: string }[],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.groupMembership.findUnique.mockResolvedValue({ id: 'm1' });
  prismaMock.groupChallenge.findUnique.mockResolvedValue(videoRow());
  prismaMock.groupChallengeParticipant.findUnique.mockResolvedValue({ createdAt: new Date('2026-10-11T08:00:00Z') });
  prismaMock.groupChallengeParticipant.findMany.mockResolvedValue([]);
  prismaMock.profile.findUnique.mockResolvedValue({ timezone: 'UTC' });
  prismaMock.groupVideoSession.findUnique.mockResolvedValue(null);
  prismaMock.groupVideoSession.count.mockResolvedValue(0);
});

describe('parseYouTubeVideoId', () => {
  const id = 'dQw4w9WgXcQ';
  it.each([
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=30s&list=PL1`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `https://www.youtube.com/live/${id}`,
    `  www.youtube.com/watch?v=${id}  `,
  ])('finds the id in %s', (url) => {
    expect(parseYouTubeVideoId(url)).toBe(id);
  });

  it.each([
    '',
    'not a url',
    'https://vimeo.com/123456789',
    'https://www.youtube.com/watch',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv',
    `https://evil.example.com/watch?v=${id}`,
    `https://youtube.com.evil.example.com/watch?v=${id}`,
    `javascript:alert(1)//youtube.com/watch?v=${id}`,
    `ftp://youtube.com/watch?v=${id}`,
  ])('rejects %s', (url) => {
    expect(parseYouTubeVideoId(url)).toBeNull();
  });
});

describe('CreateGroupChallengeSchema — video challenges', () => {
  const base = {
    name: 'Desk stretch',
    type: 'VIDEO_SESSIONS',
    requiredCount: 5,
    videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
    videoDurationSec: 300,
    startDate: '2026-10-10',
    endDate: '2026-10-16',
  };

  it('needs no threshold, stores the video id and normalises threshold to 0', () => {
    const parsed = CreateGroupChallengeSchema.parse(base);
    expect(parsed).toMatchObject({
      type: 'VIDEO_SESSIONS',
      mode: 'INDIVIDUAL',
      threshold: 0,
      requiredCount: 5,
      targetTotal: null,
      videoId: 'dQw4w9WgXcQ',
      videoTitle: 'Desk stretch',
      videoDurationSec: 300,
    });
  });

  it('keeps an explicit video title', () => {
    expect(CreateGroupChallengeSchema.parse({ ...base, videoTitle: '5-minute stretch' }).videoTitle).toBe('5-minute stretch');
  });

  it('works as a team total (sessions together)', () => {
    const parsed = CreateGroupChallengeSchema.parse({ ...base, mode: 'COLLECTIVE', requiredCount: undefined, targetTotal: 200 });
    expect(parsed).toMatchObject({ mode: 'COLLECTIVE', targetTotal: 200, requiredCount: 1, threshold: 0 });
  });

  it('requires a real YouTube link and the length', () => {
    const noUrl = CreateGroupChallengeSchema.safeParse({ ...base, videoUrl: undefined });
    expect(noUrl.success).toBe(false);
    const badUrl = CreateGroupChallengeSchema.safeParse({ ...base, videoUrl: 'https://vimeo.com/1' });
    expect(badUrl.success).toBe(false);
    if (!badUrl.success) expect(badUrl.error.issues[0]!.path).toEqual(['videoUrl']);
    expect(CreateGroupChallengeSchema.safeParse({ ...base, videoDurationSec: undefined }).success).toBe(false);
    expect(CreateGroupChallengeSchema.safeParse({ ...base, videoDurationSec: 5 }).success).toBe(false);
    expect(CreateGroupChallengeSchema.safeParse({ ...base, videoDurationSec: 99_999 }).success).toBe(false);
  });

  it('ignores video fields on other challenge types', () => {
    const parsed = CreateGroupChallengeSchema.parse({
      name: 'Steps',
      type: 'DAILY_STEPS',
      threshold: 8000,
      requiredCount: 5,
      videoUrl: 'whatever',
      startDate: '2026-10-10',
      endDate: '2026-10-16',
    });
    expect(parsed).toMatchObject({ videoId: null, videoTitle: null, videoDurationSec: null, threshold: 8000 });
  });
});

describe('CompleteVideoWatchSchema', () => {
  it('needs the watch id and a non-negative number of seconds', () => {
    expect(CompleteVideoWatchSchema.safeParse({ watchId: 'w1', watchedSeconds: 290 }).success).toBe(true);
    expect(CompleteVideoWatchSchema.safeParse({ watchId: 'w1', watchedSeconds: -1 }).success).toBe(false);
    expect(CompleteVideoWatchSchema.safeParse({ watchedSeconds: 10 }).success).toBe(false);
  });
});

describe('texts', () => {
  it('describes the individual and the team goal', () => {
    expect(describeChallengeTarget('VIDEO_SESSIONS', 0, 5)).toBe('Watch the video to the end on 5 days');
    expect(describeChallengeTarget('VIDEO_SESSIONS', 0, 1)).toBe('Watch the video to the end on 1 day');
    expect(describeCollectiveTarget('VIDEO_SESSIONS', 200)).toBe('Together reach 200 video sessions');
  });
  it('announces the new video challenge', () => {
    const base = { groupName: 'Acme', name: 'Desk stretch', type: 'VIDEO_SESSIONS' as const, threshold: 0, requiredCount: 5, startsAt: new Date('2026-10-10T00:00:00Z'), endsAt: new Date('2026-10-16T00:00:00Z') };
    expect(newChallengeNotification(base)).toMatchObject({ title: 'New video challenge: Desk stretch' });
    expect(newChallengeNotification(base).body).toContain('watch the video to the end on 5 days');
    const team = newChallengeNotification({ ...base, mode: 'COLLECTIVE', targetTotal: 200 });
    expect(team.title).toBe('New team video challenge: Desk stretch');
    expect(team.body).toContain('together reach 200 video sessions');
  });
});

describe('evaluateVideoCompletion', () => {
  const startedAt = new Date('2026-10-12T09:00:00Z');
  const at = (seconds: number) => new Date(startedAt.getTime() + seconds * 1000);
  it('accepts a viewing that took about the video\'s length', () => {
    expect(evaluateVideoCompletion({ durationSec: 300, startedAt, now: at(305), watchedSeconds: 298 })).toEqual({ ok: true });
    expect(evaluateVideoCompletion({ durationSec: 300, startedAt, now: at(270), watchedSeconds: 270 })).toEqual({ ok: true });
  });
  it('refuses skipping ahead: not enough real time since the start', () => {
    expect(evaluateVideoCompletion({ durationSec: 300, startedAt, now: at(20), watchedSeconds: 300 })).toEqual({ ok: false, reason: 'too_early' });
  });
  it('refuses when the player reports too little playing time', () => {
    expect(evaluateVideoCompletion({ durationSec: 300, startedAt, now: at(400), watchedSeconds: 60 })).toEqual({ ok: false, reason: 'not_watched' });
  });
  it('refuses a viewing left open for hours', () => {
    expect(evaluateVideoCompletion({ durationSec: 300, startedAt, now: at(7 * 3600), watchedSeconds: 300 })).toEqual({ ok: false, reason: 'expired' });
  });
});

describe('videoSessionDay', () => {
  it('is the person\'s own calendar day', () => {
    expect(videoSessionDay(new Date('2026-10-11T22:30:00Z'), 'Europe/Budapest')).toEqual(new Date('2026-10-12T00:00:00Z'));
    expect(videoSessionDay(new Date('2026-10-11T22:30:00Z'), 'UTC')).toEqual(new Date('2026-10-11T00:00:00Z'));
    expect(videoSessionDay(new Date('2026-10-11T22:30:00Z'), null)).toEqual(new Date('2026-10-11T00:00:00Z'));
  });
});

describe('toChallengeDTO — video', () => {
  it('carries the video and its target text', () => {
    expect(toChallengeDTO(videoRow(), NOW)).toMatchObject({
      type: 'VIDEO_SESSIONS',
      target: 'Watch the video to the end on 5 days',
      video: { videoId: 'dQw4w9WgXcQ', title: '5-minute desk stretch', durationSec: 300 },
    });
  });
  it('has no video on other challenges', () => {
    expect(toChallengeDTO(videoRow({ type: 'DAILY_STEPS', videoId: null }), NOW).video).toBeNull();
  });
});

describe('createGroupChallenge — video', () => {
  it('stores the video on the challenge', async () => {
    prismaMock.wellbeingGroup.findUnique.mockResolvedValue({ id: 'g1', name: 'Acme' });
    prismaMock.groupChallenge.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'c1', ...data }));
    listMemberIds.mockResolvedValue(['u1']);
    await createGroupChallenge(
      'admin',
      'g1',
      { name: 'Desk stretch', type: 'VIDEO_SESSIONS', threshold: 0, requiredCount: 5, videoId: 'dQw4w9WgXcQ', videoTitle: 'Stretch', videoDurationSec: 300, startDate: '2026-10-10', endDate: '2026-10-16' },
      NOW,
    );
    expect(prismaMock.groupChallenge.create.mock.calls[0]![0].data).toMatchObject({
      type: 'VIDEO_SESSIONS',
      videoId: 'dQw4w9WgXcQ',
      videoTitle: 'Stretch',
      videoDurationSec: 300,
    });
    expect(createNotificationsForUsers).toHaveBeenCalledWith(['u1'], expect.objectContaining({ title: 'New video challenge: Desk stretch' }));
  });
});

describe('computeParticipantProgress — video', () => {
  it('counts the person\'s finished sessions from when they joined, against their own goal', async () => {
    prismaMock.groupVideoSession.count.mockResolvedValue(2);
    const joinedAt = new Date('2026-10-11T08:00:00Z');
    const progress = await computeParticipantProgress(videoRow() as never, 'u1', NOW, { joinedAt, timezone: 'UTC' });
    expect(prismaMock.groupVideoSession.count).toHaveBeenCalledWith({
      where: { challengeId: 'c1', userId: 'u1', completedAt: { gte: joinedAt } },
    });
    expect(progress).toMatchObject({ currentCount: 2, requiredCount: 5, percent: 40 });
  });
  it('a team-total challenge shows the contribution against the team target', async () => {
    prismaMock.groupVideoSession.count.mockResolvedValue(3);
    const progress = await computeParticipantProgress(videoRow({ mode: 'COLLECTIVE', targetTotal: 200, requiredCount: 1 }) as never, 'u1', NOW);
    expect(progress).toMatchObject({ currentCount: 3, requiredCount: 200 });
  });
  it('is 0 before the start without a query', async () => {
    const progress = await computeParticipantProgress(videoRow() as never, 'u1', new Date('2026-10-01T00:00:00Z'));
    expect(progress.currentCount).toBe(0);
    expect(prismaMock.groupVideoSession.count).not.toHaveBeenCalled();
  });
});

describe('listMyGroupChallenges — video', () => {
  it('tells whether the video was already finished today (own day)', async () => {
    prismaMock.groupMembership.count.mockResolvedValue(3);
    prismaMock.groupChallenge.findMany.mockResolvedValue([videoRow({ participants: [{ userId: 'u1' }] })]);
    prismaMock.groupVideoSession.findUnique.mockResolvedValue({ id: 's1' });
    const [challenge] = await listMyGroupChallenges('u1', 'g1', NOW);
    expect(prismaMock.groupVideoSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { challengeId_userId_day: { challengeId: 'c1', userId: 'u1', day: new Date('2026-10-12T00:00:00Z') } } }),
    );
    expect(challenge).toMatchObject({ joined: true, videoDoneToday: true });
  });
  it('is null for non-video challenges', async () => {
    prismaMock.groupMembership.count.mockResolvedValue(1);
    prismaMock.groupChallenge.findMany.mockResolvedValue([videoRow({ type: 'DAILY_STEPS', videoId: null, participants: [{ userId: 'u1' }] })]);
    const [challenge] = await listMyGroupChallenges('u1', 'g1', NOW);
    expect(challenge!.videoDoneToday).toBeNull();
  });
});

describe('startVideoWatch', () => {
  it('opens a viewing for a participant and keeps only one open', async () => {
    prismaMock.groupVideoWatch.create.mockResolvedValue({ id: 'w1', startedAt: NOW });
    const result = await startVideoWatch('u1', 'g1', 'c1', NOW);
    expect(result.watchId).toBe('w1');
    expect(prismaMock.groupVideoWatch.deleteMany).toHaveBeenCalledWith({ where: { challengeId: 'c1', userId: 'u1', completedAt: null } });
    expect(prismaMock.groupVideoWatch.create).toHaveBeenCalledWith({ data: { challengeId: 'c1', userId: 'u1', startedAt: NOW } });
  });
  it('refuses non-members, other groups, non-video challenges, inactive challenges and non-participants', async () => {
    prismaMock.groupMembership.findUnique.mockResolvedValueOnce(null);
    await expect(startVideoWatch('u1', 'g1', 'c1', NOW)).rejects.toMatchObject({ code: 'not_member' });

    prismaMock.groupChallenge.findUnique.mockResolvedValueOnce(videoRow({ groupId: 'other' }));
    await expect(startVideoWatch('u1', 'g1', 'c1', NOW)).rejects.toMatchObject({ code: 'not_found' });

    prismaMock.groupChallenge.findUnique.mockResolvedValueOnce(videoRow({ type: 'DAILY_STEPS', videoId: null }));
    await expect(startVideoWatch('u1', 'g1', 'c1', NOW)).rejects.toMatchObject({ code: 'not_video' });

    await expect(startVideoWatch('u1', 'g1', 'c1', new Date('2026-10-20T00:00:00Z'))).rejects.toMatchObject({ code: 'not_active' });
    await expect(startVideoWatch('u1', 'g1', 'c1', new Date('2026-10-01T00:00:00Z'))).rejects.toMatchObject({ code: 'not_active' });

    prismaMock.groupChallengeParticipant.findUnique.mockResolvedValueOnce(null);
    await expect(startVideoWatch('u1', 'g1', 'c1', NOW)).rejects.toMatchObject({ code: 'not_participant' });
    expect(prismaMock.groupVideoWatch.create).not.toHaveBeenCalled();
  });
});

describe('completeVideoWatch', () => {
  const started = new Date('2026-10-12T08:54:00Z'); // six minutes before NOW
  const watch = (overrides: Record<string, unknown> = {}) => ({ id: 'w1', userId: 'u1', challengeId: 'c1', startedAt: started, completedAt: null, ...overrides });

  beforeEach(() => {
    prismaMock.groupVideoWatch.findUnique.mockResolvedValue(watch());
    prismaMock.groupVideoWatch.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.groupVideoSession.count.mockResolvedValue(1);
  });

  it('counts one session for the person\'s own day', async () => {
    const result = await completeVideoWatch('u1', 'g1', 'c1', { watchId: 'w1', watchedSeconds: 299 }, NOW);
    expect(result).toEqual({ counted: true, sessions: 1, day: '2026-10-12' });
    expect(prismaMock.groupVideoSession.create).toHaveBeenCalledWith({
      data: { challengeId: 'c1', userId: 'u1', day: new Date('2026-10-12T00:00:00Z'), completedAt: NOW, watchedSeconds: 299 },
    });
    expect(prismaMock.groupVideoWatch.updateMany).toHaveBeenCalledWith({ where: { id: 'w1', completedAt: null }, data: { completedAt: NOW } });
  });

  it('credits the day in the person\'s own time zone', async () => {
    prismaMock.profile.findUnique.mockResolvedValue({ timezone: 'Europe/Budapest' });
    const lateEvening = new Date('2026-10-12T22:30:00Z'); // 00:30 next day in Budapest
    prismaMock.groupVideoWatch.findUnique.mockResolvedValue(watch({ startedAt: new Date('2026-10-12T22:24:00Z') }));
    const result = await completeVideoWatch('u1', 'g1', 'c1', { watchId: 'w1', watchedSeconds: 300 }, lateEvening);
    expect(result.day).toBe('2026-10-13');
  });

  it('does not count a second finish on the same day', async () => {
    prismaMock.groupVideoSession.findUnique.mockResolvedValue({ id: 's1' });
    prismaMock.groupVideoSession.count.mockResolvedValue(2);
    const result = await completeVideoWatch('u1', 'g1', 'c1', { watchId: 'w1', watchedSeconds: 300 }, NOW);
    expect(result).toMatchObject({ counted: false, sessions: 2 });
    expect(prismaMock.groupVideoSession.create).not.toHaveBeenCalled();
  });

  it('survives a race on the unique day key', async () => {
    prismaMock.groupVideoSession.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    await expect(completeVideoWatch('u1', 'g1', 'c1', { watchId: 'w1', watchedSeconds: 300 }, NOW)).resolves.toMatchObject({ counted: false });
  });

  it('rethrows any other database error', async () => {
    prismaMock.groupVideoSession.create.mockRejectedValue(new Error('boom'));
    await expect(completeVideoWatch('u1', 'g1', 'c1', { watchId: 'w1', watchedSeconds: 300 }, NOW)).rejects.toThrow('boom');
  });

  it('rejects skipping to the end (too early) and leaves the viewing open', async () => {
    prismaMock.groupVideoWatch.findUnique.mockResolvedValue(watch({ startedAt: new Date(NOW.getTime() - 30_000) }));
    await expect(completeVideoWatch('u1', 'g1', 'c1', { watchId: 'w1', watchedSeconds: 300 }, NOW)).rejects.toMatchObject({ code: 'too_early' });
    expect(prismaMock.groupVideoWatch.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.groupVideoSession.create).not.toHaveBeenCalled();
  });

  it('rejects too little reported playing time', async () => {
    await expect(completeVideoWatch('u1', 'g1', 'c1', { watchId: 'w1', watchedSeconds: 100 }, NOW)).rejects.toMatchObject({ code: 'not_watched' });
  });

  it('rejects an expired viewing', async () => {
    prismaMock.groupVideoWatch.findUnique.mockResolvedValue(watch({ startedAt: new Date(NOW.getTime() - 8 * 3600_000) }));
    await expect(completeVideoWatch('u1', 'g1', 'c1', { watchId: 'w1', watchedSeconds: 300 }, NOW)).rejects.toMatchObject({ code: 'expired' });
  });

  it('rejects an unknown, foreign or already used viewing', async () => {
    prismaMock.groupVideoWatch.findUnique.mockResolvedValueOnce(null);
    await expect(completeVideoWatch('u1', 'g1', 'c1', { watchId: 'x', watchedSeconds: 300 }, NOW)).rejects.toMatchObject({ code: 'watch_not_found' });
    prismaMock.groupVideoWatch.findUnique.mockResolvedValueOnce(watch({ userId: 'someone-else' }));
    await expect(completeVideoWatch('u1', 'g1', 'c1', { watchId: 'w1', watchedSeconds: 300 }, NOW)).rejects.toMatchObject({ code: 'watch_not_found' });
    prismaMock.groupVideoWatch.findUnique.mockResolvedValueOnce(watch({ completedAt: NOW }));
    await expect(completeVideoWatch('u1', 'g1', 'c1', { watchId: 'w1', watchedSeconds: 300 }, NOW)).rejects.toMatchObject({ code: 'watch_not_found' });
    prismaMock.groupVideoWatch.findUnique.mockResolvedValueOnce(watch({ challengeId: 'c2' }));
    await expect(completeVideoWatch('u1', 'g1', 'c1', { watchId: 'w1', watchedSeconds: 300 }, NOW)).rejects.toMatchObject({ code: 'watch_not_found' });
    expect(prismaMock.groupVideoSession.create).not.toHaveBeenCalled();
  });

  it('loses cleanly when two requests use the same viewing at once', async () => {
    prismaMock.groupVideoWatch.updateMany.mockResolvedValue({ count: 0 });
    await expect(completeVideoWatch('u1', 'g1', 'c1', { watchId: 'w1', watchedSeconds: 300 }, NOW)).rejects.toMatchObject({ code: 'watch_not_found' });
    expect(prismaMock.groupVideoSession.create).not.toHaveBeenCalled();
  });

  it('only a participant of a running video challenge can finish', async () => {
    prismaMock.groupChallengeParticipant.findUnique.mockResolvedValueOnce(null);
    await expect(completeVideoWatch('u1', 'g1', 'c1', { watchId: 'w1', watchedSeconds: 300 }, NOW)).rejects.toMatchObject({ code: 'not_participant' });
    await expect(completeVideoWatch('u1', 'g1', 'c1', { watchId: 'w1', watchedSeconds: 300 }, new Date('2026-10-20T00:00:00Z'))).rejects.toMatchObject({ code: 'not_active' });
  });
});

describe('error mapping', () => {
  it.each([
    ['watch_not_found', 404],
    ['not_member', 404],
    ['not_video', 400],
    ['not_active', 400],
    ['not_participant', 400],
    ['too_early', 400],
    ['not_watched', 400],
    ['expired', 400],
  ] as const)('%s → %i', (code, status) => {
    expect(groupChallengeErrorResponse(new GroupChallengeError(code, 'x'))!.status).toBe(status);
  });
});
