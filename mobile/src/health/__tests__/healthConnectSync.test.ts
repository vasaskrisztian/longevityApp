import type { AppleHealthDailySample } from '../aggregate';

const mockNative = {
  availability: jest.fn(),
  getAccess: jest.fn(),
  requestAccess: jest.fn(),
  readDailySummaries: jest.fn(),
};
jest.mock('../healthConnectNative', () => ({
  __esModule: true,
  get default() {
    return mockNative;
  },
}));

// sync.ts (for syncWindowDays) pulls in the iOS HealthKit module — keep it out of the test.
jest.mock('../native', () => ({ __esModule: true, default: {} }));

const mockIngest = jest.fn();
jest.mock('@/src/api/healthConnect', () => ({
  ingestHealthConnect: (...args: unknown[]) => mockIngest(...args),
}));

import { syncHealthConnect } from '../healthConnectSync';
import { BACKFILL_DAYS } from '../sync';

const days = (n: number): AppleHealthDailySample[] =>
  Array.from({ length: n }, (_, i) => ({ date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, steps: i }));

const NOW = new Date(2026, 10, 6, 12, 0, 0);

beforeEach(() => {
  mockNative.availability.mockReset().mockResolvedValue('available');
  mockNative.getAccess.mockReset().mockResolvedValue({ granted: true, background: false, history: true });
  mockNative.requestAccess.mockReset().mockResolvedValue({ granted: true, background: false, history: true });
  mockNative.readDailySummaries.mockReset().mockResolvedValue(days(3));
  mockIngest.mockReset().mockResolvedValue({ connectionId: 'c', recordsCreated: 3, recordsUpdated: 0, datesUpserted: 3 });
});

describe('syncHealthConnect', () => {
  it('does nothing outside Android', async () => {
    mockNative.availability.mockResolvedValue('unsupported');

    await expect(syncHealthConnect(null, { now: NOW })).resolves.toEqual({ status: 'unsupported' });
    expect(mockNative.getAccess).not.toHaveBeenCalled();
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it('reports why Health Connect cannot be used and reads nothing', async () => {
    mockNative.availability.mockResolvedValue('update_required');

    await expect(syncHealthConnect(null, { now: NOW })).resolves.toEqual({
      status: 'unavailable',
      availability: 'update_required',
    });
    expect(mockNative.readDailySummaries).not.toHaveBeenCalled();
  });

  it('automatic runs never show the permission screen and stop when access is missing', async () => {
    mockNative.getAccess.mockResolvedValue({ granted: false, background: false, history: false });

    await expect(syncHealthConnect('2026-11-05T08:00:00Z', { interactive: false, now: NOW })).resolves.toEqual({
      status: 'no_permission',
    });
    expect(mockNative.requestAccess).not.toHaveBeenCalled();
    expect(mockNative.readDailySummaries).not.toHaveBeenCalled();
  });

  it('interactive runs ask for access first, and stop when the person refuses', async () => {
    mockNative.requestAccess.mockResolvedValue({ granted: false, background: false, history: false });

    await expect(syncHealthConnect(null, { interactive: true, now: NOW })).resolves.toEqual({ status: 'no_permission' });
    expect(mockNative.requestAccess).toHaveBeenCalledTimes(1);
    expect(mockNative.getAccess).not.toHaveBeenCalled();
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it('backfills 90 days the first time and reads from the last sync afterwards', async () => {
    await syncHealthConnect(null, { now: NOW });
    const [firstFrom, firstTo] = mockNative.readDailySummaries.mock.calls[0];
    expect(Math.round((firstTo.getTime() - firstFrom.getTime()) / 86_400_000)).toBe(BACKFILL_DAYS - 1);

    mockNative.readDailySummaries.mockClear();
    await syncHealthConnect('2026-11-05T08:00:00Z', { now: NOW });
    const [from, to] = mockNative.readDailySummaries.mock.calls[0];
    expect(Math.round((to.getTime() - from.getTime()) / 86_400_000)).toBe(6); // the 7-day minimum window
  });

  it('uploads nothing when there is no data', async () => {
    mockNative.readDailySummaries.mockResolvedValue([]);

    await expect(syncHealthConnect(null, { now: NOW })).resolves.toEqual({ status: 'no_data' });
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it('uploads in batches of at most 180 days and reports the count', async () => {
    mockNative.readDailySummaries.mockResolvedValue(days(400));

    const outcome = await syncHealthConnect(null, { now: NOW });

    expect(mockIngest.mock.calls.map((c) => c[0].length)).toEqual([180, 180, 40]);
    expect(outcome).toMatchObject({ status: 'synced', days: 400 });
  });

  it('lets an upload error (for example the rate limit) reach the caller', async () => {
    mockIngest.mockRejectedValue(new Error('429'));

    await expect(syncHealthConnect(null, { now: NOW })).rejects.toThrow('429');
  });
});
