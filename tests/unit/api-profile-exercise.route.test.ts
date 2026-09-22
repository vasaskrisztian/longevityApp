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

const upsertExerciseProfileMock = vi.fn();
vi.mock('@/modules/profile/profile.service', () => ({
  upsertExerciseProfile: upsertExerciseProfileMock,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { PATCH } = await import('@/app/api/profile/exercise/route');

const VALID_EXERCISE = { activityLevel: 'MODERATELY_ACTIVE', activityTypes: ['RUNNING'] };

function patchRequest(body: unknown): Request {
  return new Request('http://localhost/api/profile/exercise', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  upsertExerciseProfileMock.mockReset();
});

describe('PATCH /api/profile/exercise', () => {
  it('returns 401 and never calls the service when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await PATCH(patchRequest(VALID_EXERCISE));

    expect(response.status).toBe(401);
    expect(upsertExerciseProfileMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid activityLevel', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await PATCH(patchRequest({ activityLevel: 'LAZY' }));

    expect(response.status).toBe(400);
    expect(upsertExerciseProfileMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an unparsable JSON body', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    const badRequest = new Request('http://localhost/api/profile/exercise', {
      method: 'PATCH',
      body: 'not json',
    });

    const response = await PATCH(badRequest);

    expect(response.status).toBe(400);
  });

  it('upserts the exercise profile scoped to the caller\'s own id and returns 200', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    upsertExerciseProfileMock.mockResolvedValue({ id: 'e1', ...VALID_EXERCISE });

    const response = await PATCH(patchRequest(VALID_EXERCISE));

    expect(response.status).toBe(200);
    expect(upsertExerciseProfileMock).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ activityLevel: 'MODERATELY_ACTIVE' }),
    );
  });

  it('returns 500 when the service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    upsertExerciseProfileMock.mockRejectedValue(new Error('db down'));

    const response = await PATCH(patchRequest(VALID_EXERCISE));

    expect(response.status).toBe(500);
  });
});
