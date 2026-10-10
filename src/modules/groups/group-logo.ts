/**
 * Group logo validation. The logo is stored in Postgres and served publicly
 * (it appears in invitation emails), so the bytes are verified rather than
 * trusting the declared content type: raster formats only (never SVG — it
 * can carry script), size-capped, and the magic bytes must match.
 */

export const MAX_LOGO_BYTES = 1024 * 1024; // 1 MB

export type LogoContentType = 'image/png' | 'image/jpeg' | 'image/webp';

export class InvalidLogoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLogoError';
  }
}

function matchesMagic(bytes: Buffer, contentType: LogoContentType): boolean {
  switch (contentType) {
    case 'image/png':
      return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/jpeg':
      return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case 'image/webp':
      return (
        bytes.length > 12 &&
        bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
        bytes.subarray(8, 12).toString('ascii') === 'WEBP'
      );
  }
}

export function decodeLogo(input: { contentType: LogoContentType; dataBase64: string }): {
  data: Buffer;
  contentType: LogoContentType;
} {
  // Tolerate a data-URL prefix some pickers produce.
  const base64 = input.dataBase64.replace(/^data:[^;]+;base64,/, '');
  const data = Buffer.from(base64, 'base64');
  if (data.length === 0) throw new InvalidLogoError('The logo file is empty');
  if (data.length > MAX_LOGO_BYTES) throw new InvalidLogoError('The logo must be at most 1 MB');
  if (!matchesMagic(data, input.contentType)) {
    throw new InvalidLogoError('The logo is not a valid PNG, JPEG or WebP image');
  }
  return { data, contentType: input.contentType };
}
