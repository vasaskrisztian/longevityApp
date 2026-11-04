import { parseVideoDuration, formatVideoDuration, looksLikeYouTubeUrl, validateGoal, goalPayload } from '../challengeForm';
import { WatchTracker, buildPlayerHtml, isVideoId, playerErrorMessage, watchedLabel, WATCH_RATIO, type PlayerTick } from '../videoWatch';
import { collectiveAmountLabel, collectiveLine } from '../format';

const play = (position: number, state: PlayerTick['state'] = 'playing', rate = 1): PlayerTick => ({ state, position, rate });

describe('WatchTracker', () => {
  it('adds up the seconds of normal playing', () => {
    const t = new WatchTracker();
    [0, 1, 2, 3, 4, 5].forEach((p) => t.update(play(p)));
    expect(t.watchedSeconds).toBe(5);
    expect(t.ended).toBe(false);
  });

  it('does not count a jump ahead, and counts nothing for the first report', () => {
    const t = new WatchTracker();
    t.update(play(0));
    t.update(play(1));
    t.update(play(120)); // seek
    t.update(play(121));
    expect(t.watchedSeconds).toBe(2);
  });

  it('does not count pauses, buffering or going back', () => {
    const t = new WatchTracker();
    t.update(play(10));
    t.update(play(11));
    t.update(play(11, 'paused'));
    t.update(play(11, 'paused'));
    t.update(play(11, 'playing')); // resumed — the step from "paused" is not counted
    t.update(play(12));
    t.update(play(5)); // backwards
    t.update(play(6));
    expect(t.watchedSeconds).toBe(3);
  });

  it('counts nothing at another speed', () => {
    const t = new WatchTracker();
    [0, 2, 4, 6].forEach((p) => t.update(play(p, 'playing', 2)));
    expect(t.watchedSeconds).toBe(0);
  });

  it('is complete only when the end was reached and about 90% really played', () => {
    const t = new WatchTracker();
    for (let p = 0; p <= 270; p += 1) t.update(play(p));
    expect(t.isComplete(300)).toBe(false); // not ended yet
    t.update(play(271, 'ended'));
    expect(t.watchedSeconds).toBe(270);
    expect(t.isComplete(300)).toBe(true);
    expect(t.isComplete(400)).toBe(false);
    expect(WATCH_RATIO).toBe(0.9);
  });

  it('skipping to the end gives no completion', () => {
    const t = new WatchTracker();
    t.update(play(0));
    t.update(play(1));
    t.update(play(299, 'ended'));
    expect(t.ended).toBe(true);
    expect(t.isComplete(300)).toBe(false);
  });

  it('can be reset for another viewing', () => {
    const t = new WatchTracker();
    t.update(play(0));
    t.update(play(1));
    t.reset();
    expect(t).toMatchObject({ watchedSeconds: 0, ended: false });
    t.update(play(2));
    t.update(play(3));
    expect(t.watchedSeconds).toBe(1);
  });
});

describe('player page', () => {
  it('embeds only a plain video id', () => {
    expect(isVideoId('dQw4w9WgXcQ')).toBe(true);
    expect(isVideoId('dQw4w9WgXc')).toBe(false);
    expect(isVideoId("x');alert(1);//")).toBe(false);
    expect(() => buildPlayerHtml("x');alert(1);//")).toThrow();
    const html = buildPlayerHtml('dQw4w9WgXcQ');
    expect(html).toContain("videoId:'dQw4w9WgXcQ'");
    expect(html).toContain('youtube-nocookie.com');
    expect(html).toContain('setPlaybackRate(1)');
  });
  it('explains embed errors', () => {
    expect(playerErrorMessage(150)).toMatch(/cannot be played inside the app/);
    expect(playerErrorMessage(100)).toMatch(/not available/);
    expect(playerErrorMessage(5)).toMatch(/could not be played/);
  });
  it('labels the progress', () => {
    expect(watchedLabel(83, 300, formatVideoDuration)).toBe('1:23 of 5:00');
    expect(watchedLabel(999, 300, formatVideoDuration)).toBe('5:00 of 5:00');
  });
});

