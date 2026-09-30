import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  inBodyMeasurement: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

const runInBodyOcrMock = vi.fn();
vi.mock('@/modules/inbody/inbody-ocr.service', () => ({ runInBodyOcr: runInBodyOcrMock }));

const parseInBodyReportMock = vi.fn();
vi.mock('@/modules/inbody/inbody-parser', () => ({ parseInBodyReport: parseInBodyReportMock }));

const {
  listInBodyMeasurements,
  getInBodyMeasurementById,
  createInBodyMeasurementFromUpload,
  updateInBodyMeasurement,
  deleteInBodyMeasurement,
} = await import('@/modules/inbody/inbody.service');

const PARSED_FIELDS = {
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
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listInBodyMeasurements', () => {
  it('lists measurements scoped to userId, newest measuredAt first, converting Decimal fields to numbers', async () => {
    prismaMock.inBodyMeasurement.findMany.mockResolvedValue([
      { id: 'm1', userId: 'u1', weightKg: { toString: () => '91.5' }, bmi: null },
    ]);

    const result = await listInBodyMeasurements('u1');

    expect(prismaMock.inBodyMeasurement.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { measuredAt: 'desc' },
    });
    expect(result[0]!.weightKg).toBe(91.5);
    expect(result[0]!.bmi).toBeNull();
  });
});

describe('getInBodyMeasurementById', () => {
  it('returns the measurement when found', async () => {
    prismaMock.inBodyMeasurement.findUnique.mockResolvedValue({ id: 'm1', userId: 'u1', weightKg: null });
    const result = await getInBodyMeasurementById('m1');
    expect(result?.id).toBe('m1');
    expect(prismaMock.inBodyMeasurement.findUnique).toHaveBeenCalledWith({ where: { id: 'm1' } });
  });

  it('returns null when not found', async () => {
    prismaMock.inBodyMeasurement.findUnique.mockResolvedValue(null);
    await expect(getInBodyMeasurementById('missing')).resolves.toBeNull();
  });
});

describe('createInBodyMeasurementFromUpload', () => {
  it('OCRs the image, parses the text, and stores the image bytes alongside every parsed field', async () => {
    runInBodyOcrMock.mockResolvedValue({ rawText: 'some raw ocr text', confidence: 60 });
    parseInBodyReportMock.mockReturnValue(PARSED_FIELDS);
    prismaMock.inBodyMeasurement.create.mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      ...PARSED_FIELDS,
      imageData: Buffer.from('img'),
      imageContentType: 'image/jpeg',
      imageFilename: 'scan.jpg',
      rawOcrText: 'some raw ocr text',
    });

    const imageBuffer = Buffer.from('fake image bytes');
    const result = await createInBodyMeasurementFromUpload({
      userId: 'u1',
      imageBuffer,
      imageContentType: 'image/jpeg',
      imageFilename: 'scan.jpg',
    });

    expect(runInBodyOcrMock).toHaveBeenCalledWith(imageBuffer);
    expect(parseInBodyReportMock).toHaveBeenCalledWith('some raw ocr text');
    expect(prismaMock.inBodyMeasurement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        measuredAt: PARSED_FIELDS.measuredAt,
        weightKg: 91.5,
        bmi: null,
        imageData: imageBuffer,
        imageContentType: 'image/jpeg',
        imageFilename: 'scan.jpg',
        rawOcrText: 'some raw ocr text',
      }),
    });
    expect(result.id).toBe('m1');
  });

  it('falls back to the current time as measuredAt when the report date could not be parsed', async () => {
    runInBodyOcrMock.mockResolvedValue({ rawText: 'unreadable', confidence: 20 });
    parseInBodyReportMock.mockReturnValue({ ...PARSED_FIELDS, measuredAt: null });
    prismaMock.inBodyMeasurement.create.mockResolvedValue({ id: 'm1', userId: 'u1' });

    await createInBodyMeasurementFromUpload({
      userId: 'u1',
      imageBuffer: Buffer.from('x'),
      imageContentType: 'image/jpeg',
      imageFilename: null,
    });

    const call = prismaMock.inBodyMeasurement.create.mock.calls[0]![0];
    expect(call.data.measuredAt).toBeInstanceOf(Date);
  });
});

describe('updateInBodyMeasurement', () => {
  it('updates only the given fields, by id', async () => {
    prismaMock.inBodyMeasurement.update.mockResolvedValue({ id: 'm1', weightKg: 90 });
    const result = await updateInBodyMeasurement('m1', { weightKg: 90 });
    expect(prismaMock.inBodyMeasurement.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { weightKg: 90 },
    });
    expect(result.weightKg).toBe(90);
  });
});

describe('deleteInBodyMeasurement', () => {
  it('deletes the measurement by id', async () => {
    prismaMock.inBodyMeasurement.delete.mockResolvedValue({});
    await deleteInBodyMeasurement('m1');
    expect(prismaMock.inBodyMeasurement.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
  });
});
