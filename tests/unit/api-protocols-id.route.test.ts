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

const getProtocolByIdMock = vi.fn();
const updateProtocolMock = vi.fn();
const deleteProtocolMock = vi.fn();
vi.mock('@/modules/protocols/protocols.service', () => ({
  getProtocolById: getProtocolByIdMock,
  updateProtocol: updateProtocolMock,
  deleteProtocol: deleteProtocolMock,
}));

// Phase 13 — see api-protocols.route.test.ts's identical mock comment.
const canPublishPubliclyMock = vi.fn();
vi.mock('@/modules/creators/creators.service', () => ({
  canPublishPublicly: canPublishPubliclyMock,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { GET, PATCH, DELETE } = await import('@/app/api/protocols/[id]/route');

const OWNED_PROTOCOL = { id: 'p1', userId: 'u1', name: 'Base building', isActive: false, supplements: [] };

function ctx(id: string) {
  return { params: { id } };
}

function patchRequest(body: unknown): Request {
  return new Request('http://localhost/api/protocols/p1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  requireOwnResourceOrAdminMock.mockReset();
  getProtocolByIdMock.mockReset();
  updateProtocolMock.mockReset();
  deleteProtocolMock.mockReset();
  canPublishPubliclyMock.mockReset();
});

describe('GET /api/protocols/[id]', () => {
  it('returns 401 and never reads the resource when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET(new Request('http://localhost/api/protocols/p1'), ctx('p1'));

    expect(response.status).toBe(401);
    expect(getProtocolByIdMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a nonexistent id', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getProtocolByIdMock.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/api/protocols/missing'), ctx('missing'));

    expect(response.status).toBe(404);
    expect(requireOwnResourceOrAdminMock).not.toHaveBeenCalled();
  });

  it('returns 403 (IDOR/BOLA) when the caller does not own the resource and is not an admin', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u2', role: 'USER' });
    getProtocolByIdMock.mockResolvedValue(OWNED_PROTOCOL);
    requireOwnResourceOrAdminMock.mockRejectedValue(new ForbiddenError());

    const response = await GET(new Request('http://localhost/api/protocols/p1'), ctx('p1'));

    expect(response.status).toBe(403);
  });

  it('returns 200 with the resource when the caller owns it', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getProtocolByIdMock.mockResolvedValue(OWNED_PROTOCOL);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await GET(new Request('http://localhost/api/protocols/p1'), ctx('p1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe('p1');
  });
});

describe('PATCH /api/protocols/[id]', () => {
  it('returns 401 and never touches the resource when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await PATCH(patchRequest({ isActive: true }), ctx('p1'));

    expect(response.status).toBe(401);
    expect(getProtocolByIdMock).not.toHaveBeenCalled();
    expect(updateProtocolMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a nonexistent id without calling update', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getProtocolByIdMock.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ isActive: true }), ctx('missing'));

    expect(response.status).toBe(404);
    expect(updateProtocolMock).not.toHaveBeenCalled();
  });

  it('returns 403 and never calls update when the caller does not own the resource', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u2', role: 'USER' });
    getProtocolByIdMock.mockResolvedValue(OWNED_PROTOCOL);
    requireOwnResourceOrAdminMock.mockRejectedValue(new ForbiddenError());

    const response = await PATCH(patchRequest({ isActive: true }), ctx('p1'));

    expect(response.status).toBe(403);
    expect(updateProtocolMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid payload without calling update', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getProtocolByIdMock.mockResolvedValue(OWNED_PROTOCOL);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await PATCH(patchRequest({ targetSleepScore: 500 }), ctx('p1'));

    expect(response.status).toBe(400);
    expect(updateProtocolMock).not.toHaveBeenCalled();
  });

  it('updates the resource by id, scoped to its owner\'s userId (for the "one active" invariant), and returns 200', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getProtocolByIdMock.mockResolvedValue(OWNED_PROTOCOL);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    updateProtocolMock.mockResolvedValue({ ...OWNED_PROTOCOL, isActive: true });

    const response = await PATCH(patchRequest({ isActive: true }), ctx('p1'));

    expect(response.status).toBe(200);
    expect(updateProtocolMock).toHaveBeenCalledWith('p1', 'u1', expect.objectContaining({ isActive: true }));
  });

  it('returns 500 when the service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getProtocolByIdMock.mockResolvedValue(OWNED_PROTOCOL);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    updateProtocolMock.mockRejectedValue(new Error('db down'));

    const response = await PATCH(patchRequest({ isActive: true }), ctx('p1'));

    expect(response.status).toBe(500);
  });

  // Phase 13
  it('returns 403 for visibility: PUBLIC when the owner is not a consenting creator', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getProtocolByIdMock.mockResolvedValue(OWNED_PROTOCOL);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    canPublishPubliclyMock.mockResolvedValue(false);

    const response = await PATCH(patchRequest({ visibility: 'PUBLIC' }), ctx('p1'));

    expect(response.status).toBe(403);
    expect(updateProtocolMock).not.toHaveBeenCalled();
  });

  it('allows visibility: PRIVATE without checking creator eligibility', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getProtocolByIdMock.mockResolvedValue(OWNED_PROTOCOL);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    updateProtocolMock.mockResolvedValue({ ...OWNED_PROTOCOL, visibility: 'PRIVATE' });

    const response = await PATCH(patchRequest({ visibility: 'PRIVATE' }), ctx('p1'));

    expect(response.status).toBe(200);
    expect(canPublishPubliclyMock).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/protocols/[id]', () => {
  it('returns 401 and never deletes when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await DELETE(new Request('http://localhost/api/protocols/p1'), ctx('p1'));

    expect(response.status).toBe(401);
    expect(deleteProtocolMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a nonexistent id without calling delete', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getProtocolByIdMock.mockResolvedValue(null);

    const response = await DELETE(new Request('http://localhost/api/protocols/missing'), ctx('missing'));

    expect(response.status).toBe(404);
    expect(deleteProtocolMock).not.toHaveBeenCalled();
  });

  it('returns 403 and never calls delete when the caller does not own the resource', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u2', role: 'USER' });
    getProtocolByIdMock.mockResolvedValue(OWNED_PROTOCOL);
    requireOwnResourceOrAdminMock.mockRejectedValue(new ForbiddenError());

    const response = await DELETE(new Request('http://localhost/api/protocols/p1'), ctx('p1'));

    expect(response.status).toBe(403);
    expect(deleteProtocolMock).not.toHaveBeenCalled();
  });

  it('deletes the resource by id and returns 204 for the owner', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getProtocolByIdMock.mockResolvedValue(OWNED_PROTOCOL);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    deleteProtocolMock.mockResolvedValue(undefined);

    const response = await DELETE(new Request('http://localhost/api/protocols/p1'), ctx('p1'));

    expect(response.status).toBe(204);
    expect(deleteProtocolMock).toHaveBeenCalledWith('p1');
  });

  it('returns 500 when the service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getProtocolByIdMock.mockResolvedValue(OWNED_PROTOCOL);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    deleteProtocolMock.mockRejectedValue(new Error('db down'));

    const response = await DELETE(new Request('http://localhost/api/protocols/p1'), ctx('p1'));

    expect(response.status).toBe(500);
  });
});
