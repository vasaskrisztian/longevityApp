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

const getChallengeByIdMock = vi.fn();
const updateChallengeMock = vi.fn();
const activateChallengeMock = vi.fn();
const deleteChallengeMock = vi.fn();
vi.mock('@/modules/challenges/challenges.service', () => ({
  getChallengeById: getChallengeByIdMock,
  updateChallenge: updateChallengeMock,
  activateChallenge: activateChallengeMock,
  deleteChallenge: deleteChallengeMock,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { GET, PATCH, DELETE } = await import('@/app/api/challenges/[id]/route');

const DRAFT_CHALLENGE = {
  id: 'c1',
  userId: 'u1',
  type: 'SLEEP_SCORE',
  requiredCount: 10,
  threshold: 80,
  windowDays: 21,
  activatedAt: null,
  expiresAt: null,
};

const ACTIVE_CHALLENGE = {
  ...DRAFT_CHALLENGE,
  activatedAt: new Date('2026-01-01T00:00:00.000Z'),
  expiresAt: new Date('2026-01-22T00:00:00.000Z'),
};

function ctx(id: string) {
  return { params: { id } };
}

function patchRequest(body: unknown): Request {
  return new Request('http://localhost/api/challenges/c1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  requireOwnResourceOrAdminMock.mockReset();
  getChallengeByIdMock.mockReset();
  updateChallengeMock.mockReset();
  activateChallengeMock.mockReset();
  deleteChallengeMock.mockReset();
});

describe('GET /api/challenges/[id]', () => {
  it('returns 401 and never reads the resource when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET(new Request('http://localhost/api/challenges/c1'), ctx('c1'));

    expect(response.status).toBe(401);
    expect(getChallengeByIdMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a nonexistent id', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getChallengeByIdMock.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/api/challenges/missing'), ctx('missing'));

    expect(response.status).toBe(404);
    expect(requireOwnResourceOrAdminMock).not.toHaveBeenCalled();
  });

  it('returns 403 (IDOR/BOLA) when the caller does not own the resource and is not an admin', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u2', role: 'USER' });
    getChallengeByIdMock.mockResolvedValue(DRAFT_CHALLENGE);
    requireOwnResourceOrAdminMock.mockRejectedValue(new ForbiddenError());

    const response = await GET(new Request('http://localhost/api/challenges/c1'), ctx('c1'));

    expect(response.status).toBe(403);
  });

  it('returns 200 with the resource when the caller owns it', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getChallengeByIdMock.mockResolvedValue(DRAFT_CHALLENGE);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await GET(new Request('http://localhost/api/challenges/c1'), ctx('c1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe('c1');
  });
});

describe('PATCH /api/challenges/[id]', () => {
  it('returns 401 and never touches the resource when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await PATCH(patchRequest({ name: 'Renamed' }), ctx('c1'));

    expect(response.status).toBe(401);
    expect(getChallengeByIdMock).not.toHaveBeenCalled();
    expect(updateChallengeMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a nonexistent id without calling update', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getChallengeByIdMock.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ name: 'Renamed' }), ctx('missing'));

    expect(response.status).toBe(404);
    expect(updateChallengeMock).not.toHaveBeenCalled();
  });

  it('returns 403 and never calls update when the caller does not own the resource', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u2', role: 'USER' });
    getChallengeByIdMock.mockResolvedValue(DRAFT_CHALLENGE);
    requireOwnResourceOrAdminMock.mockRejectedValue(new ForbiddenError());

    const response = await PATCH(patchRequest({ name: 'Renamed' }), ctx('c1'));

    expect(response.status).toBe(403);
    expect(updateChallengeMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid payload without calling update', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getChallengeByIdMock.mockResolvedValue(DRAFT_CHALLENGE);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await PATCH(patchRequest({ windowDays: 0 }), ctx('c1'));

    expect(response.status).toBe(400);
    expect(updateChallengeMock).not.toHaveBeenCalled();
  });

  it('updates a draft challenge by id and returns 200', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getChallengeByIdMock.mockResolvedValue(DRAFT_CHALLENGE);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    updateChallengeMock.mockResolvedValue({ ...DRAFT_CHALLENGE, name: 'Renamed' });

    const response = await PATCH(patchRequest({ name: 'Renamed' }), ctx('c1'));

    expect(response.status).toBe(200);
    expect(updateChallengeMock).toHaveBeenCalledWith('c1', expect.objectContaining({ name: 'Renamed' }));
  });

  it('returns 409 and never calls update when the challenge is already active', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getChallengeByIdMock.mockResolvedValue(ACTIVE_CHALLENGE);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await PATCH(patchRequest({ name: 'Renamed' }), ctx('c1'));

    expect(response.status).toBe(409);
    expect(updateChallengeMock).not.toHaveBeenCalled();
  });

  it('activates a draft challenge when sent { activate: true } and returns 200', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getChallengeByIdMock.mockResolvedValue(DRAFT_CHALLENGE);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    activateChallengeMock.mockResolvedValue(ACTIVE_CHALLENGE);

    const response = await PATCH(patchRequest({ activate: true }), ctx('c1'));

    expect(response.status).toBe(200);
    expect(activateChallengeMock).toHaveBeenCalledWith('c1', 21);
    expect(updateChallengeMock).not.toHaveBeenCalled();
  });

  it('returns 409 and never re-activates when { activate: true } is sent for an already-active challenge', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getChallengeByIdMock.mockResolvedValue(ACTIVE_CHALLENGE);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await PATCH(patchRequest({ activate: true }), ctx('c1'));

    expect(response.status).toBe(409);
    expect(activateChallengeMock).not.toHaveBeenCalled();
  });

  it('returns 500 when the update service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getChallengeByIdMock.mockResolvedValue(DRAFT_CHALLENGE);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    updateChallengeMock.mockRejectedValue(new Error('db down'));

    const response = await PATCH(patchRequest({ name: 'Renamed' }), ctx('c1'));

    expect(response.status).toBe(500);
  });

  it('returns 500 when the activate service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getChallengeByIdMock.mockResolvedValue(DRAFT_CHALLENGE);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    activateChallengeMock.mockRejectedValue(new Error('db down'));

    const response = await PATCH(patchRequest({ activate: true }), ctx('c1'));

    expect(response.status).toBe(500);
  });
});

