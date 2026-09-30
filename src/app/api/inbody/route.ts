import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import {
  MAX_UPLOAD_BYTES,
  ACCEPTED_IMAGE_CONTENT_TYPES,
} from '@/lib/validation/inbody.schemas';
import {
  listInBodyMeasurements,
  createInBodyMeasurementFromUpload,
} from '@/modules/inbody/inbody.service';
import { toInBodyMeasurementDTO } from './dto';
import { logger } from '@/lib/logging/logger';

export async function GET() {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const measurements = await listInBodyMeasurements(userId);
  return Response.json(measurements.map(toInBodyMeasurementDTO), { status: 200 });
}

/**
 * multipart/form-data, not JSON: the only input is the photographed/
 * scanned report image itself (field name "image") -- see
 * inbody.schemas.ts's comment on why there's no matching Zod object schema
 * the way every other Create*Schema in this app has one.
 */
export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('image');
  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'An image file is required (field "image").' }, { status: 400 });
  }
  if (!ACCEPTED_IMAGE_CONTENT_TYPES.includes(file.type)) {
    return Response.json(
      { error: `Unsupported image type "${file.type}". Use JPEG, PNG, or WebP.` },
      { status: 400 },
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: `Image is too large (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB).` },
      { status: 400 },
    );
  }

  const imageBuffer = Buffer.from(await file.arrayBuffer());

  try {
    const measurement = await createInBodyMeasurementFromUpload({
      userId,
      imageBuffer,
      imageContentType: file.type,
      imageFilename: file.name || null,
    });
    return Response.json(toInBodyMeasurementDTO(measurement), { status: 201 });
  } catch (error) {
    const message = (error as Error).message;
    logger.error('inbody_upload_failed', { message });
    // Distinguished from the generic case so a stuck-OCR incident is
    // visible to the user as "it timed out, try again" rather than an
    // indistinguishable "something went wrong" -- see
    // inbody-ocr.service.ts's OCR_TIMEOUT_MS.
    const isTimeout = message.includes('OCR timed out');
    return Response.json(
      {
        error: isTimeout
          ? 'Reading the report took too long and was stopped. Please try again.'
          : 'Failed to process the uploaded image',
      },
      { status: isTimeout ? 504 : 500 },
    );
  }
}
