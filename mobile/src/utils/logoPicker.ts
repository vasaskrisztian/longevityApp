import * as ImagePicker from 'expo-image-picker';

import type { LogoUpload } from '@/src/api/groups';

/** Server limit (src/modules/groups/group-logo.ts); checked here for a friendly message before uploading. */
export const MAX_LOGO_BYTES = 1024 * 1024;

export type PickedLogo = { ok: true; upload: LogoUpload; previewUri: string } | { ok: false; message: string };

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'] as const;

export function decodedSize(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** Turns a picker result into the upload payload, or a human-readable reason it can't be used. */
export function logoFromAsset(asset: { base64?: string | null; mimeType?: string | null; uri: string }): PickedLogo {
  const mime = (asset.mimeType ?? '').toLowerCase().replace('image/jpg', 'image/jpeg');
  if (!ACCEPTED.includes(mime as (typeof ACCEPTED)[number])) {
    return { ok: false, message: 'Use a PNG, JPEG or WebP image.' };
  }
  if (!asset.base64) return { ok: false, message: 'Could not read the image. Try another one.' };
  if (decodedSize(asset.base64) > MAX_LOGO_BYTES) {
    return { ok: false, message: 'The logo must be at most 1 MB. Pick a smaller image.' };
  }
  return {
    ok: true,
    upload: { contentType: mime as LogoUpload['contentType'], dataBase64: asset.base64 },
    previewUri: asset.uri,
  };
}

/** Opens the photo library; `null` = the user cancelled. */
export async function pickLogo(): Promise<PickedLogo | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { ok: false, message: 'Photo library access is needed to choose a logo.' };
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    base64: true,
    quality: 0.8,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return logoFromAsset(result.assets[0]);
}
