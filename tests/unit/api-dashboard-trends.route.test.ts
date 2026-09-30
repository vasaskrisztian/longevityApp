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
  UnauthenticatedError,
  ForbiddenError,
}));

const getTrendMock = vi.fn();
// Mirrors the real toTrendPointDTO (dashboard.service.ts): serializes `date`
// to a plain yyyy-mm-dd string, the exact behavior the "Invalid Date" trend
// chart bug fix depends on (see that file's comment on toTrendPointDTO).
function toTrendPointDTOMock(point: { date: Date; [key: string]: unknown }) {
  return { ...point, date: point.date.toISOString().slice(0, 10) };
}
vi.mock('@/modules/dashboard/dashboard.service', () => ({
  getTrend: getTrendMock,
  toTrendPointDTO: toTrendPointDTOMock,
}));

const { GET } = await import('@/app/api/dashboard/trends/route');

function req(query = ''): Request {
  return new Request(`https://example.com/api/dashboard/trends${query}`);
}

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  getTrendMock.mockReset();
});

describe('GET /api/dashboard/trends', () => {
  it('returns 401 and never calls the service when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET(req());

    expect(response.status).toBe(401);
    expect(getTrendMock).not.toHaveBeenCalled();
  });

  it('propagates a 403 the same way as any other authorization failure', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new ForbiddenError('nope'));

    const response = await GET(req());

    expect(response.status).toBe(403);
    expect(getTrendMock).not.toHaveBeenCalled();
  });

  it('defaults to a 7-day range when no ?range is given', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getTrendMock.mockResolvedValue([]);

    const response = await GET(req());

    expect(response.status).toBe(200);
    expect(getTrendMock).toHaveBeenCalledWith('u1', 7);
  });

  it('passes rangeDays=30 as a number when ?range=30', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getTrendMock.mockResolvedValue([]);

    await GET(req('?range=30'));

    expect(getTrendMock).toHaveBeenCalledWith('u1', 30);
  });

  it('rejects an out-of-enum range value with 400 and never calls the service', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await GET(req('?range=14'));

    expect(response.status).toBe(400);
    expect(getTrendMock).not.toHaveBeenCalled();
  });

  it('scopes the trend query to the caller\'s own id — never a client-supplied id', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getTrendMock.mockResolvedValue([{ date: new Date('2026-06-15'), sleepScore: 80 }]);

    const response = await GET(req('?range=7'));

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(getTrendMock.mock.calls[0]![0]).toBe('u1');
  });

  it('serializes each point\'s date as a plain yyyy-mm-dd string, not a full ISO datetime', async () => {
    // Regression test: this route used to return raw Date objects, which
    // Response.json serializes to a full ISO *datetime* string
    // ("2026-06-15T00:00:00.000Z") -- trend-charts.tsx's formatDateLabel
    // assumed a date-only string and appended its own "T00:00:00Z" suffix,
    // producing a malformed, doubly-suffixed string that silently parsed as
    // Invalid Date on every chart's x-axis after a 7/30-day range switch.
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getTrendMock.mockResolvedValue([{ date: new Date('2026-06-15T00:00:00.000Z'), sleepScore: 80 }]);

    const response = await GET(req('?range=7'));

    const body = await response.json();
    expect(body[0].date).toBe('2026-06-15');
  });
});