describe('DELETE /api/challenges/[id]', () => {
  it('returns 401 and never deletes when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await DELETE(new Request('http://localhost/api/challenges/c1'), ctx('c1'));

    expect(response.status).toBe(401);
    expect(deleteChallengeMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a nonexistent id without calling delete', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getChallengeByIdMock.mockResolvedValue(null);

    const response = await DELETE(new Request('http://localhost/api/challenges/missing'), ctx('missing'));

    expect(response.status).toBe(404);
    expect(deleteChallengeMock).not.toHaveBeenCalled();
  });

  it('returns 403 and never calls delete when the caller does not own the resource', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u2', role: 'USER' });
    getChallengeByIdMock.mockResolvedValue(DRAFT_CHALLENGE);
    requireOwnResourceOrAdminMock.mockRejectedValue(new ForbiddenError());

    const response = await DELETE(new Request('http://localhost/api/challenges/c1'), ctx('c1'));

    expect(response.status).toBe(403);
    expect(deleteChallengeMock).not.toHaveBeenCalled();
  });

  it('deletes the resource by id and returns 204 for the owner, active or not', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getChallengeByIdMock.mockResolvedValue(ACTIVE_CHALLENGE);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    deleteChallengeMock.mockResolvedValue(undefined);

    const response = await DELETE(new Request('http://localhost/api/challenges/c1'), ctx('c1'));

    expect(response.status).toBe(204);
    expect(deleteChallengeMock).toHaveBeenCalledWith('c1');
  });

  it('returns 500 when the service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getChallengeByIdMock.mockResolvedValue(DRAFT_CHALLENGE);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    deleteChallengeMock.mockRejectedValue(new Error('db down'));

    const response = await DELETE(new Request('http://localhost/api/challenges/c1'), ctx('c1'));

    expect(response.status).toBe(500);
  });
});
