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

const listChallengesMock = vi.fn();
const createChallengeMock = vi.fn();
vi.mock('@/modules/challenges/challenges.service', () => ({
  listChallenges: listChallengesMock,
  createChallenge: createChallengeMock,
}));

// Phase 13 — see tests/unit/api-protocols.route.test.ts's identical mock comment.
const canPublishPubliclyMock = vi.fn();
vi.mock('@/modules/creators/creators.service', () => ({
  canPublishPublicly: canPublishPubliclyMock,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { GET, POST } = await import('@/app/api/challenges/route');

const VALID_CHALLENGE = { type: 'SLEEP_SCORE', requiredCount: 10, threshold: 80, windowDays: 21 };

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/challenges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  listChallengesMock.mockReset();
  createChallengeMock.mockReset();
  canPublishPubliclyMock.mockReset();
});

describe('GET /api/challenges', () => {
  it('returns 401 when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET();

    expect(response.status).toBe(401);
    expect(listChallengesMock).not.toHaveBeenCalled();
  });

  it("lists challenges scoped to the caller's own id", async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    listChallengesMock.mockResolvedValue([{ id: 'c1' }]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(listChallengesMock).toHaveBeenCalledWith('u1');
    const body = await response.json();
    expect(body).toEqual([{ id: 'c1' }]);
  });
});

describe('POST /api/challenges', () => {
  it('returns 401 and never calls the service when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await POST(postRequest(VALID_CHALLENGE));

    expect(response.status).toBe(401);
    expect(createChallengeMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid payload (missing threshold)', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    const { threshold: _threshold, ...withoutThreshold } = VALID_CHALLENGE as Record<string, unknown>;

    const response = await POST(postRequest(withoutThreshold));

    expect(response.status).toBe(400);
    expect(createChallengeMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an unparsable JSON body', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    const badRequest = new Request('http://localhost/api/challenges', { method: 'POST', body: 'not json' });

    const response = await POST(badRequest);

    expect(response.status).toBe(400);
  });

  it("creates a challenge scoped to the caller's own id and returns 201", async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    createChallengeMock.mockResolvedValue({ id: 'c1', userId: 'u1', ...VALID_CHALLENGE, activatedAt: null });

    const response = await POST(postRequest(VALID_CHALLENGE));

    expect(response.status).toBe(201);
    expect(createChallengeMock).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'SLEEP_SCORE' }));
  });

  it('returns 500 when the service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    createChallengeMock.mockRejectedValue(new Error('db down'));

    const response = await POST(postRequest(VALID_CHALLENGE));

    expect(response.status).toBe(500);
  });

  // Phase 13
  it('returns 403 for visibility: PUBLIC when the caller is not a consenting creator', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    canPublishPubliclyMock.mockResolvedValue(false);

    const response = await POST(postRequest({ ...VALID_CHALLENGE, visibility: 'PUBLIC' }));

    expect(response.status).toBe(403);
    expect(createChallengeMock).not.toHaveBeenCalled();
  });

  it('creates a PUBLIC challenge when the caller is a consenting creator', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    canPublishPubliclyMock.mockResolvedValue(true);
    createChallengeMock.mockResolvedValue({
      id: 'c1',
      userId: 'u1',
      ...VALID_CHALLENGE,
      visibility: 'PUBLIC',
      activatedAt: null,
    });

    const response = await POST(postRequest({ ...VALID_CHALLENGE, visibility: 'PUBLIC' }));

    expect(response.status).toBe(201);
    expect(createChallengeMock).toHaveBeenCalledWith('u1', expect.objectContaining({ visibility: 'PUBLIC' }));
  });
});
