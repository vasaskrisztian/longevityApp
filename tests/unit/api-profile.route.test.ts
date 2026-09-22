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

const getProfileBundleMock = vi.fn();
const updatePersonalInfoMock = vi.fn();
vi.mock('@/modules/profile/profile.service', () => ({
  getProfileBundle: getProfileBundleMock,
  updatePersonalInfo: updatePersonalInfoMock,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { GET, PATCH } = await import('@/app/api/profile/route');

const VALID_PERSONAL = {
  fullName: 'Jane Doe',
  birthDate: '1990-05-15',
  heightCm: 170,
  weightKg: 65,
  timezone: 'Europe/Budapest',
};

function patchRequest(body: unknown): Request {
  return new Request('http://localhost/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  getProfileBundleMock.mockReset();
  updatePersonalInfoMock.mockReset();
});

describe('GET /api/profile', () => {
  it('returns 401 when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET();

    expect(response.status).toBe(401);
    expect(getProfileBundleMock).not.toHaveBeenCalled();
  });

  it('returns the caller\'s own profile bundle, scoped by their own id', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getProfileBundleMock.mockResolvedValue({
      onboardingCompletedAt: null,
      profile: { fullName: 'Jane Doe' },
      exerciseProfile: null,
      nutritionProfile: null,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(getProfileBundleMock).toHaveBeenCalledWith('u1');
    const body = await response.json();
    expect(body.profile.fullName).toBe('Jane Doe');
  });
});

describe('PATCH /api/profile', () => {
  it('returns 401 and never calls the service when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await PATCH(patchRequest(VALID_PERSONAL));

    expect(response.status).toBe(401);
    expect(updatePersonalInfoMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid payload', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await PATCH(patchRequest({ ...VALID_PERSONAL, fullName: '' }));

    expect(response.status).toBe(400);
    expect(updatePersonalInfoMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an unparsable JSON body', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    const badRequest = new Request('http://localhost/api/profile', {
      method: 'PATCH',
      body: 'not json',
    });

    const response = await PATCH(badRequest);

    expect(response.status).toBe(400);
  });

  it('updates the profile scoped to the caller\'s own id and returns 200', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    updatePersonalInfoMock.mockResolvedValue({ id: 'p1', fullName: 'Jane Doe' });

    const response = await PATCH(patchRequest(VALID_PERSONAL));

    expect(response.status).toBe(200);
    expect(updatePersonalInfoMock).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ fullName: 'Jane Doe' }),
    );
  });

  it('returns 500 when the service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    updatePersonalInfoMock.mockRejectedValue(new Error('db down'));

    const response = await PATCH(patchRequest(VALID_PERSONAL));

    expect(response.status).toBe(500);
  });
});
