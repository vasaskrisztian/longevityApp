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

const listSupplementsMock = vi.fn();
const createSupplementMock = vi.fn();
vi.mock('@/modules/supplements/supplements.service', () => ({
  listSupplements: listSupplementsMock,
  createSupplement: createSupplementMock,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { GET, POST } = await import('@/app/api/supplements/route');

const VALID_SUPPLEMENT = { name: 'Vitamin D3', dosage: 2000, unit: 'IU', frequency: 'DAILY' };

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/supplements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  listSupplementsMock.mockReset();
  createSupplementMock.mockReset();
});

describe('GET /api/supplements', () => {
  it('returns 401 when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET();

    expect(response.status).toBe(401);
    expect(listSupplementsMock).not.toHaveBeenCalled();
  });

  it('lists supplements scoped to the caller\'s own id', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    listSupplementsMock.mockResolvedValue([{ id: 's1' }]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(listSupplementsMock).toHaveBeenCalledWith('u1');
    const body = await response.json();
    expect(body).toEqual([{ id: 's1' }]);
  });
});

describe('POST /api/supplements', () => {
  it('returns 401 and never calls the service when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await POST(postRequest(VALID_SUPPLEMENT));

    expect(response.status).toBe(401);
    expect(createSupplementMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid payload (missing name)', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await POST(postRequest({ ...VALID_SUPPLEMENT, name: '' }));

    expect(response.status).toBe(400);
    expect(createSupplementMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an unparsable JSON body', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    const badRequest = new Request('http://localhost/api/supplements', {
      method: 'POST',
      body: 'not json',
    });

    const response = await POST(badRequest);

    expect(response.status).toBe(400);
  });

  it('creates a supplement scoped to the caller\'s own id and returns 201', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    createSupplementMock.mockResolvedValue({ id: 's1', userId: 'u1', ...VALID_SUPPLEMENT });

    const response = await POST(postRequest(VALID_SUPPLEMENT));

    expect(response.status).toBe(201);
    expect(createSupplementMock).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ name: 'Vitamin D3' }),
    );
  });

  it('returns 500 when the service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    createSupplementMock.mockRejectedValue(new Error('db down'));

    const response = await POST(postRequest(VALID_SUPPLEMENT));

    expect(response.status).toBe(500);
  });
});
