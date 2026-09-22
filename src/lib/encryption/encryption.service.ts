import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

/**
 * Encrypted-at-rest representation of a secret. Every field is stored
 * separately in the DB (see EncryptedCredential in prisma/schema.prisma) so
 * that a partial row is useless without all three parts.
 */
export interface EncryptedValue {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
}

/**
 * Abstraction over "encrypt/decrypt a secret string". The default
 * implementation uses AES-256-GCM with a key from TOKEN_ENCRYPTION_KEY.
 * Swapping in AWS KMS / GCP KMS / Azure Key Vault later means implementing
 * this interface again — nothing that calls EncryptionService needs to
 * change (see ARCHITECTURE.md §16).
 */
export interface EncryptionService {
  encrypt(value: string): Promise<EncryptedValue>;
  decrypt(value: EncryptedValue): Promise<string>;
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // 96-bit IV is the GCM-recommended size

function loadKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32',
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to 32 bytes for AES-256-GCM, got ${key.length}.`,
    );
  }
  return key;
}

export class AesGcmEncryptionService implements EncryptionService {
  private readonly key: Buffer;

  constructor(key: Buffer = loadKey()) {
    this.key = key;
  }

  async encrypt(value: string): Promise<EncryptedValue> {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  async decrypt(value: EncryptedValue): Promise<string> {
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(value.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(value.authTag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, 'base64')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }
}

// Lazily constructed so importing this module never throws in contexts
// (like `next build` static analysis) where the env var isn't set yet.
let singleton: EncryptionService | undefined;
export function getEncryptionService(): EncryptionService {
  if (!singleton) {
    singleton = new AesGcmEncryptionService();
  }
  return singleton;
}
