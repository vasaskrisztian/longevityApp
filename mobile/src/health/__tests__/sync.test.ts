import type { AppleHealthDailySample } from '../aggregate';

const mockNative = {
  isSupported: jest.fn(),
  requestAccess: jest.fn(),
  readDailySummaries: jest.fn(),
};
jest.mock('../native', () => ({
  __esModule: true,
  get default() {
    return mockNative;
  },
}));

const mockIngest = jest.fn();
jest.mock('@/src/api/appleHealth', () => ({
  ingestAppleHealth: (...args: unknown[]) => mockIngest(...args),
}));

import { BACKFILL_DAYS, RECENT_DAYS, syncAppleHealth, syncWindowDays } from '../sync';

const days = (n: number): AppleHealthDailySample[] =>
  Array.from({ length: n }, (_, i) => ({ date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, steps: i }));

beforeEach(() => {
  mockNative.isSupported.mockReset().mockResolvedValue(true);
  mockNative.requestAccess.mockReset().mockResolvedValue(true);
  mockNative.readDailySummaries.mockReset();
  mockIngest.mockReset().mockResolvedValue({ connectionId: 'c', recordsCreated: 1, recordsUpdated: 0, datesUpserted: 1 });
});

describe('syncWindowDays', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  it('backfills on first sync or an unparseable timestamp', () => {
    expect(syncWindowDays(null, now)).toBe(BACKFILL_DAYS);
    expect(syncWindowDays(undefined, now)).toBe(BACKFILL_DAYS);
    expect(syncWindowDays('garbage', now)).toBe(BACKFILL_DAYS);
  });
  it('uses at least the recent window and at most the backfill window', () => {
    expect(syncWindowDays('2026-10-08T11:00:00Z', now)).toBe(RECENT_DAYS);
    expect(syncWindowDays('2026-09-28T12:00:00Z', now)).toBe(11);
    expect(syncWindowDays('2025-01-01T00:00:00Z', now)).toBe(BACKFILL_DAYS);
  });
});

describe('syncAppleHealth', () => {
  it('does nothing (and never asks for permission) when HealthKit is unsupported', async () => {
    mockNative.isSupported.mockResolvedValue(false);
    await expect(syncAppleHealth(null)).resolves.toEqual({ status: 'unsupported' });
    expect(mockNative.requestAccess).not.toHaveBeenCalled();
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it('requests access BEFORE reading, and uploads nothing when there is no data', async () => {
    const order: string[] = [];
    mockNative.requestAccess.mockImplementation(async () => void order.push('request'));
    mockNative.readDailySummaries.mockImplementation(async () => {
      order.push('read');
      return [];
    });
    await expect(syncAppleHealth(null)).resolves.toEqual({ status: 'no_data' });
    expect(order).toEqual(['request', 'read']);
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it('reads the right window and uploads the samples', async () => {
    const now = new Date(2026, 9, 8, 12, 0);
    mockNative.readDailySummaries.mockResolvedValue(days(3));
    const outcome = await syncAppleHealth(new Date(2026, 9, 7, 8).toISOString(), now);
    expect(outcome).toMatchObject({ status: 'synced', days: 3 });
    const [from, to] = mockNative.readDailySummaries.mock.calls[0];
    expect(to).toBe(now);
    expect(from.getFullYear()).toBe(2026);
    expect(from.getMonth()).toBe(9);
    expect(from.getDate()).toBe(2); // RECENT_DAYS = 7 -> Oct 2..Oct 8
    expect(mockIngest).toHaveBeenCalledTimes(1);
    expect(mockIngest.mock.calls[0][0]).toHaveLength(3);
  });

  it('splits uploads into batches of at most 180 days', async () => {
    mockNative.readDailySummaries.mockResolvedValue(days(200));
    await syncAppleHealth(null);
    expect(mockIngest.mock.calls.map((c) => c[0].length)).toEqual([180, 20]);
  });

  it('propagates upload failures to the caller', async () => {
    mockNative.readDailySummaries.mockResolvedValue(days(1));
    mockIngest.mockRejectedValue(new Error('boom'));
    await expect(syncAppleHealth(null)).rejects.toThrow('boom');
  });
});
