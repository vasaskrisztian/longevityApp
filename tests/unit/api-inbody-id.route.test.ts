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
const updateInBodyMeasurementMock = vi.fn();
const deleteInBodyMeasurementMock = vi.fn();
vi.mock('@/modules/inbody/inbody.service', () => ({
  getInBodyMeasurementById: getInBodyMeasurementByIdMock,
  updateInBodyMeasurement: updateInBodyMeasurementMock,
  deleteInBodyMeasurement: deleteInBodyMeasurementMock,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { GET, PATCH, DELETE } = await import('@/app/api/inbody/[id]/route');

const OWNED_MEASUREMENT = {
  id: 'm1',
  userId: 'u1',
  measuredAt: new Date('2026-03-12T09:14:00.000Z'),
  weightKg: 91.5,
  bodyFatPercentage: 11.8,
  skeletalMuscleMassKg: 46.3,
  fatFreeMassKg: null,
  bmi: null,
  inBodyScore: 87,
  visceralFatLevel: 4,
  basalMetabolicRateKcal: 2113,
  totalBodyWaterL: 59.2,
  ecwRatio: 0.375,
  imageData: Buffer.from('img'),
  imageContentType: 'image/jpeg',
  imageFilename: 'scan.jpg',
  rawOcrText: 'raw text',
  createdAt: new Date('2026-03-12T09:20:00.000Z'),
  updatedAt: new Date('2026-03-12T09:20:00.000Z'),
};

function ctx(id: string) {
  return { params: { id } };
}

function patchRequest(body: unknown): Request {
  return new Request('http://localhost/api/inbody/m1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  requireOwnResourceOrAdminMock.mockReset();
  getInBodyMeasurementByIdMock.mockReset();
  updateInBodyMeasurementMock.mockReset();
  deleteInBodyMeasurementMock.mockReset();
});

describe('GET /api/inbody/[id]', () => {
  it('returns 401 and never reads the resource when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET(new Request('http://localhost/api/inbody/m1'), ctx('m1'));

    expect(response.status).toBe(401);
    expect(getInBodyMeasurementByIdMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a nonexistent id', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getInBodyMeasurementByIdMock.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/api/inbody/missing'), ctx('missing'));

    expect(response.status).toBe(404);
    expect(requireOwnResourceOrAdminMock).not.toHaveBeenCalled();
  });

  it('returns 403 (IDOR/BOLA) when the caller does not own the resource and is not an admin', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u2', role: 'USER' });
    getInBodyMeasurementByIdMock.mockResolvedValue(OWNED_MEASUREMENT);
    requireOwnResourceOrAdminMock.mockRejectedValue(new ForbiddenError());

    const response = await GET(new Request('http://localhost/api/inbody/m1'), ctx('m1'));

    expect(response.status).toBe(403);
  });

  it('returns 200 with the DTO (no raw image bytes) when the caller owns it', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getInBodyMeasurementByIdMock.mockResolvedValue(OWNED_MEASUREMENT);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await GET(new Request('http://localhost/api/inbody/m1'), ctx('m1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe('m1');
    expect(body.imageData).toBeUndefined();
  });

  it('returns 200 when an admin reads someone else\'s resource', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'admin1', role: 'ADMIN' });
    getInBodyMeasurementByIdMock.mockResolvedValue(OWNED_MEASUREMENT);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'admin1', role: 'ADMIN' });

    const response = await GET(new Request('http://localhost/api/inbody/m1'), ctx('m1'));

    expect(response.status).toBe(200);
  });
});

