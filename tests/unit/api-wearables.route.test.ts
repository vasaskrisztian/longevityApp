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

const listConnectionsForUserMock = vi.fn();
vi.mock('@/modules/wearable/services/wearable.service', () => ({
  listConnectionsForUser: listConnectionsForUserMock,
}));

const { GET } = await import('@/app/api/wearables/route');

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  listConnectionsForUserMock.mockReset();
});

describe('GET /api/wearables', () => {
  it('returns 401 and never calls the service when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET();

    expect(response.status).toBe(401);
    expect(listConnectionsForUserMock).not.toHaveBeenCalled();
  });

  it('lists connections scoped to the caller\'s own id — never a client-supplied id', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    listConnectionsForUserMock.mockResolvedValue([
      { id: null, provider: 'OURA', status: 'DISCONNECTED' },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(listConnectionsForUserMock).toHaveBeenCalledWith('u1');
    expect(listConnectionsForUserMock).toHaveBeenCalledTimes(1);
    const body = await response.json();
    expect(body).toEqual([{ id: null, provider: 'OURA', status: 'DISCONNECTED' }]);
  });

  it('propagates a 403 the same way as any other authorization failure', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new ForbiddenError('nope'));

    const response = await GET();

    expect(response.status).toBe(403);
    expect(listConnectionsForUserMock).not.toHaveBeenCalled();
  });
});
