import {
  requireAuthenticatedUser,
  requireOwnResourceOrAdmin,
  toErrorResponse,
} from '@/lib/auth/authorization';
import { getInBodyMeasurementById } from '@/modules/inbody/inbody.service';

/**
 * Serves the original uploaded photo/scan bytes, kept out of the JSON
 * endpoints in ../route.ts and ../[id]/route.ts so a list of measurements
 * stays a small payload regardless of image size -- an <img src> or a
 * "view original" link points here directly, same ownership check as every
 * other by-id endpoint in this module.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    return toErrorResponse(error);
  }

  const measurement = await getInBodyMeasurementById(params.id);
  if (!measurement) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    await requireOwnResourceOrAdmin(measurement.userId);
  } catch (error) {
    return toErrorResponse(error);
  }

  // Buffer's ArrayBufferLike generic doesn't structurally satisfy
  // BodyInit's stricter ArrayBufferView<ArrayBuffer> under this TS lib
  // version; a fresh Uint8Array view is a plain copy-free re-wrap that
  // does satisfy it, with no behavior change.
  return new Response(new Uint8Array(measurement.imageData), {
    status: 200,
    headers: {
      'Content-Type': measurement.imageContentType,
      // Private: this is the user's own health-record photo, never a
      // shared/public asset -- caches must not store it on a shared proxy.
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
