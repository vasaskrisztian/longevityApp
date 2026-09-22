import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchOuraDailyActivity,
  fetchOuraDailyReadiness,
  fetchOuraDailySleep,
  fetchOuraDailySpo2,
  fetchOuraHeartRate,
  fetchOuraWorkouts,
} from '@/modules/wearable/providers/oura/oura-api-client';

const FROM = new Date('2026-01-01T00:00:00Z');
const TO = new Date('2026-01-03T00:00:00Z');

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchOuraDailySleep', () => {
  it('sends the access token as a Bearer header and start_date/end_date as query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [], next_token: null }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchOuraDailySleep('token-abc', FROM, TO);

    const [url, init] = fetchMock.mock.calls[0]!;
    const parsed = new URL(url as string);
    expect(parsed.origin + parsed.pathname).toBe('https://api.ouraring.com/v2/usercollection/daily_sleep');
    expect(parsed.searchParams.get('start_date')).toBe('2026-01-01');
    expect(parsed.searchParams.get('end_date')).toBe('2026-01-03');
    expect((init as RequestInit).headers).toEqual({ Authorization: 'Bearer token-abc' });
  });

  it('returns the data array on a single-page response', async () => {
    const record = { id: 's1', day: '2026-01-01' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: [record], next_token: null })));

    const result = await fetchOuraDailySleep('token', FROM, TO);

    expect(result).toEqual([record]);
  });

  it('walks every page until next_token is null, concatenating all pages', async () => {
    const page1 = { data: [{ id: 's1' }], next_token: 'cursor-2' };
    const page2 = { data: [{ id: 's2' }], next_token: null };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(page1)).mockResolvedValueOnce(jsonResponse(page2));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchOuraDailySleep('token', FROM, TO);

    expect(result).toEqual([{ id: 's1' }, { id: 's2' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCallUrl = new URL(fetchMock.mock.calls[1]![0] as string);
    expect(secondCallUrl.searchParams.get('next_token')).toBe('cursor-2');
  });

  it('throws on a non-ok response, naming the endpoint and status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false, 500)));

    await expect(fetchOuraDailySleep('token', FROM, TO)).rejects.toThrow(
      'Oura daily_sleep request failed with status 500',
    );
  });
});

describe('the remaining five endpoint functions', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: 'x' }], next_token: null })));
  });

  it('fetchOuraDailyReadiness hits daily_readiness', async () => {
    await fetchOuraDailyReadiness('t', FROM, TO);
    const url = new URL((vi.mocked(fetch).mock.calls[0]![0] as string));
    expect(url.pathname).toBe('/v2/usercollection/daily_readiness');
  });

  it('fetchOuraDailyActivity hits daily_activity', async () => {
    await fetchOuraDailyActivity('t', FROM, TO);
    const url = new URL((vi.mocked(fetch).mock.calls[0]![0] as string));
    expect(url.pathname).toBe('/v2/usercollection/daily_activity');
  });

  it('fetchOuraHeartRate hits heartrate', async () => {
    await fetchOuraHeartRate('t', FROM, TO);
    const url = new URL((vi.mocked(fetch).mock.calls[0]![0] as string));
    expect(url.pathname).toBe('/v2/usercollection/heartrate');
  });

  it('fetchOuraWorkouts hits workout', async () => {
    await fetchOuraWorkouts('t', FROM, TO);
    const url = new URL((vi.mocked(fetch).mock.calls[0]![0] as string));
    expect(url.pathname).toBe('/v2/usercollection/workout');
  });

  it('fetchOuraDailySpo2 hits daily_spo2', async () => {
    await fetchOuraDailySpo2('t', FROM, TO);
    const url = new URL((vi.mocked(fetch).mock.calls[0]![0] as string));
    expect(url.pathname).toBe('/v2/usercollection/daily_spo2');
  });
});
