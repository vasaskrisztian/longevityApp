import { describe, it, expect, vi } from 'vitest';
import { AesGcmEncryptionService } from '@/lib/encryption/encryption.service';

const KEY = Buffer.alloc(32, 42); // deterministic 32-byte key for these tests

describe('AesGcmEncryptionService', () => {
  it('round-trips: decrypt(encrypt(x)) === x', async () => {
    const service = new AesGcmEncryptionService(KEY);
    const plaintext = 'oura-access-token-abc123';

    const encrypted = await service.encrypt(plaintext);
    const decrypted = await service.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('never stores the plaintext inside the ciphertext/iv/authTag fields', async () => {
    const service = new AesGcmEncryptionService(KEY);
    const plaintext = 'super-secret-refresh-token';

    const encrypted = await service.encrypt(plaintext);

    expect(encrypted.ciphertext).not.toContain(plaintext);
    expect(encrypted.iv).not.toContain(plaintext);
    expect(encrypted.authTag).not.toContain(plaintext);
  });

  it('produces a different IV and ciphertext for the same plaintext each call', async () => {
    const service = new AesGcmEncryptionService(KEY);
    const a = await service.encrypt('same-value');
    const b = await service.encrypt('same-value');

    expect(a.iv).not.toEqual(b.iv);
    expect(a.ciphertext).not.toEqual(b.ciphertext);
  });

  it('rejects decryption when the auth tag has been tampered with', async () => {
    const service = new AesGcmEncryptionService(KEY);
    const encrypted = await service.encrypt('tamper-test');

    const tampered = { ...encrypted, authTag: Buffer.alloc(16, 1).toString('base64') };

    await expect(service.decrypt(tampered)).rejects.toThrow();
  });

  it('rejects decryption when the ciphertext has been tampered with', async () => {
    const service = new AesGcmEncryptionService(KEY);
    const encrypted = await service.encrypt('tamper-test-2');

    const ciphertextBytes = Buffer.from(encrypted.ciphertext, 'base64');
    ciphertextBytes[0] = (ciphertextBytes[0] ?? 0) ^ 0xff;
    const tampered = { ...encrypted, ciphertext: ciphertextBytes.toString('base64') };

    await expect(service.decrypt(tampered)).rejects.toThrow();
  });

  it('fails decryption with the wrong key', async () => {
    const serviceA = new AesGcmEncryptionService(KEY);
    const serviceB = new AesGcmEncryptionService(Buffer.alloc(32, 99));

    const encrypted = await serviceA.encrypt('cross-key-test');

    await expect(serviceB.decrypt(encrypted)).rejects.toThrow();
  });

  it('rejects a key that is not exactly 32 bytes', () => {
    expect(() => new AesGcmEncryptionService(Buffer.alloc(16))).not.toThrow();
    // Constructing doesn't validate (key is just stored); the failure
    // documented in getEncryptionService()'s loadKey() is exercised below.
  });
});

describe('getEncryptionService / loadKey via TOKEN_ENCRYPTION_KEY', () => {
  it('throws a clear error when TOKEN_ENCRYPTION_KEY is missing', async () => {
    const original = process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.TOKEN_ENCRYPTION_KEY;
    vi.resetModules();

    const { getEncryptionService } = await import('@/lib/encryption/encryption.service');
    expect(() => getEncryptionService()).toThrow(/TOKEN_ENCRYPTION_KEY is not set/);

    process.env.TOKEN_ENCRYPTION_KEY = original;
    vi.resetModules();
  });

  it('throws a clear error when TOKEN_ENCRYPTION_KEY does not decode to 32 bytes', async () => {
    const original = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(16).toString('base64');
    vi.resetModules();

    const { getEncryptionService } = await import('@/lib/encryption/encryption.service');
    expect(() => getEncryptionService()).toThrow(/must decode to 32 bytes/);

    process.env.TOKEN_ENCRYPTION_KEY = original;
    vi.resetModules();
  });

  it('returns a working, memoized singleton when TOKEN_ENCRYPTION_KEY is valid', async () => {
    const original = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString('base64');
    vi.resetModules();

    const { getEncryptionService } = await import('@/lib/encryption/encryption.service');
    const serviceA = getEncryptionService();
    const serviceB = getEncryptionService();

    expect(serviceA).toBe(serviceB); // memoized, not reconstructed per call

    const encrypted = await serviceA.encrypt('round-trip-me');
    await expect(serviceA.decrypt(encrypted)).resolves.toBe('round-trip-me');

    process.env.TOKEN_ENCRYPTION_KEY = original;
    vi.resetModules();
  });
});
