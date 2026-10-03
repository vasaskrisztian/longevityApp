import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthenticatedError, ForbiddenError } from '@/lib/auth/errors';

const requireAuthenticatedUserMock = vi.fn();
function toErrorResponse(error: unknown): Response {
  if (error instanceof UnauthenticatedError || error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  throw error;
}
vi.mock('@/lib/auth/authorization', () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock,
  toErrorResponse,
}));

const checkRateLimitMock = vi.fn();
vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock,
  APPLE_HEALTH_INGEST_RATE_LIMIT: { windowMs: 60 * 1000, max: 2 },
}));

const upsertConnectionAsConnectedMock = vi.fn();
const recordSyncOutcomeMock = vi.fn();
vi.mock('@/modules/wearable/services/wearable.service', () => ({
  upsertConnectionAsConnected: upsertConnectionAsConnectedMock,
  recordSyncOutcome: recordSyncOutcomeMock,
}));

const storeRawRecordsMock = vi.fn();
vi.mock('@/modules/wearable/services/raw-record.service', () => ({
  storeRawRecords: storeRawRecordsMock,
}));

const normalizeAndUpsertDailyMetricsMock = vi.fn();
vi.mock('@/modules/wearable/services/normalization.service', () => ({
  normalizeAndUpsertDailyMetrics: normalizeAndUpsertDailyMetricsMock,
}));

const { POST } = await import('@/app/api/integrations/apple-health/ingest/route');

function request(body: unknown): Request {
  return new Request('https://app.example.com/api/integrations/apple-health/ingest', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 1, resetAt: Date.now() + 60_000 });
  upsertConnectionAsConnectedMock.mockResolvedValue({ id: 'conn-ah-1' });
  storeRawRecordsMock.mockResolvedValue({ created: 1, updated: 0 });
  normalizeAndUpsertDailyMetricsMock.mockResolvedValue({ datesUpserted: 1 });
  recordSyncOutcomeMock.mockResolvedValue(undefined);
});

describe('POST /api/integrations/apple-health/ingest', () => {
  it('returns 401 and never touches rate limiting or storage when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await POST(request({ samples: [{ date: '2026-01-15', steps: 1000 }] }));

    expect(response.status).toBe(401);
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(storeRawRecordsMock).not.toHaveBeenCalled();
  });

  it('propagates a 403 the same way as any other authorization failure', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new ForbiddenError('nope'));

    const response = await POST(request({ samples: [{ date: '2026-01-15' }] }));

    expect(response.status).toBe(403);
  });

  it('rate-limits per authenticated userId, not per IP', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    await POST(request({ samples: [{ date: '2026-01-15', steps: 500 }] }));

    expect(checkRateLimitMock).toHaveBeenCalledWith('apple-health-ingest', 'u1', { windowMs: 60_000, max: 2 });
  });

  it('returns 429 and never touches storage when the rate limit is exceeded', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    checkRateLimitMock.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 10_000 });

    const response = await POST(request({ samples: [{ date: '2026-01-15' }] }));

    expect(response.status).toBe(429);
    expect(upsertConnectionAsConnectedMock).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    const badRequest = new Request('https://app.example.com/api/integrations/apple-health/ingest', {
      method: 'POST',
      body: '{not json',
    });

    const response = await POST(badRequest);

    expect(response.status).toBe(400);
    expect(upsertConnectionAsConnectedMock).not.toHaveBeenCalled();
  });

  it('returns 400 with structured Zod field errors for an invalid body, never touching storage', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await POST(request({ samples: [{ date: 'not-a-date' }] }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
    expect(upsertConnectionAsConnectedMock).not.toHaveBeenCalled();
  });

  it('rejects an empty samples array', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await POST(request({ samples: [] }));

    expect(response.status).toBe(400);
  });

  it('on success: upserts the connection as CONNECTED, stores raw records, normalizes daily metrics, records SUCCESS, and returns a summary', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    storeRawRecordsMock.mockResolvedValue({ created: 2, updated: 1 });
    normalizeAndUpsertDailyMetricsMock.mockResolvedValue({ datesUpserted: 3 });

    const response = await POST(
      request({
        samples: [
          { date: '2026-01-15', steps: 8000, restingHeartRate: 58 },
          { date: '2026-01-16', totalSleepMinutes: 420 },
        ],
      }),
    );

    expect(upsertConnectionAsConnectedMock).toHaveBeenCalledWith({
      userId: 'u1',
      provider: 'APPLE_HEALTH',
      grantedScopes: [],
    });

    expect(storeRawRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        connectionId: 'conn-ah-1',
        provider: 'APPLE_HEALTH',
        records: expect.arrayContaining([
          expect.objectContaining({ dataType: 'OTHER', externalId: 'daily-summary-2026-01-15' }),
          expect.objectContaining({ dataType: 'OTHER', externalId: 'daily-summary-2026-01-16' }),
        ]),
      }),
    );

    expect(normalizeAndUpsertDailyMetricsMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', provider: 'APPLE_HEALTH' }),
    );
    expect(normalizeAndUpsertDailyMetricsMock.mock.calls[0]?.[0].adapter.mapToNormalizedFields).toBeInstanceOf(
      Function,
    );

    expect(recordSyncOutcomeMock).toHaveBeenCalledWith('conn-ah-1', 'SUCCESS');

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ connectionId: 'conn-ah-1', recordsCreated: 2, recordsUpdated: 1, datesUpserted: 3 });
  });
});
