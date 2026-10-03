import { Platform } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';

import { apiFetch, apiFetchJson, ApiError } from '@/src/api/client';
import { getValidAccessToken } from '@/src/auth/sessionStore';
import { API_BASE_URL } from '@/src/config/env';

/**
 * Phase 21 — mirrors src/app/api/inbody/dto.ts's InBodyMeasurementDTO on the
 * root app exactly (field-for-field). `imageData` is excluded there too —
 * the photo itself is served separately by GET /api/inbody/[id]/image (see
 * getInBodyImageSource below) so this list payload stays small.
 */
export interface InBodyMeasurement {
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

export type NumericField =
  | 'weightKg'
  | 'bodyFatPercentage'
  | 'skeletalMuscleMassKg'
  | 'fatFreeMassKg'
  | 'bmi'
  | 'inBodyScore'
  | 'visceralFatLevel'
  | 'basalMetabolicRateKcal'
  | 'totalBodyWaterL'
  | 'ecwRatio';

/**
 * One source of truth for every metric this screen shows/edits — same role
 * as inbody-manager.tsx's FIELD_DEFS on the root app, kept here (rather than
 * in the screen file) so api/inbody.ts and the screen can't drift apart on
 * field order either. Ranges are enforced server-side
 * (src/lib/validation/inbody.schemas.ts); this is display metadata only.
 */
export const FIELD_DEFS: { key: NumericField; label: string; unit?: string; step: string; integer?: boolean }[] = [
  { key: 'weightKg', label: 'Weight', unit: 'kg', step: '0.1' },
  { key: 'bodyFatPercentage', label: 'Body Fat', unit: '%', step: '0.1' },
  { key: 'skeletalMuscleMassKg', label: 'Skeletal Muscle Mass', unit: 'kg', step: '0.1' },
  { key: 'fatFreeMassKg', label: 'Fat-Free Mass', unit: 'kg', step: '0.1' },
  { key: 'bmi', label: 'BMI', step: '0.1' },
  { key: 'inBodyScore', label: 'InBody Score', step: '1', integer: true },
  { key: 'visceralFatLevel', label: 'Visceral Fat Level', step: '1', integer: true },
  { key: 'basalMetabolicRateKcal', label: 'BMR', unit: 'kcal', step: '1', integer: true },
  { key: 'totalBodyWaterL', label: 'Total Body Water', unit: 'L', step: '0.1' },
  { key: 'ecwRatio', label: 'ECW Ratio', step: '0.001' },
];

export function listInBodyMeasurements(): Promise<InBodyMeasurement[]> {
  return apiFetchJson<InBodyMeasurement[]>('/api/inbody');
}

/**
 * Empty-string-clears-the-field semantics (not zod-validated client-side,
 * deliberately — same as the root app's EditForm): a blank input means
 * "clear this value back to not recorded," which z.coerce.number() can't
 * express (Number('') is 0, not null/NaN). The server's
 * UpdateInBodyMeasurementSchema remains the real range/shape check, same as
 * every other PATCH on this app.
 */
export function updateInBodyMeasurement(
  id: string,
  patch: Partial<Record<NumericField, number | null>> & { measuredAt?: string },
): Promise<InBodyMeasurement> {
  return apiFetchJson<InBodyMeasurement>(`/api/inbody/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteInBodyMeasurement(id: string): Promise<void> {
  const response = await apiFetch(`/api/inbody/${id}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete measurement (${response.status}).`);
  }
}

/**
 * Uploads a picked/captured photo for OCR (synchronous server-side — see
 * src/modules/inbody/inbody-ocr.service.ts on the root app; a response here
 * can take up to ~90s). Deliberately bypasses the shared apiFetch wrapper:
 * that helper always sets Content-Type: application/json
 * (src/api/client.ts), which would break the multipart boundary fetch/RN
 * needs to generate itself for a FormData body.
 *
 * The file-part shape is the one genuinely platform-specific piece:
 * - Native (iOS/Android): expo-image-picker's `uri` is a file:// path.
 *   React Native's fetch/FormData polyfill accepts a plain
 *   `{ uri, name, type }` object as a file-like value directly — see
 *   https://reactnative.dev/docs/network#multipart-form-data.
 * - Web: expo-image-picker's web implementation
 *   (node_modules/expo-image-picker/src/ExponentImagePicker.web.ts) reads
 *   the file with FileReader.readAsDataURL, so `uri` is a base64 `data:`
 *   URI, not a File/Blob — there is no `asset.file` to use directly.
 *   Round-tripping it through fetch() turns the data: URI back into a real
 *   Blob (fetch supports data: URIs with no network call involved), which
 *   FormData can then attach as a proper multipart file part.
 */
export async function uploadInBodyImage(asset: ImagePickerAsset): Promise<InBodyMeasurement> {
  const fileName = asset.fileName ?? `inbody-${Date.now()}.jpg`;
  const mimeType = asset.mimeType ?? 'image/jpeg';

  const formData = new FormData();
  if (Platform.OS === 'web') {
    const blob = await fetch(asset.uri).then((r) => r.blob());
    formData.append('image', blob, fileName);
  } else {
    formData.append('image', { uri: asset.uri, name: fileName, type: mimeType } as unknown as Blob);
  }

  const accessToken = await getValidAccessToken();
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  // Same 100s client-side backstop as the web app's UploadForm, a bit past
  // the server's own 90s OCR timeout — catches a dropped connection that
  // never comes back with any response at all.
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), 100_000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/inbody`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiError(response.status, body?.error ?? `Upload failed (${response.status}).`);
    }
    return (await response.json()) as InBodyMeasurement;
  } finally {
    clearTimeout(abortTimer);
  }
}

export type InBodyImageSource = { uri: string; headers?: Record<string, string> };

/**
 * Resolves a displayable source for GET /api/inbody/[id]/image, which
 * requires a Bearer Authorization header — something a plain
 * `<Image source={{ uri }}>` never sends. The two platforms need genuinely
 * different mechanisms:
 * - Native: RN's own Image component supports a `headers` field on its
 *   source object and attaches it to the native image-loading request
 *   directly, so no pre-fetch is needed.
 * - Web: react-native-web's Image renders a plain `<img>`, and a browser's
 *   `<img src>` cannot carry custom headers at all. So on web this
 *   pre-fetches the bytes with the Bearer token attached (via apiFetch) and
 *   hands back a `blob:` object URL instead — the caller is responsible for
 *   calling `URL.revokeObjectURL` on it once it's no longer shown (e.g. in
 *   a cleanup effect).
 */
export async function getInBodyImageSource(id: string): Promise<InBodyImageSource> {
  const path = `/api/inbody/${id}/image`;
  if (Platform.OS === 'web') {
    const response = await apiFetch(path);
    if (!response.ok) throw new Error(`Failed to load photo (${response.status}).`);
    const blob = await response.blob();
    return { uri: URL.createObjectURL(blob) };
  }
  const accessToken = await getValidAccessToken();
  return {
    uri: `${API_BASE_URL}${path}`,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  };
}
