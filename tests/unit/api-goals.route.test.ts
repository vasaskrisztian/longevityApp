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

const listGoalsMock = vi.fn();
const createGoalMock = vi.fn();
vi.mock('@/modules/goals/goals.service', () => ({
  listGoals: listGoalsMock,
  createGoal: createGoalMock,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { GET, POST } = await import('@/app/api/goals/route');

const VALID_GOAL = { type: 'WEIGHT_LOSS', name: 'Lose 5kg' };

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/goals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  listGoalsMock.mockReset();
  createGoalMock.mockReset();
});

describe('GET /api/goals', () => {
  it('returns 401 when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET();

    expect(response.status).toBe(401);
    expect(listGoalsMock).not.toHaveBeenCalled();
  });

  it('lists goals scoped to the caller\'s own id', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    listGoalsMock.mockResolvedValue([{ id: 'g1' }]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(listGoalsMock).toHaveBeenCalledWith('u1');
    const body = await response.json();
    expect(body).toEqual([{ id: 'g1' }]);
  });
});

describe('POST /api/goals', () => {
  it('returns 401 and never calls the service when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await POST(postRequest(VALID_GOAL));

    expect(response.status).toBe(401);
    expect(createGoalMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid payload (missing name)', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await POST(postRequest({ ...VALID_GOAL, name: '' }));

    expect(response.status).toBe(400);
    expect(createGoalMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an unparsable JSON body', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    const badRequest = new Request('http://localhost/api/goals', { method: 'POST', body: 'not json' });

    const response = await POST(badRequest);

    expect(response.status).toBe(400);
  });

  it('creates a goal scoped to the caller\'s own id and returns 201', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    createGoalMock.mockResolvedValue({ id: 'g1', userId: 'u1', ...VALID_GOAL, status: 'ACTIVE' });

    const response = await POST(postRequest(VALID_GOAL));

    expect(response.status).toBe(201);
    expect(createGoalMock).toHaveBeenCalledWith('u1', expect.objectContaining({ name: 'Lose 5kg' }));
  });

  it('returns 500 when the service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    createGoalMock.mockRejectedValue(new Error('db down'));

    const response = await POST(postRequest(VALID_GOAL));

    expect(response.status).toBe(500);
  });
});
