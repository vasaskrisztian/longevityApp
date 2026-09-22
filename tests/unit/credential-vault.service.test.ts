import { describe, it, expect, vi, beforeEach } from 'vitest';

// Deliberately NOT mocking lib/encryption — this suite exercises the real
// AES-256-GCM service (tests/setup/env.ts already provides a valid
// TOKEN_ENCRYPTION_KEY for the whole run) so the round-trip assertions below
// prove actual encryption is happening, not just that some string gets
// passed through to Prisma.
const prismaMock = {
  encryptedCredential: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  },
};

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

const { saveCredential, loadCredential, deleteCredential, rotateCredential } = await import(
  '@/modules/wearable/services/credential-vault.service'
);

const TOKEN_SET = {
  accessToken: 'oura-access-token-abc123',
  accessTokenExpiresAt: new Date('2026-01-01T01:00:00Z'),
  refreshToken: 'oura-refresh-token-xyz789',
  grantedScopes: ['personal', 'daily'],
};

beforeEach(() => {
  vi.clearAllMocks();
});

interface UpsertCallArgs {
  where: { connectionId: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: Record<string, any>;
}

function upsertCallArgs(index: number): UpsertCallArgs {
  const call = prismaMock.encryptedCredential.upsert.mock.calls[index];
  if (!call) {
    throw new Error(`upsert was not called a ${index + 1}th time`);
  }
  return call[0] as UpsertCallArgs;
}

describe('saveCredential', () => {
  it('never writes the plaintext access or refresh token to the database', async () => {
    prismaMock.encryptedCredential.upsert.mockResolvedValue({});

    await saveCredential('conn-1', TOKEN_SET);

    const call = upsertCallArgs(0);
    const serialized = JSON.stringify(call);
    expect(serialized).not.toContain(TOKEN_SET.accessToken);
    expect(serialized).not.toContain(TOKEN_SET.refreshToken);
  });

  it('creates a new row with refreshVersion 0 and the encrypted fields, keyed by connectionId', async () => {
    prismaMock.encryptedCredential.upsert.mockResolvedValue({});

    await saveCredential('conn-1', TOKEN_SET);

    const call = upsertCallArgs(0);
    expect(call.where).toEqual({ connectionId: 'conn-1' });
    expect(call.create).toMatchObject({
      connectionId: 'conn-1',
      accessTokenExpiresAt: TOKEN_SET.accessTokenExpiresAt,
      refreshVersion: 0,
    });
    expect(typeof call.create.accessTokenCipher).toBe('string');
    expect(call.create.accessTokenCipher.length).toBeGreaterThan(0);
    expect(typeof call.create.accessTokenIv).toBe('string');
    expect(typeof call.create.accessTokenAuthTag).toBe('string');
    expect(typeof call.create.refreshTokenCipher).toBe('string');
    expect(typeof call.create.refreshTokenIv).toBe('string');
    expect(typeof call.create.refreshTokenAuthTag).toBe('string');
  });

  it('the update branch omits refreshVersion — only the rotating-refresh flow (Phase 4) may bump it', async () => {
    prismaMock.encryptedCredential.upsert.mockResolvedValue({});

    await saveCredential('conn-1', TOKEN_SET);

    const call = upsertCallArgs(0);
    expect(call.update).not.toHaveProperty('refreshVersion');
    expect(call.update).toMatchObject({
      accessTokenExpiresAt: TOKEN_SET.accessTokenExpiresAt,
    });
  });

  it('encrypts the access and refresh token to different ciphertext each call (fresh IV)', async () => {
    prismaMock.encryptedCredential.upsert.mockResolvedValue({});

    await saveCredential('conn-1', TOKEN_SET);
    await saveCredential('conn-1', TOKEN_SET);

    const first = upsertCallArgs(0);
    const second = upsertCallArgs(1);
    expect(first.create.accessTokenCipher).not.toBe(second.update.accessTokenCipher);
  });
});

describe('loadCredential', () => {
  it('returns null when no credential row exists for the connection', async () => {
    prismaMock.encryptedCredential.findUnique.mockResolvedValue(null);

    const result = await loadCredential('conn-missing');

    expect(result).toBeNull();
  });

  it('round-trips through save then load: decrypted tokens match what was saved', async () => {
    let storedRow: Record<string, unknown> | undefined;
    prismaMock.encryptedCredential.upsert.mockImplementation(({ create }: { create: Record<string, unknown> }) => {
      storedRow = { ...create, refreshVersion: 0 };
      return Promise.resolve(storedRow);
    });

    await saveCredential('conn-1', TOKEN_SET);

    prismaMock.encryptedCredential.findUnique.mockResolvedValue(storedRow);

    const loaded = await loadCredential('conn-1');

    expect(loaded).not.toBeNull();
    expect(loaded?.accessToken).toBe(TOKEN_SET.accessToken);
    expect(loaded?.refreshToken).toBe(TOKEN_SET.refreshToken);
    expect(loaded?.accessTokenExpiresAt).toEqual(TOKEN_SET.accessTokenExpiresAt);
    expect(loaded?.refreshVersion).toBe(0);
  });

  it('queries by connectionId', async () => {
    prismaMock.encryptedCredential.findUnique.mockResolvedValue(null);

    await loadCredential('conn-42');

    expect(prismaMock.encryptedCredential.findUnique).toHaveBeenCalledWith({
      where: { connectionId: 'conn-42' },
    });
  });
});

describe('deleteCredential', () => {
  it('deletes by connectionId and does not throw when nothing matched (idempotent)', async () => {
    prismaMock.encryptedCredential.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteCredential('conn-never-existed')).resolves.toBeUndefined();
    expect(prismaMock.encryptedCredential.deleteMany).toHaveBeenCalledWith({
      where: { connectionId: 'conn-never-existed' },
    });
  });
});

describe('rotateCredential', () => {
  const NEW_TOKENS = {
    accessToken: 'rotated-access-token',
    accessTokenExpiresAt: new Date('2026-02-01T00:00:00Z'),
    refreshToken: 'rotated-refresh-token',
    grantedScopes: ['personal'],
  };

  it('never writes the plaintext access or refresh token to the database', async () => {
    prismaMock.encryptedCredential.updateMany.mockResolvedValue({ count: 1 });

    await rotateCredential('conn-1', NEW_TOKENS, 0);

    const call = prismaMock.encryptedCredential.updateMany.mock.calls[0]?.[0];
    const serialized = JSON.stringify(call);
    expect(serialized).not.toContain(NEW_TOKENS.accessToken);
    expect(serialized).not.toContain(NEW_TOKENS.refreshToken);
  });

  it('CASes on the expected refreshVersion and increments it atomically, returning true on success', async () => {
    prismaMock.encryptedCredential.updateMany.mockResolvedValue({ count: 1 });

    const result = await rotateCredential('conn-1', NEW_TOKENS, 5);

    expect(result).toBe(true);
    expect(prismaMock.encryptedCredential.updateMany).toHaveBeenCalledWith({
      where: { connectionId: 'conn-1', refreshVersion: 5 },
      data: expect.objectContaining({
        accessTokenExpiresAt: NEW_TOKENS.accessTokenExpiresAt,
        refreshVersion: { increment: 1 },
      }),
    });
  });

  it('returns false (without throwing) when the version has moved underneath it', async () => {
    prismaMock.encryptedCredential.updateMany.mockResolvedValue({ count: 0 });

    const result = await rotateCredential('conn-1', NEW_TOKENS, 5);

    expect(result).toBe(false);
  });
});
