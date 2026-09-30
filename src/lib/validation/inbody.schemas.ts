import { z } from 'zod';

/**
 * Every field here is independently optional and nullable: this schema
 * backs the manual-correction PATCH endpoint (src/app/api/inbody/[id]/
 * route.ts), where the whole point is filling in or fixing whichever
 * individual fields OCR missed or misread -- see inbody-parser.ts for why
 * that's expected to happen on some fraction of uploads. `null` clears a
 * field back to "not recorded" rather than leaving the previous value.
 */
export const UpdateInBodyMeasurementSchema = z.object({
  measuredAt: z.coerce.date().optional(),
  weightKg: z.coerce.number().min(25).max(300).nullable().optional(),
  bodyFatPercentage: z.coerce.number().min(2).max(70).nullable().optional(),
  skeletalMuscleMassKg: z.coerce.number().min(10).max(90).nullable().optional(),
  fatFreeMassKg: z.coerce.number().min(15).max(150).nullable().optional(),
  bmi: z.coerce.number().min(10).max(70).nullable().optional(),
  inBodyScore: z.coerce.number().int().min(0).max(100).nullable().optional(),
  visceralFatLevel: z.coerce.number().int().min(1).max(30).nullable().optional(),
  basalMetabolicRateKcal: z.coerce.number().int().min(500).max(5000).nullable().optional(),
  totalBodyWaterL: z.coerce.number().min(10).max(80).nullable().optional(),
  ecwRatio: z.coerce.number().min(0.3).max(0.45).nullable().optional(),
});

export type UpdateInBodyMeasurementInput = z.infer<typeof UpdateInBodyMeasurementSchema>;

// The upload route parses multipart/form-data directly (see
// src/app/api/inbody/route.ts) rather than JSON, so there is no matching
// CreateInBodyMeasurementSchema here -- the only "input" on create is the
// image file itself, validated by content-type/size in the route handler.
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB -- a high-resolution phone photo comfortably fits
// Deliberately not HEIC/HEIF: sharp's prebuilt binaries don't reliably
// bundle libheif decoding (HEIF/HEVC's own licensing keeps it out of most
// prebuilt distributions), so accepting it here would mean silently
// failing at OCR time rather than at upload time. iOS's own share sheet
// and most browsers already offer "Most Compatible" / auto-convert to JPEG
// when picking a photo for a web upload, which covers the common case.
export const ACCEPTED_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
