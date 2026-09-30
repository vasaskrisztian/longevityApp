import type { InBodyMeasurement } from '@/modules/inbody/inbody.service';

/**
 * The wire shape for both the list and single-record endpoints. Excludes
 * `imageData` (served separately by GET /api/inbody/[id]/image so the list
 * endpoint's payload stays small regardless of how many photos a user has
 * uploaded) but keeps `rawOcrText`, since the InBody page shows it as a
 * "what we read off the photo" fallback wherever a field came back null.
 */
export interface InBodyMeasurementDTO {
  id: string;
  measuredAt: string;
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
  rawOcrText: string | null;
  createdAt: string;
}

export function toInBodyMeasurementDTO(measurement: InBodyMeasurement): InBodyMeasurementDTO {
  return {
    id: measurement.id,
    measuredAt: measurement.measuredAt.toISOString(),
    weightKg: measurement.weightKg,
    bodyFatPercentage: measurement.bodyFatPercentage,
    skeletalMuscleMassKg: measurement.skeletalMuscleMassKg,
    fatFreeMassKg: measurement.fatFreeMassKg,
    bmi: measurement.bmi,
    inBodyScore: measurement.inBodyScore,
    visceralFatLevel: measurement.visceralFatLevel,
    basalMetabolicRateKcal: measurement.basalMetabolicRateKcal,
    totalBodyWaterL: measurement.totalBodyWaterL,
    ecwRatio: measurement.ecwRatio,
    rawOcrText: measurement.rawOcrText,
    createdAt: measurement.createdAt.toISOString(),
  };
}
