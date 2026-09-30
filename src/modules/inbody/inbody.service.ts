import { prisma } from '@/lib/db/prisma';
import { runInBodyOcr } from './inbody-ocr.service';
import { parseInBodyReport, type ParsedInBodyFields } from './inbody-parser';

/**
 * `@prisma/client`'s generated types for this model aren't available in
 * every environment this project is developed in -- `prisma generate`
 * itself can't reach binaries.prisma.sh from either this sandbox or the
 * project's own dev machine (see docs/ci-cd-setup.md's Prisma notes; the
 * exact same constraint is why goals.service.ts and supplements.service.ts
 * already type their Prisma rows as `any` with the identical justification).
 * Railway's own Docker build does reach it and generates a real client at
 * deploy time -- this interface is this file's own hand-maintained mirror
 * of exactly what schema.prisma's InBodyMeasurement model produces, used to
 * keep every function below (and everything that calls them) properly
 * typed despite that.
 */
export interface InBodyMeasurement {
  id: string;
  userId: string;
  measuredAt: Date;
  weightKg: number | null;
  bodyFatPercentage: number | null;
  skeletalMuscleMassKg: number | null;
  fatFreeMassKg: number | null;
  bmi: number | null;
  inBodyScore: number | null;
  visceralFatLevel: number | null;
  basalMetabolicRateKcal: number | null;
  totalBodyWaterL: number | null;
  ecwRatio: number | null;
  imageData: Buffer;
  imageContentType: string;
  imageFilename: string | null;
  rawOcrText: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type InBodyMeasurementRow = Omit<
  InBodyMeasurement,
  'weightKg' | 'bodyFatPercentage' | 'skeletalMuscleMassKg' | 'fatFreeMassKg' | 'bmi' | 'totalBodyWaterL' | 'ecwRatio'
> & {
  // The five Decimal columns come back from Prisma as Decimal.js instances,
  // not plain numbers -- same conversion dashboard.service.ts's
  // toDailyMetricFields already documents for DailyHealthMetric's own
  // Decimal column. `null` passes through unchanged either way.
  weightKg: unknown;
  bodyFatPercentage: unknown;
  skeletalMuscleMassKg: unknown;
  fatFreeMassKg: unknown;
  bmi: unknown;
  totalBodyWaterL: unknown;
  ecwRatio: unknown;
};

function toDecimalOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function normalizeRow(row: InBodyMeasurementRow): InBodyMeasurement {
  return {
    ...row,
    weightKg: toDecimalOrNull(row.weightKg),
    bodyFatPercentage: toDecimalOrNull(row.bodyFatPercentage),
    skeletalMuscleMassKg: toDecimalOrNull(row.skeletalMuscleMassKg),
    fatFreeMassKg: toDecimalOrNull(row.fatFreeMassKg),
    bmi: toDecimalOrNull(row.bmi),
    totalBodyWaterL: toDecimalOrNull(row.totalBodyWaterL),
    ecwRatio: toDecimalOrNull(row.ecwRatio),
  };
}

/**
 * Ownership (IDOR/BOLA) checks happen in the Route Handler, via
 * requireOwnResourceOrAdmin, BEFORE any of the by-id functions below are
 * called -- see src/app/api/inbody/[id]/route.ts, the same pattern
 * supplements.service.ts and goals.service.ts already follow.
 */

export async function listInBodyMeasurements(userId: string): Promise<InBodyMeasurement[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see this file's top comment
  const rows = await (prisma as any).inBodyMeasurement.findMany({
    where: { userId },
    orderBy: { measuredAt: 'desc' },
  });
  return rows.map(normalizeRow);
}

export async function getInBodyMeasurementById(id: string): Promise<InBodyMeasurement | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see this file's top comment
  const row = await (prisma as any).inBodyMeasurement.findUnique({ where: { id } });
  return row ? normalizeRow(row) : null;
}

/**
 * Runs OCR over the uploaded image, best-effort parses the ten core fields
 * out of the resulting text (see inbody-parser.ts for exactly which fields
 * come through reliably and which don't), and stores the image + parsed
 * fields + raw OCR text as one record. Per the product decision behind this
 * feature, this always saves immediately -- there is no review step -- so
 * every field the parser couldn't confidently read is simply left null,
 * to be filled in or corrected later from the InBody page rather than
 * silently guessed here.
 */
export async function createInBodyMeasurementFromUpload(params: {
  userId: string;
  imageBuffer: Buffer;
  imageContentType: string;
  imageFilename: string | null;
}): Promise<InBodyMeasurement> {
  const { rawText } = await runInBodyOcr(params.imageBuffer);
  const parsed: ParsedInBodyFields = parseInBodyReport(rawText);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see this file's top comment
  const row = await (prisma as any).inBodyMeasurement.create({
    data: {
      userId: params.userId,
      measuredAt: parsed.measuredAt ?? new Date(),
      weightKg: parsed.weightKg,
      bodyFatPercentage: parsed.bodyFatPercentage,
      skeletalMuscleMassKg: parsed.skeletalMuscleMassKg,
      fatFreeMassKg: parsed.fatFreeMassKg,
      bmi: parsed.bmi,
      inBodyScore: parsed.inBodyScore,
      visceralFatLevel: parsed.visceralFatLevel,
      basalMetabolicRateKcal: parsed.basalMetabolicRateKcal,
      totalBodyWaterL: parsed.totalBodyWaterL,
      ecwRatio: parsed.ecwRatio,
      imageData: params.imageBuffer,
      imageContentType: params.imageContentType,
      imageFilename: params.imageFilename,
      rawOcrText: rawText,
    },
  });
  return normalizeRow(row);
}

export interface InBodyMeasurementFieldUpdate {
  measuredAt?: Date;
  weightKg?: number | null;
  bodyFatPercentage?: number | null;
  skeletalMuscleMassKg?: number | null;
  fatFreeMassKg?: number | null;
  bmi?: number | null;
  inBodyScore?: number | null;
  visceralFatLevel?: number | null;
  basalMetabolicRateKcal?: number | null;
  totalBodyWaterL?: number | null;
  ecwRatio?: number | null;
}

/** Manual correction of any OCR-parsed field -- never touches the stored image or rawOcrText. */
export async function updateInBodyMeasurement(
  id: string,
  input: InBodyMeasurementFieldUpdate,
): Promise<InBodyMeasurement> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see this file's top comment
  const row = await (prisma as any).inBodyMeasurement.update({ where: { id }, data: input });
  return normalizeRow(row);
}

export async function deleteInBodyMeasurement(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see this file's top comment
  await (prisma as any).inBodyMeasurement.delete({ where: { id } });
}
