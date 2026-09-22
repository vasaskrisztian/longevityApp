import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthenticatedError, ForbiddenError } from '@/lib/auth/errors';

const requireAuthenticatedUserMock = vi.fn();
const requireOwnResourceOrAdminMock = vi.fn();

function toErrorResponse(error: unknown): Response {
  if (error instanceof UnauthenticatedError || error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  throw error;
}

vi.mock('@/lib/auth/authorization', () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock,
  requireOwnResourceOrAdmin: requireOwnResourceOrAdminMock,
  toErrorResponse,
  UnauthenticatedError,
  ForbiddenError,
}));

const getGoalByIdMock = vi.fn();
const updateGoalMock = vi.fn();
const deleteGoalMock = vi.fn();
vi.mock('@/modules/goals/goals.service', () => ({
  getGoalById: getGoalByIdMock,
  updateGoal: updateGoalMock,
  deleteGoal: deleteGoalMock,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { GET, PATCH, DELETE } = await import('@/app/api/goals/[id]/route');

const OWNED_GOAL = { id: 'g1', userId: 'u1', type: 'WEIGHT_LOSS', name: 'Lose 5kg', status: 'ACTIVE' };

function ctx(id: string) {
  return { params: { id } };
}

function patchRequest(body: unknown): Request {
  return new Request('http://localhost/api/goals/g1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  requireOwnResourceOrAdminMock.mockReset();
  getGoalByIdMock.mockReset();
  updateGoalMock.mockReset();
  deleteGoalMock.mockReset();
});

describe('GET /api/goals/[id]', () => {
  it('returns 401 and never reads the resource when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET(new Request('http://localhost/api/goals/g1'), ctx('g1'));

    expect(response.status).toBe(401);
    expect(getGoalByIdMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a nonexistent id', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getGoalByIdMock.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/api/goals/missing'), ctx('missing'));

    expect(response.status).toBe(404);
    expect(requireOwnResourceOrAdminMock).not.toHaveBeenCalled();
  });

  it('returns 403 (IDOR/BOLA) when the caller does not own the resource and is not an admin', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u2', role: 'USER' });
    getGoalByIdMock.mockResolvedValue(OWNED_GOAL);
    requireOwnResourceOrAdminMock.mockRejectedValue(new ForbiddenError());

    const response = await GET(new Request('http://localhost/api/goals/g1'), ctx('g1'));

    expect(response.status).toBe(403);
  });

  it('returns 200 with the resource when the caller owns it', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getGoalByIdMock.mockResolvedValue(OWNED_GOAL);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await GET(new Request('http://localhost/api/goals/g1'), ctx('g1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe('g1');
  });

  it('returns 200 when an admin reads someone else\'s resource', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'admin1', role: 'ADMIN' });
    getGoalByIdMock.mockResolvedValue(OWNED_GOAL);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'admin1', role: 'ADMIN' });

    const response = await GET(new Request('http://localhost/api/goals/g1'), ctx('g1'));

    expect(response.status).toBe(200);
  });
});

describe('PATCH /api/goals/[id]', () => {
  it('returns 401 and never touches the resource when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await PATCH(patchRequest({ status: 'PAUSED' }), ctx('g1'));

    expect(response.status).toBe(401);
    expect(getGoalByIdMock).not.toHaveBeenCalled();
    expect(updateGoalMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a nonexistent id without calling update', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getGoalByIdMock.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ status: 'PAUSED' }), ctx('missing'));

    expect(response.status).toBe(404);
    expect(updateGoalMock).not.toHaveBeenCalled();
  });

  it('returns 403 and never calls update when the caller does not own the resource', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u2', role: 'USER' });
    getGoalByIdMock.mockResolvedValue(OWNED_GOAL);
    requireOwnResourceOrAdminMock.mockRejectedValue(new ForbiddenError());

    const response = await PATCH(patchRequest({ status: 'PAUSED' }), ctx('g1'));

    expect(response.status).toBe(403);
    expect(updateGoalMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid payload without calling update', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getGoalByIdMock.mockResolvedValue(OWNED_GOAL);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await PATCH(patchRequest({ status: 'DONE' }), ctx('g1'));

    expect(response.status).toBe(400);
    expect(updateGoalMock).not.toHaveBeenCalled();
  });

  it('updates the resource by id and returns 200 for an owner\'s valid request', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getGoalByIdMock.mockResolvedValue(OWNED_GOAL);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    updateGoalMock.mockResolvedValue({ ...OWNED_GOAL, status: 'PAUSED' });

    const response = await PATCH(patchRequest({ status: 'PAUSED' }), ctx('g1'));

    expect(response.status).toBe(200);
    expect(updateGoalMock).toHaveBeenCalledWith('g1', expect.objectContaining({ status: 'PAUSED' }));
  });

  it('returns 500 when the service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getGoalByIdMock.mockResolvedValue(OWNED_GOAL);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    updateGoalMock.mockRejectedValue(new Error('db down'));

    const response = await PATCH(patchRequest({ status: 'PAUSED' }), ctx('g1'));

    expect(response.status).toBe(500);
  });
});

describe('DELETE /api/goals/[id]', () => {
  it('returns 401 and never deletes when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await DELETE(new Request('http://localhost/api/goals/g1'), ctx('g1'));

    expect(response.status).toBe(401);
    expect(deleteGoalMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a nonexistent id without calling delete', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getGoalByIdMock.mockResolvedValue(null);

    const response = await DELETE(new Request('http://localhost/api/goals/missing'), ctx('missing'));

    expect(response.status).toBe(404);
    expect(deleteGoalMock).not.toHaveBeenCalled();
  });

  it('returns 403 and never calls delete when the caller does not own the resource', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u2', role: 'USER' });
    getGoalByIdMock.mockResolvedValue(OWNED_GOAL);
    requireOwnResourceOrAdminMock.mockRejectedValue(new ForbiddenError());

    const response = await DELETE(new Request('http://localhost/api/goals/g1'), ctx('g1'));

    expect(response.status).toBe(403);
    expect(deleteGoalMock).not.toHaveBeenCalled();
  });

  it('deletes the resource by id and returns 204 for the owner', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getGoalByIdMock.mockResolvedValue(OWNED_GOAL);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    deleteGoalMock.mockResolvedValue(undefined);

    const response = await DELETE(new Request('http://localhost/api/goals/g1'), ctx('g1'));

    expect(response.status).toBe(204);
    expect(deleteGoalMock).toHaveBeenCalledWith('g1');
  });

  it('returns 500 when the service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getGoalByIdMock.mockResolvedValue(OWNED_GOAL);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    deleteGoalMock.mockRejectedValue(new Error('db down'));

    const response = await DELETE(new Request('http://localhost/api/goals/g1'), ctx('g1'));

    expect(response.status).toBe(500);
  });
});
