import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = { wearableConnection: { findFirst: vi.fn() } };
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logging/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
const loadCredential = vi.fn();
vi.mock('@/modules/wearable/services/credential-vault.service', () => ({ loadCredential }));
const revokeTokens = vi.fn();
vi.mock('@/modules/wearable/providers/oura/oura-provider', () => ({ getOuraProvider: () => ({ revokeTokens }) }));

const { revokeProviderAccessForUser } = await import('@/modules/wearable/services/provider-access.service');

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.wearableConnection.findFirst.mockResolvedValue({ id: 'c1' });
  loadCredential.mockResolvedValue({ accessToken: 'tok' });
  revokeTokens.mockResolvedValue(undefined);
});

describe('revokeProviderAccessForUser', () => {
  it('revokes the Oura access token at Oura for a connected user', async () => {
    await revokeProviderAccessForUser('u1');
    expect(revokeTokens).toHaveBeenCalledWith({ accessToken: 'tok' });
  });
  it('does nothing without an active connection or stored credential', async () => {
    prismaMock.wearableConnection.findFirst.mockResolvedValue(null);
    await revokeProviderAccessForUser('u1');
    prismaMock.wearableConnection.findFirst.mockResolvedValue({ id: 'c1' });
    loadCredential.mockResolvedValue(null);
    await revokeProviderAccessForUser('u1');
    expect(revokeTokens).not.toHaveBeenCalled();
  });
  it('never throws, even when Oura or the database fails', async () => {
    revokeTokens.mockRejectedValue(new Error('network'));
    await expect(revokeProviderAccessForUser('u1')).resolves.toBeUndefined();
    prismaMock.wearableConnection.findFirst.mockRejectedValue(new Error('db'));
    await expect(revokeProviderAccessForUser('u1')).resolves.toBeUndefined();
  });
});
