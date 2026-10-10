jest.mock('expo-image-picker', () => ({}));
import { decodedSize, logoFromAsset, MAX_LOGO_BYTES } from '../logoPicker';

const b64 = (bytes: number) => Buffer.alloc(bytes, 1).toString('base64');

describe('decodedSize', () => {
  it('matches the real byte length incl. padding', () => {
    for (const n of [1, 2, 3, 100, 1001]) expect(decodedSize(b64(n))).toBe(n);
  });
});

describe('logoFromAsset', () => {
  it('accepts png/jpeg/webp and normalises image/jpg', () => {
    const ok = logoFromAsset({ base64: b64(10), mimeType: 'image/jpg', uri: 'file://x' });
    expect(ok).toEqual({ ok: true, upload: { contentType: 'image/jpeg', dataBase64: b64(10) }, previewUri: 'file://x' });
    expect(logoFromAsset({ base64: b64(10), mimeType: 'image/png', uri: 'u' }).ok).toBe(true);
    expect(logoFromAsset({ base64: b64(10), mimeType: 'image/webp', uri: 'u' }).ok).toBe(true);
  });
  it('rejects other types, missing data and oversized images', () => {
    expect(logoFromAsset({ base64: b64(10), mimeType: 'image/gif', uri: 'u' }).ok).toBe(false);
    expect(logoFromAsset({ base64: null, mimeType: 'image/png', uri: 'u' }).ok).toBe(false);
    expect(logoFromAsset({ base64: b64(MAX_LOGO_BYTES + 1), mimeType: 'image/png', uri: 'u' }).ok).toBe(false);
    expect(logoFromAsset({ base64: b64(MAX_LOGO_BYTES), mimeType: 'image/png', uri: 'u' }).ok).toBe(true);
  });
});
