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

const getWeeklyWorkoutCountMock = vi.fn();
vi.mock('@/modules/dashboard/dashboard.service', () => ({
  getWeeklyWorkoutCount: getWeeklyWorkoutCountMock,
}));

const getActiveProtocolMock = vi.fn();
vi.mock('@/modules/protocols/protocols.service', () => ({
  getActiveProtocol: getActiveProtocolMock,
}));

const { GET } = await import('@/app/api/dashboard/protocol-overlay/route');

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  getWeeklyWorkoutCountMock.mockReset();
  getActiveProtocolMock.mockReset();
});

describe('GET /api/dashboard/protocol-overlay', () => {
  it('returns 401 and never calls either service when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET();

    expect(response.status).toBe(401);
    expect(getActiveProtocolMock).not.toHaveBeenCalled();
    expect(getWeeklyWorkoutCountMock).not.toHaveBeenCalled();
  });

  it('propagates a 403 the same way as any other authorization failure', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new ForbiddenError('nope'));

    const response = await GET();

    expect(response.status).toBe(403);
    expect(getActiveProtocolMock).not.toHaveBeenCalled();
    expect(getWeeklyWorkoutCountMock).not.toHaveBeenCalled();
  });

  it("fetches both scoped to the caller's own id — never a client-supplied id", async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getActiveProtocolMock.mockResolvedValue(null);
    getWeeklyWorkoutCountMock.mockResolvedValue(0);

    const response = await GET();

    expect(getActiveProtocolMock).toHaveBeenCalledWith('u1');
    expect(getWeeklyWorkoutCountMock).toHaveBeenCalledWith('u1');
    expect(response.status).toBe(200);
  });

  it('returns both results in one body when the user has an active protocol', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    const protocol = {
      id: 'p1',
      name: 'Base protocol',
      description: null,
      isActive: true,
      targetSleepScore: 85,
      targetSleepMinutes: 480,
      targetWeeklyWorkouts: 4,
      targetDailyActiveCalories: 500,
      visibility: 'PRIVATE',
      supplements: [],
    };
    getActiveProtocolMock.mockResolvedValue(protocol);
    getWeeklyWorkoutCountMock.mockResolvedValue(3);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ activeProtocol: protocol, weeklyWorkoutCount: 3 });
  });

  it('returns a null activeProtocol (still 200) when the user has none active', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getActiveProtocolMock.mockResolvedValue(null);
    getWeeklyWorkoutCountMock.mockResolvedValue(2);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ activeProtocol: null, weeklyWorkoutCount: 2 });
  });
});
