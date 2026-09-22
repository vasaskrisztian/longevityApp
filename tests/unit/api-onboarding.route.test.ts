import { describe, it, expect, vi, beforeEach } from 'vitest';
// Dependency-free — see src/lib/auth/errors.ts / page-guards.test.ts for why
// these come from here rather than the (Prisma/Auth.js-heavy) real
// authorization.ts module, which is mocked below.
import { UnauthenticatedError, ForbiddenError } from '@/lib/auth/errors';

const requireAuthenticatedUserMock = vi.fn();

// A faithful, standalone re-implementation of the real toErrorResponse
// (authorization.ts) — kept in sync by testing its actual mapping here
// rather than re-importing the real (Prisma-dependent) module.
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

const completeOnboardingMock = vi.fn();
vi.mock('@/modules/profile/profile.service', () => ({
  completeOnboarding: completeOnboardingMock,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { POST } = await import('@/app/api/onboarding/route');

const VALID_PAYLOAD = {
  personal: {
    fullName: 'Jane Doe',
    birthDate: '1990-05-15',
    heightCm: 170,
    weightKg: 65,
    timezone: 'Europe/Budapest',
  },
  exercise: { activityLevel: 'MODERATELY_ACTIVE' },
  nutrition: { dietType: 'OMNIVORE' },
};

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  completeOnboardingMock.mockReset();
});

describe('POST /api/onboarding', () => {
  it('returns 401 and never calls the service when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await POST(jsonRequest(VALID_PAYLOAD));

    expect(response.status).toBe(401);
    expect(completeOnboardingMock).not.toHaveBeenCalled();
  });

  it('returns 400 for a payload missing required fields', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await POST(jsonRequest({ personal: {} }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
    expect(completeOnboardingMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an unparsable JSON body', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    const badRequest = new Request('http://localhost/api/onboarding', {
      method: 'POST',
      body: 'not json',
    });

    const response = await POST(badRequest);

    expect(response.status).toBe(400);
  });

  it('completes onboarding and returns 200 for a valid payload', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    completeOnboardingMock.mockResolvedValue({});

    const response = await POST(jsonRequest(VALID_PAYLOAD));

    expect(response.status).toBe(200);
    expect(completeOnboardingMock).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        personal: expect.objectContaining({ fullName: 'Jane Doe' }),
        exercise: expect.objectContaining({ activityLevel: 'MODERATELY_ACTIVE' }),
        nutrition: expect.objectContaining({ dietType: 'OMNIVORE' }),
      }),
    );
  });

  it('returns 500 without leaking the internal error when the service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    completeOnboardingMock.mockRejectedValue(new Error('db down'));

    const response = await POST(jsonRequest(VALID_PAYLOAD));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).not.toMatch(/db down/);
  });
});
