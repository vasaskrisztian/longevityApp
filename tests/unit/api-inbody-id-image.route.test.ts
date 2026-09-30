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

const getInBodyMeasurementByIdMock = vi.fn();
vi.mock('@/modules/inbody/inbody.service', () => ({
  getInBodyMeasurementById: getInBodyMeasurementByIdMock,
}));

const { GET } = await import('@/app/api/inbody/[id]/image/route');

const OWNED_MEASUREMENT = {
  id: 'm1',
  userId: 'u1',
  imageData: Buffer.from('fake jpeg bytes'),
  imageContentType: 'image/jpeg',
};

function ctx(id: string) {
  return { params: { id } };
}

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  requireOwnResourceOrAdminMock.mockReset();
  getInBodyMeasurementByIdMock.mockReset();
});

describe('GET /api/inbody/[id]/image', () => {
  it('returns 401 and never reads the resource when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET(new Request('http://localhost/api/inbody/m1/image'), ctx('m1'));

    expect(response.status).toBe(401);
    expect(getInBodyMeasurementByIdMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a nonexistent id', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getInBodyMeasurementByIdMock.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/api/inbody/missing/image'), ctx('missing'));

    expect(response.status).toBe(404);
    expect(requireOwnResourceOrAdminMock).not.toHaveBeenCalled();
  });

  it('returns 403 (IDOR/BOLA) when the caller does not own the resource', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u2', role: 'USER' });
    getInBodyMeasurementByIdMock.mockResolvedValue(OWNED_MEASUREMENT);
    requireOwnResourceOrAdminMock.mockRejectedValue(new ForbiddenError());

    const response = await GET(new Request('http://localhost/api/inbody/m1/image'), ctx('m1'));

    expect(response.status).toBe(403);
  });

  it('serves the raw image bytes with the stored content type for the owner', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getInBodyMeasurementByIdMock.mockResolvedValue(OWNED_MEASUREMENT);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await GET(new Request('http://localhost/api/inbody/m1/image'), ctx('m1'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.equals(OWNED_MEASUREMENT.imageData)).toBe(true);
  });
});
