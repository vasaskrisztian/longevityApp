import type { LogoUpload } from './groups-api';

/** Server limit (src/modules/groups/group-logo.ts); checked here for a friendly message before uploading. */
export const MAX_LOGO_BYTES = 1024 * 1024;

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'] as const;

export type PickedLogo = { ok: true; upload: LogoUpload } | { ok: false; message: string };

export function decodedSize(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** Validates a picked file's type/size and builds the upload payload from its base64 data. */
export function logoFromBase64(mimeType: string, base64: string): PickedLogo {
  const mime = mimeType.toLowerCase().replace('image/jpg', 'image/jpeg');
  if (!ACCEPTED.includes(mime as (typeof ACCEPTED)[number])) {
    return { ok: false, message: 'Use a PNG, JPEG or WebP image.' };
  }
  if (!base64) return { ok: false, message: 'Could not read the image. Try another one.' };
  if (decodedSize(base64) > MAX_LOGO_BYTES) {
    return { ok: false, message: 'The logo must be at most 1 MB. Pick a smaller image.' };
  }
  return { ok: true, upload: { contentType: mime as LogoUpload['contentType'], dataBase64: base64 } };
}

/** Browser: reads a File into the upload payload. */
export function logoFromFile(file: File): Promise<PickedLogo> {
  return new Promise((resolve) => {
    if (file.size > MAX_LOGO_BYTES) {
      resolve({ ok: false, message: 'The logo must be at most 1 MB. Pick a smaller image.' });
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => resolve({ ok: false, message: 'Could not read the image. Try another one.' });
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(logoFromBase64(file.type, result.slice(result.indexOf(',') + 1)));
    };
    reader.readAsDataURL(file);
  });
}
