import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  oAuthState: {
    create: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
};
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

const generateRawTokenMock = vi.fn();
vi.mock('@/lib/auth/tokens', () => ({ generateRawToken: generateRawTokenMock }));

const { createOAuthState, consumeOAuthState } = await import(
  '@/modules/wearable/services/oauth-state.service'
);
const { InvalidOAuthStateError } = await import('@/modules/wearable/domain/errors');

beforeEach(() => {
  vi.clearAllMocks();
  generateRawTokenMock.mockReturnValue('generated-state-value');
});

describe('createOAuthState', () => {
  it('generates the state via generateRawToken and persists it with a 10-minute default TTL', async () => {
    prismaMock.oAuthState.create.mockResolvedValue({});

    const before = Date.now();
    const result = await createOAuthState({
      userId: 'u1',
      provider: 'OURA',
      redirectUri: 'https://app.example.com/callback',
      codeVerifier: 'verifier-123',
    });
    const after = Date.now();

    expect(result.state).toBe('generated-state-value');
    expect(prismaMock.oAuthState.create).toHaveBeenCalledWith({
      data: {
        state: 'generated-state-value',
        userId: 'u1',
        provider: 'OURA',
        redirectUri: 'https://app.example.com/callback',
        codeVerifier: 'verifier-123',
        expiresAt: expect.any(Date),
      },
    });
    const expiresAtMs = result.expiresAt.getTime();
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + 10 * 60_000 - 1000);
    expect(expiresAtMs).toBeLessThanOrEqual(after + 10 * 60_000 + 1000);
  });

  it('honors a custom ttlMinutes', async () => {
    prismaMock.oAuthState.create.mockResolvedValue({});
    const before = Date.now();

    const result = await createOAuthState({
      userId: 'u1',
      provider: 'OURA',
      redirectUri: 'https://app.example.com/callback',
      ttlMinutes: 1,
    });

    expect(result.expiresAt.getTime()).toBeLessThan(before + 2 * 60_000);
  });
});

describe('consumeOAuthState', () => {
  it('marks the row used and returns its data when exactly one row matches', async () => {
    prismaMock.oAuthState.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.oAuthState.findUnique.mockResolvedValue({
      state: 'generated-state-value',
      userId: 'u1',
      redirectUri: 'https://app.example.com/callback',
      codeVerifier: 'verifier-123',
    });

    const result = await consumeOAuthState('generated-state-value', 'OURA');

    expect(prismaMock.oAuthState.updateMany).toHaveBeenCalledWith({
      where: {
        state: 'generated-state-value',
        provider: 'OURA',
        usedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { usedAt: expect.any(Date) },
    });
    expect(result).toEqual({
      userId: 'u1',
      redirectUri: 'https://app.example.com/callback',
      codeVerifier: 'verifier-123',
    });
  });

  it('throws InvalidOAuthStateError when no row matches (unknown/expired/already-used state)', async () => {
    prismaMock.oAuthState.updateMany.mockResolvedValue({ count: 0 });

    await expect(consumeOAuthState('nope', 'OURA')).rejects.toThrow(InvalidOAuthStateError);
    expect(prismaMock.oAuthState.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a state minted for a different provider', async () => {
    // The updateMany's own WHERE clause includes provider, so a mismatched
    // provider simply never matches — proven by asserting the exact filter.
    prismaMock.oAuthState.updateMany.mockResolvedValue({ count: 0 });

    await expect(consumeOAuthState('generated-state-value', 'GARMIN')).rejects.toThrow(
      InvalidOAuthStateError,
    );
    expect(prismaMock.oAuthState.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ provider: 'GARMIN' }) }),
    );
  });

  it('simulates two concurrent callbacks presenting the same state: only one succeeds', async () => {
    // The first updateMany "wins" (count: 1); the second, run against the
    // now-already-used row, sees count: 0 — this is the actual concurrency
    // guarantee, expressed at the level this mock can prove (the atomic
    // WHERE-usedAt-null clause is what a real Postgres would serialize).
    prismaMock.oAuthState.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prismaMock.oAuthState.findUnique.mockResolvedValue({
      state: 's',
      userId: 'u1',
      redirectUri: null,
      codeVerifier: null,
    });

    const first = await consumeOAuthState('s', 'OURA');
    expect(first.userId).toBe('u1');

    await expect(consumeOAuthState('s', 'OURA')).rejects.toThrow(InvalidOAuthStateError);
  });

  it('throws InvalidOAuthStateError in the (unreachable in practice) case the just-updated row cannot be re-read', async () => {
    prismaMock.oAuthState.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.oAuthState.findUnique.mockResolvedValue(null);

    await expect(consumeOAuthState('s', 'OURA')).rejects.toThrow(InvalidOAuthStateError);
  });
});
