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

const upsertNutritionProfileMock = vi.fn();
vi.mock('@/modules/profile/profile.service', () => ({
  upsertNutritionProfile: upsertNutritionProfileMock,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { PATCH } = await import('@/app/api/profile/nutrition/route');

const VALID_NUTRITION = { dietType: 'OMNIVORE', allergies: ['peanuts'] };

function patchRequest(body: unknown): Request {
  return new Request('http://localhost/api/profile/nutrition', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  upsertNutritionProfileMock.mockReset();
});

describe('PATCH /api/profile/nutrition', () => {
  it('returns 401 and never calls the service when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await PATCH(patchRequest(VALID_NUTRITION));

    expect(response.status).toBe(401);
    expect(upsertNutritionProfileMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid dietType', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await PATCH(patchRequest({ dietType: 'CARNIVORE' }));

    expect(response.status).toBe(400);
    expect(upsertNutritionProfileMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an unparsable JSON body', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    const badRequest = new Request('http://localhost/api/profile/nutrition', {
      method: 'PATCH',
      body: 'not json',
    });

    const response = await PATCH(badRequest);

    expect(response.status).toBe(400);
  });

  it('upserts the nutrition profile scoped to the caller\'s own id and returns 200', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    upsertNutritionProfileMock.mockResolvedValue({ id: 'n1', ...VALID_NUTRITION });

    const response = await PATCH(patchRequest(VALID_NUTRITION));

    expect(response.status).toBe(200);
    expect(upsertNutritionProfileMock).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ dietType: 'OMNIVORE' }),
    );
  });

  it('returns 500 when the service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    upsertNutritionProfileMock.mockRejectedValue(new Error('db down'));

    const response = await PATCH(patchRequest(VALID_NUTRITION));

    expect(response.status).toBe(500);
  });
});
