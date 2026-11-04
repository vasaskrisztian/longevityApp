import { describe, it, expect, vi } from 'vitest';
import { fetchYouTubeMetadata, parseIsoDuration, parseWatchPage } from '@/lib/video/youtube-metadata';

const page = (extra = '') =>
  `<html><head><meta name="title" content="5 Minute &amp; Desk &quot;Stretch&quot;">${extra}</head><body><script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"dQw4w9WgXcQ","lengthSeconds":"312","isLive":false}};</script></body></html>`;

describe('parseIsoDuration', () => {
  it('reads hours, minutes and seconds', () => {
    expect(parseIsoDuration('PT5M3S')).toBe(303);
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723);
    expect(parseIsoDuration('PT45S')).toBe(45);
    expect(parseIsoDuration('PT10M')).toBe(600);
  });
  it('rejects anything else (live streams report P0D)', () => {
    for (const value of ['P0D', 'PT', '', 'abc', 'P1DT2H']) expect(parseIsoDuration(value)).toBeNull();
  });
});

describe('parseWatchPage', () => {
  it('finds the length and the decoded title', () => {
    expect(parseWatchPage(page())).toEqual({ durationSec: 312, title: '5 Minute & Desk "Stretch"' });
  });
  it('falls back to the schema.org duration', () => {
    const html = '<meta itemprop="duration" content="PT4M10S"><meta property="og:title" content="Stretch">';
    expect(parseWatchPage(html)).toEqual({ durationSec: 250, title: 'Stretch' });
  });
  it('has no result without a usable length (consent page, live stream, removed video)', () => {
    expect(parseWatchPage('<html>Before you continue to YouTube</html>')).toBeNull();
    expect(parseWatchPage('{"lengthSeconds":"0"}')).toBeNull();
  });
});

describe('fetchYouTubeMetadata', () => {
  const ok = (body: string) => new Response(body, { status: 200 });

  it('uses the Data API when a key is set', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({ items: [{ contentDetails: { duration: 'PT5M12S' }, snippet: { title: 'API title' } }] }),
    );
    const result = await fetchYouTubeMetadata('dQw4w9WgXcQ', { apiKey: 'k', fetchImpl });
    expect(result).toEqual({ durationSec: 312, title: 'API title' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]![0])).toContain('googleapis.com/youtube/v3/videos');
  });

  it('falls back to the watch page when the API fails or finds nothing', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('quota', { status: 403 }))
      .mockResolvedValueOnce(ok(page()));
    expect(await fetchYouTubeMetadata('dQw4w9WgXcQ', { apiKey: 'k', fetchImpl })).toMatchObject({ durationSec: 312 });

    const empty = vi.fn().mockResolvedValueOnce(Response.json({ items: [] })).mockResolvedValueOnce(ok(page()));
    expect(await fetchYouTubeMetadata('dQw4w9WgXcQ', { apiKey: 'k', fetchImpl: empty })).toMatchObject({ durationSec: 312 });

    const throwing = vi.fn().mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce(ok(page()));
    expect(await fetchYouTubeMetadata('dQw4w9WgXcQ', { apiKey: 'k', fetchImpl: throwing })).toMatchObject({ durationSec: 312 });
  });

  it('reads the watch page directly without a key, sending the consent cookie', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok(page()));
    const result = await fetchYouTubeMetadata('dQw4w9WgXcQ', { apiKey: null, fetchImpl });
    expect(result).toMatchObject({ durationSec: 312 });
    expect(String(fetchImpl.mock.calls[0]![0])).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect((fetchImpl.mock.calls[0]![1] as RequestInit).headers).toMatchObject({ Cookie: expect.stringContaining('CONSENT') });
  });

  it('is null when nothing works', async () => {
    expect(await fetchYouTubeMetadata('dQw4w9WgXcQ', { apiKey: null, fetchImpl: vi.fn().mockResolvedValue(new Response('x', { status: 404 })) })).toBeNull();
    expect(await fetchYouTubeMetadata('dQw4w9WgXcQ', { apiKey: null, fetchImpl: vi.fn().mockRejectedValue(new Error('timeout')) })).toBeNull();
    expect(await fetchYouTubeMetadata('dQw4w9WgXcQ', { apiKey: null, fetchImpl: vi.fn().mockResolvedValue(ok('<html>consent</html>')) })).toBeNull();
  });
});
