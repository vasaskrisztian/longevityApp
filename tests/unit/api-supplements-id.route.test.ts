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

const getSupplementByIdMock = vi.fn();
const updateSupplementMock = vi.fn();
const deleteSupplementMock = vi.fn();
vi.mock('@/modules/supplements/supplements.service', () => ({
  getSupplementById: getSupplementByIdMock,
  updateSupplement: updateSupplementMock,
  deleteSupplement: deleteSupplementMock,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { GET, PATCH, DELETE } = await import('@/app/api/supplements/[id]/route');

const OWNED_SUPPLEMENT = { id: 's1', userId: 'u1', name: 'Vitamin D3', dosage: 2000 };

function ctx(id: string) {
  return { params: { id } };
}

function patchRequest(body: unknown): Request {
  return new Request('http://localhost/api/supplements/s1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  requireOwnResourceOrAdminMock.mockReset();
  getSupplementByIdMock.mockReset();
  updateSupplementMock.mockReset();
  deleteSupplementMock.mockReset();
});

describe('GET /api/supplements/[id]', () => {
  it('returns 401 and never reads the resource when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET(new Request('http://localhost/api/supplements/s1'), ctx('s1'));

    expect(response.status).toBe(401);
    expect(getSupplementByIdMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a nonexistent id', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getSupplementByIdMock.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/api/supplements/missing'), ctx('missing'));

    expect(response.status).toBe(404);
    expect(requireOwnResourceOrAdminMock).not.toHaveBeenCalled();
  });

  it('returns 403 (IDOR/BOLA) when the caller does not own the resource and is not an admin', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u2', role: 'USER' });
    getSupplementByIdMock.mockResolvedValue(OWNED_SUPPLEMENT);
    requireOwnResourceOrAdminMock.mockRejectedValue(new ForbiddenError());

    const response = await GET(new Request('http://localhost/api/supplements/s1'), ctx('s1'));

    expect(response.status).toBe(403);
  });

  it('returns 200 with the resource when the caller owns it', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getSupplementByIdMock.mockResolvedValue(OWNED_SUPPLEMENT);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await GET(new Request('http://localhost/api/supplements/s1'), ctx('s1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe('s1');
  });

  it('returns 200 when an admin reads someone else\'s resource', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'admin1', role: 'ADMIN' });
    getSupplementByIdMock.mockResolvedValue(OWNED_SUPPLEMENT);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'admin1', role: 'ADMIN' });

    const response = await GET(new Request('http://localhost/api/supplements/s1'), ctx('s1'));

    expect(response.status).toBe(200);
  });
});

describe('PATCH /api/supplements/[id]', () => {
  it('returns 401 and never touches the resource when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await PATCH(patchRequest({ dosage: 500 }), ctx('s1'));

    expect(response.status).toBe(401);
    expect(getSupplementByIdMock).not.toHaveBeenCalled();
    expect(updateSupplementMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a nonexistent id without calling update', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getSupplementByIdMock.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ dosage: 500 }), ctx('missing'));

    expect(response.status).toBe(404);
    expect(updateSupplementMock).not.toHaveBeenCalled();
  });

  it('returns 403 and never calls update when the caller does not own the resource', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u2', role: 'USER' });
    getSupplementByIdMock.mockResolvedValue(OWNED_SUPPLEMENT);
    requireOwnResourceOrAdminMock.mockRejectedValue(new ForbiddenError());

    const response = await PATCH(patchRequest({ dosage: 500 }), ctx('s1'));

    expect(response.status).toBe(403);
    expect(updateSupplementMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid payload without calling update', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getSupplementByIdMock.mockResolvedValue(OWNED_SUPPLEMENT);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await PATCH(patchRequest({ dosage: -5 }), ctx('s1'));

    expect(response.status).toBe(400);
    expect(updateSupplementMock).not.toHaveBeenCalled();
  });

  it('updates the resource by id and returns 200 for an owner\'s valid request', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getSupplementByIdMock.mockResolvedValue(OWNED_SUPPLEMENT);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    updateSupplementMock.mockResolvedValue({ ...OWNED_SUPPLEMENT, dosage: 500 });

    const response = await PATCH(patchRequest({ dosage: 500 }), ctx('s1'));

    expect(response.status).toBe(200);
    expect(updateSupplementMock).toHaveBeenCalledWith('s1', expect.objectContaining({ dosage: 500 }));
  });

  it('returns 500 when the service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getSupplementByIdMock.mockResolvedValue(OWNED_SUPPLEMENT);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    updateSupplementMock.mockRejectedValue(new Error('db down'));

    const response = await PATCH(patchRequest({ dosage: 500 }), ctx('s1'));

    expect(response.status).toBe(500);
  });
});

describe('DELETE /api/supplements/[id]', () => {
  it('returns 401 and never deletes when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await DELETE(new Request('http://localhost/api/supplements/s1'), ctx('s1'));

    expect(response.status).toBe(401);
    expect(deleteSupplementMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a nonexistent id without calling delete', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getSupplementByIdMock.mockResolvedValue(null);

    const response = await DELETE(new Request('http://localhost/api/supplements/missing'), ctx('missing'));

    expect(response.status).toBe(404);
    expect(deleteSupplementMock).not.toHaveBeenCalled();
  });

  it('returns 403 and never calls delete when the caller does not own the resource', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u2', role: 'USER' });
    getSupplementByIdMock.mockResolvedValue(OWNED_SUPPLEMENT);
    requireOwnResourceOrAdminMock.mockRejectedValue(new ForbiddenError());

    const response = await DELETE(new Request('http://localhost/api/supplements/s1'), ctx('s1'));

    expect(response.status).toBe(403);
    expect(deleteSupplementMock).not.toHaveBeenCalled();
  });

  it('deletes the resource by id and returns 204 for the owner', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getSupplementByIdMock.mockResolvedValue(OWNED_SUPPLEMENT);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    deleteSupplementMock.mockResolvedValue(undefined);

    const response = await DELETE(new Request('http://localhost/api/supplements/s1'), ctx('s1'));

    expect(response.status).toBe(204);
    expect(deleteSupplementMock).toHaveBeenCalledWith('s1');
  });

  it('returns 500 when the service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getSupplementByIdMock.mockResolvedValue(OWNED_SUPPLEMENT);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    deleteSupplementMock.mockRejectedValue(new Error('db down'));

    const response = await DELETE(new Request('http://localhost/api/supplements/s1'), ctx('s1'));

    expect(response.status).toBe(500);
  });
});