describe('PATCH /api/inbody/[id]', () => {
  it('returns 401 and never touches the resource when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await PATCH(patchRequest({ weightKg: 90 }), ctx('m1'));

    expect(response.status).toBe(401);
    expect(getInBodyMeasurementByIdMock).not.toHaveBeenCalled();
    expect(updateInBodyMeasurementMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a nonexistent id without calling update', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getInBodyMeasurementByIdMock.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ weightKg: 90 }), ctx('missing'));

    expect(response.status).toBe(404);
    expect(updateInBodyMeasurementMock).not.toHaveBeenCalled();
  });

  it('returns 403 and never calls update when the caller does not own the resource', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u2', role: 'USER' });
    getInBodyMeasurementByIdMock.mockResolvedValue(OWNED_MEASUREMENT);
    requireOwnResourceOrAdminMock.mockRejectedValue(new ForbiddenError());

    const response = await PATCH(patchRequest({ weightKg: 90 }), ctx('m1'));

    expect(response.status).toBe(403);
    expect(updateInBodyMeasurementMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an out-of-range value without calling update', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getInBodyMeasurementByIdMock.mockResolvedValue(OWNED_MEASUREMENT);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await PATCH(patchRequest({ inBodyScore: 500 }), ctx('m1'));

    expect(response.status).toBe(400);
    expect(updateInBodyMeasurementMock).not.toHaveBeenCalled();
  });

  it('allows explicitly clearing a field back to null', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getInBodyMeasurementByIdMock.mockResolvedValue(OWNED_MEASUREMENT);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    updateInBodyMeasurementMock.mockResolvedValue({ ...OWNED_MEASUREMENT, bmi: null });

    const response = await PATCH(patchRequest({ bmi: null }), ctx('m1'));

    expect(response.status).toBe(200);
    expect(updateInBodyMeasurementMock).toHaveBeenCalledWith('m1', expect.objectContaining({ bmi: null }));
  });

  it('updates the resource by id and returns 200 for an owner\'s valid request', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getInBodyMeasurementByIdMock.mockResolvedValue(OWNED_MEASUREMENT);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    updateInBodyMeasurementMock.mockResolvedValue({ ...OWNED_MEASUREMENT, weightKg: 90 });

    const response = await PATCH(patchRequest({ weightKg: 90 }), ctx('m1'));

    expect(response.status).toBe(200);
    expect(updateInBodyMeasurementMock).toHaveBeenCalledWith('m1', expect.objectContaining({ weightKg: 90 }));
  });

  it('returns 500 when the service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getInBodyMeasurementByIdMock.mockResolvedValue(OWNED_MEASUREMENT);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    updateInBodyMeasurementMock.mockRejectedValue(new Error('db down'));

    const response = await PATCH(patchRequest({ weightKg: 90 }), ctx('m1'));

    expect(response.status).toBe(500);
  });
});

describe('DELETE /api/inbody/[id]', () => {
  it('returns 401 and never deletes when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await DELETE(new Request('http://localhost/api/inbody/m1'), ctx('m1'));

    expect(response.status).toBe(401);
    expect(deleteInBodyMeasurementMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a nonexistent id without calling delete', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getInBodyMeasurementByIdMock.mockResolvedValue(null);

    const response = await DELETE(new Request('http://localhost/api/inbody/missing'), ctx('missing'));

    expect(response.status).toBe(404);
    expect(deleteInBodyMeasurementMock).not.toHaveBeenCalled();
  });

  it('returns 403 and never calls delete when the caller does not own the resource', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u2', role: 'USER' });
    getInBodyMeasurementByIdMock.mockResolvedValue(OWNED_MEASUREMENT);
    requireOwnResourceOrAdminMock.mockRejectedValue(new ForbiddenError());

    const response = await DELETE(new Request('http://localhost/api/inbody/m1'), ctx('m1'));

    expect(response.status).toBe(403);
    expect(deleteInBodyMeasurementMock).not.toHaveBeenCalled();
  });

  it('deletes the resource by id and returns 204 for the owner', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getInBodyMeasurementByIdMock.mockResolvedValue(OWNED_MEASUREMENT);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    deleteInBodyMeasurementMock.mockResolvedValue(undefined);

    const response = await DELETE(new Request('http://localhost/api/inbody/m1'), ctx('m1'));

    expect(response.status).toBe(204);
    expect(deleteInBodyMeasurementMock).toHaveBeenCalledWith('m1');
  });

  it('returns 500 when the service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getInBodyMeasurementByIdMock.mockResolvedValue(OWNED_MEASUREMENT);
    requireOwnResourceOrAdminMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    deleteInBodyMeasurementMock.mockRejectedValue(new Error('db down'));

    const response = await DELETE(new Request('http://localhost/api/inbody/m1'), ctx('m1'));

    expect(response.status).toBe(500);
  });
});
