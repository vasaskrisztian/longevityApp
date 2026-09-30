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

const listInBodyMeasurementsMock = vi.fn();
const createInBodyMeasurementFromUploadMock = vi.fn();
vi.mock('@/modules/inbody/inbody.service', () => ({
  listInBodyMeasurements: listInBodyMeasurementsMock,
  createInBodyMeasurementFromUpload: createInBodyMeasurementFromUploadMock,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { GET, POST } = await import('@/app/api/inbody/route');

const STORED_MEASUREMENT = {
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

function postRequestWithFile(file: File | null): Request {
  const formData = new FormData();
  if (file) {
    formData.set('image', file);
  }
  return new Request('http://localhost/api/inbody', {
    method: 'POST',
    body: formData,
  });
}

function jpegFile(name = 'scan.jpg', sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type: 'image/jpeg' });
}

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  listInBodyMeasurementsMock.mockReset();
  createInBodyMeasurementFromUploadMock.mockReset();
});

describe('GET /api/inbody', () => {
  it('returns 401 when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET();

    expect(response.status).toBe(401);
    expect(listInBodyMeasurementsMock).not.toHaveBeenCalled();
  });

  it('lists measurements scoped to the caller\'s own id, as DTOs', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    listInBodyMeasurementsMock.mockResolvedValue([STORED_MEASUREMENT]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(listInBodyMeasurementsMock).toHaveBeenCalledWith('u1');
    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('m1');
    expect(body[0].weightKg).toBe(91.5);
    // The DTO must never leak the raw image bytes into the list payload.
    expect(body[0].imageData).toBeUndefined();
  });
});

describe('POST /api/inbody', () => {
  it('returns 401 and never runs OCR when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await POST(postRequestWithFile(jpegFile()));

    expect(response.status).toBe(401);
    expect(createInBodyMeasurementFromUploadMock).not.toHaveBeenCalled();
  });

  it('returns 400 when no image field is present', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await POST(postRequestWithFile(null));

    expect(response.status).toBe(400);
    expect(createInBodyMeasurementFromUploadMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an unsupported content type', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    const badFile = new File([new Uint8Array(10)], 'scan.heic', { type: 'image/heic' });

    const response = await POST(postRequestWithFile(badFile));

    expect(response.status).toBe(400);
    expect(createInBodyMeasurementFromUploadMock).not.toHaveBeenCalled();
  });

  it('returns 400 when the image exceeds the size limit', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    const oversized = jpegFile('scan.jpg', 16 * 1024 * 1024);

    const response = await POST(postRequestWithFile(oversized));

    expect(response.status).toBe(400);
    expect(createInBodyMeasurementFromUploadMock).not.toHaveBeenCalled();
  });

  it('OCRs and stores the upload scoped to the caller\'s own id, returning 201', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    createInBodyMeasurementFromUploadMock.mockResolvedValue(STORED_MEASUREMENT);

    const response = await POST(postRequestWithFile(jpegFile()));

    expect(response.status).toBe(201);
    expect(createInBodyMeasurementFromUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        imageContentType: 'image/jpeg',
        imageFilename: 'scan.jpg',
      }),
    );
    const body = await response.json();
    expect(body.id).toBe('m1');
  });

  it('returns 500 when the service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    createInBodyMeasurementFromUploadMock.mockRejectedValue(new Error('ocr failed'));

    const response = await POST(postRequestWithFile(jpegFile()));

    expect(response.status).toBe(500);
  });
});
