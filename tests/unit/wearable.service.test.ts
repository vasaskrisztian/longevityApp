import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  wearableConnection: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

const {
  listConnectionsForUser,
  getConnectionForUserAndProvider,
  upsertConnectionAsConnected,
  markConnectionDisconnected,
  markConnectionAuthRequired,
  recordSyncOutcome,
} = await import('@/modules/wearable/services/wearable.service');

const OURA_ROW = {
  id: 'conn-1',
  userId: 'u1',
  provider: 'OURA',
  status: 'CONNECTED',
  connectedAt: new Date('2026-01-01T00:00:00Z'),
  disconnectedAt: null,
  grantedScopes: ['personal', 'daily'],
  lastSyncAt: new Date('2026-01-02T00:00:00Z'),
  lastSyncStatus: 'SUCCESS',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listConnectionsForUser', () => {
  it('scopes the query strictly to the given userId — proves no cross-user leakage is even possible at the query level', async () => {
    prismaMock.wearableConnection.findMany.mockResolvedValue([]);

    await listConnectionsForUser('u1');

    expect(prismaMock.wearableConnection.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('synthesizes a DISCONNECTED entry for every supported provider when the user has no rows', async () => {
    prismaMock.wearableConnection.findMany.mockResolvedValue([]);

    const result = await listConnectionsForUser('u1');

    expect(result).toEqual([
      {
        id: null,
        provider: 'OURA',
        status: 'DISCONNECTED',
        connectedAt: null,
        disconnectedAt: null,
        grantedScopes: [],
        lastSyncAt: null,
        lastSyncStatus: null,
      },
    ]);
  });

  it('returns the real row for a provider the user has connected', async () => {
    prismaMock.wearableConnection.findMany.mockResolvedValue([OURA_ROW]);

    const result = await listConnectionsForUser('u1');

    expect(result).toEqual([
      {
        id: 'conn-1',
        provider: 'OURA',
        status: 'CONNECTED',
        connectedAt: OURA_ROW.connectedAt,
        disconnectedAt: null,
        grantedScopes: ['personal', 'daily'],
        lastSyncAt: OURA_ROW.lastSyncAt,
        lastSyncStatus: 'SUCCESS',
      },
    ]);
  });

  it('defaults grantedScopes to an empty array when a row has none set', async () => {
    const rowWithoutScopes = { ...OURA_ROW, grantedScopes: null };
    prismaMock.wearableConnection.findMany.mockResolvedValue([rowWithoutScopes]);

    const result = await listConnectionsForUser('u1');

    expect(result[0]?.grantedScopes).toEqual([]);
  });

  it('picks the newest row when a provider has more than one (e.g. reconnected after a full revoke)', async () => {
    const older = { ...OURA_ROW, id: 'conn-old', status: 'DISCONNECTED' };
    const newer = { ...OURA_ROW, id: 'conn-new', status: 'CONNECTED' };
    // findMany is already ordered newest-first by the query itself.
    prismaMock.wearableConnection.findMany.mockResolvedValue([newer, older]);

    const result = await listConnectionsForUser('u1');

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('conn-new');
    expect(result[0]?.status).toBe('CONNECTED');
  });
});

describe('getConnectionForUserAndProvider', () => {
  it('queries by both userId and provider together', async () => {
    prismaMock.wearableConnection.findFirst.mockResolvedValue(null);

    await getConnectionForUserAndProvider('u1', 'OURA');

    expect(prismaMock.wearableConnection.findFirst).toHaveBeenCalledWith({
      where: { userId: 'u1', provider: 'OURA' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('returns a synthesized DISCONNECTED summary when no row exists', async () => {
    prismaMock.wearableConnection.findFirst.mockResolvedValue(null);

    const result = await getConnectionForUserAndProvider('u1', 'OURA');

    expect(result.status).toBe('DISCONNECTED');
    expect(result.id).toBeNull();
  });

  it('returns the mapped row when one exists', async () => {
    prismaMock.wearableConnection.findFirst.mockResolvedValue(OURA_ROW);

    const result = await getConnectionForUserAndProvider('u1', 'OURA');

    expect(result.id).toBe('conn-1');
    expect(result.status).toBe('CONNECTED');
  });
});

describe('upsertConnectionAsConnected', () => {
  it('creates a new CONNECTED row when the user has never attempted this provider', async () => {
    prismaMock.wearableConnection.findFirst.mockResolvedValue(null);
    prismaMock.wearableConnection.create.mockResolvedValue({ id: 'conn-new' });

    const result = await upsertConnectionAsConnected({
      userId: 'u1',
      provider: 'OURA',
      grantedScopes: ['personal', 'daily'],
    });

    expect(result).toEqual({ id: 'conn-new' });
    expect(prismaMock.wearableConnection.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        provider: 'OURA',
        status: 'CONNECTED',
        connectedAt: expect.any(Date),
        grantedScopes: ['personal', 'daily'],
      },
    });
    expect(prismaMock.wearableConnection.update).not.toHaveBeenCalled();
  });

  it('reuses and updates the existing row for this (userId, provider) rather than creating a duplicate', async () => {
    prismaMock.wearableConnection.findFirst.mockResolvedValue({ id: 'conn-old', status: 'DISCONNECTED' });
    prismaMock.wearableConnection.update.mockResolvedValue({ id: 'conn-old' });

    const result = await upsertConnectionAsConnected({
      userId: 'u1',
      provider: 'OURA',
      grantedScopes: ['personal'],
    });

    expect(result).toEqual({ id: 'conn-old' });
    expect(prismaMock.wearableConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-old' },
      data: {
        status: 'CONNECTED',
        connectedAt: expect.any(Date),
        disconnectedAt: null,
        grantedScopes: ['personal'],
      },
    });
    expect(prismaMock.wearableConnection.create).not.toHaveBeenCalled();
  });

  it('looks up the existing row scoped to both userId and provider, never by a caller-supplied id', async () => {
    prismaMock.wearableConnection.findFirst.mockResolvedValue(null);
    prismaMock.wearableConnection.create.mockResolvedValue({ id: 'conn-new' });

    await upsertConnectionAsConnected({ userId: 'u1', provider: 'OURA', grantedScopes: [] });

    expect(prismaMock.wearableConnection.findFirst).toHaveBeenCalledWith({
      where: { userId: 'u1', provider: 'OURA' },
      orderBy: { createdAt: 'desc' },
    });
  });
});

describe('markConnectionDisconnected', () => {
  it('sets status DISCONNECTED and stamps disconnectedAt, keyed by connectionId', async () => {
    prismaMock.wearableConnection.update.mockResolvedValue({});

    await markConnectionDisconnected('conn-1');

    expect(prismaMock.wearableConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: { status: 'DISCONNECTED', disconnectedAt: expect.any(Date) },
    });
  });
});

describe('markConnectionAuthRequired', () => {
  it('sets status AUTH_REQUIRED, keyed by connectionId', async () => {
    prismaMock.wearableConnection.update.mockResolvedValue({});

    await markConnectionAuthRequired('conn-1');

    expect(prismaMock.wearableConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: { status: 'AUTH_REQUIRED' },
    });
  });
});

describe('recordSyncOutcome', () => {
  it('sets lastSyncAt, lastSyncStatus, and lastSuccessfulSyncAt on SUCCESS', async () => {
    prismaMock.wearableConnection.update.mockResolvedValue({});

    await recordSyncOutcome('conn-1', 'SUCCESS');

    expect(prismaMock.wearableConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: { lastSyncAt: expect.any(Date), lastSyncStatus: 'SUCCESS', lastSuccessfulSyncAt: expect.any(Date) },
    });
  });

  it('also advances lastSuccessfulSyncAt on PARTIAL — a partial sync still fetched real data', async () => {
    prismaMock.wearableConnection.update.mockResolvedValue({});

    await recordSyncOutcome('conn-1', 'PARTIAL');

    const call = prismaMock.wearableConnection.update.mock.calls[0]![0];
    expect(call.data).toHaveProperty('lastSuccessfulSyncAt');
    expect(call.data.lastSyncStatus).toBe('PARTIAL');
  });

  it('does NOT advance lastSuccessfulSyncAt on FAILED', async () => {
    prismaMock.wearableConnection.update.mockResolvedValue({});

    await recordSyncOutcome('conn-1', 'FAILED');

    const call = prismaMock.wearableConnection.update.mock.calls[0]![0];
    expect(call.data).not.toHaveProperty('lastSuccessfulSyncAt');
    expect(call.data).toEqual({ lastSyncAt: expect.any(Date), lastSyncStatus: 'FAILED' });
  });
});