describe('video durations', () => {
  it('parses m:ss, h:mm:ss and plain minutes', () => {
    expect(parseVideoDuration('5:00')).toBe(300);
    expect(parseVideoDuration('12:34')).toBe(754);
    expect(parseVideoDuration('1:02:30')).toBe(3750);
    expect(parseVideoDuration('5')).toBe(300);
    expect(parseVideoDuration(' 0:30 ')).toBe(30);
  });
  it('rejects nonsense and out-of-range lengths', () => {
    for (const text of ['', 'abc', '5:7', '5:60', '0:05', '0', '241', '4:00:01', '-3']) expect(parseVideoDuration(text)).toBeNull();
    expect(parseVideoDuration('4:00:00')).toBe(14400);
  });
  it('formats seconds back', () => {
    expect(formatVideoDuration(300)).toBe('5:00');
    expect(formatVideoDuration(65)).toBe('1:05');
    expect(formatVideoDuration(3725)).toBe('1:02:05');
  });
});

describe('video challenge form', () => {
  const values = {
    mode: 'INDIVIDUAL' as const,
    type: 'VIDEO_SESSIONS' as const,
    threshold: '0',
    requiredCount: '10',
    targetTotal: '100',
    videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
    videoTitle: '',
    videoDuration: '5:00',
  };
  it('recognises YouTube links', () => {
    expect(looksLikeYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    expect(looksLikeYouTubeUrl('www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(looksLikeYouTubeUrl('https://vimeo.com/123')).toBe(false);
    expect(looksLikeYouTubeUrl('https://youtube.com.evil.com/watch?v=x')).toBe(false);
    expect(looksLikeYouTubeUrl('')).toBe(false);
  });
  it('needs the link and the length, but no threshold', () => {
    expect(validateGoal(values)).toEqual({});
    expect(validateGoal({ ...values, videoUrl: '' })).toEqual({ videoUrl: expect.any(String) });
    expect(validateGoal({ ...values, videoUrl: 'https://vimeo.com/1' })).toEqual({ videoUrl: expect.any(String) });
    expect(validateGoal({ ...values, videoDuration: 'x' })).toEqual({ videoDuration: expect.any(String) });
    expect(validateGoal({ ...values, videoDuration: '' })).toEqual({}); // optional: read from YouTube
    expect(validateGoal({ ...values, videoDuration: '  ' })).toEqual({});
    expect(validateGoal({ ...values, requiredCount: '0' })).toEqual({ requiredCount: expect.any(String) });
  });
  it('leaves the length out of the request when it is empty (the server reads it from YouTube)', () => {
    expect(goalPayload({ ...values, videoDuration: '' })).toEqual({ mode: 'INDIVIDUAL', requiredCount: 10, videoUrl: 'https://youtu.be/dQw4w9WgXcQ' });
  });
  it('builds the request body, personal and team', () => {
    expect(goalPayload(values)).toEqual({ mode: 'INDIVIDUAL', requiredCount: 10, videoUrl: 'https://youtu.be/dQw4w9WgXcQ', videoDurationSec: 300 });
    expect(goalPayload({ ...values, mode: 'COLLECTIVE', videoTitle: ' Desk stretch ' })).toEqual({
      mode: 'COLLECTIVE',
      targetTotal: 100,
      videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
      videoTitle: 'Desk stretch',
      videoDurationSec: 300,
    });
  });
  it('team totals are counted in video sessions', () => {
    expect(collectiveAmountLabel('VIDEO_SESSIONS', 1)).toBe('1 video session');
    expect(collectiveAmountLabel('VIDEO_SESSIONS', 40)).toBe('40 video sessions');
    expect(collectiveLine('VIDEO_SESSIONS', { total: 40, targetTotal: 200, percent: 20, reached: false })).toBe('40 of 200 sessions · 20%');
  });
});
