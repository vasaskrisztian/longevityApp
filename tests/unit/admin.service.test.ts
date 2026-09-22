import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  user: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  },
  syncJob: {
    findMany: vi.fn(),
  },
};
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

const getConnectionForUserAndProviderMock = vi.fn();
vi.mock('@/modules/wearable/services/wearable.service', () => ({
  getConnectionForUserAndProvider: getConnectionForUserAndProviderMock,
}));

const getTodaySnapshotMock = vi.fn();
vi.mock('@/modules/dashboard/dashboard.service', () => ({
  getTodaySnapshot: getTodaySnapshotMock,
}));

const recordAuditLogMock = vi.fn();
vi.mock('@/lib/audit/audit-log.service', () => ({
  recordAuditLog: recordAuditLogMock,
}));

const {
  listUsersForAdmin,
  getUserDetailForAdmin,
  userExistsForAdmin,
  recordAdminViewUser,
  recordAdminTriggerSync,
} = await import('@/modules/admin/admin.service');

const BASE_QUERY = { q: undefined, ouraStatus: 'ALL' as const, page: 1, pageSize: 20 };

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'user@example.com',
    role: 'USER',
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    profile: { fullName: 'Jane Doe' },
    wearableConnections: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listUsersForAdmin', () => {
  it('applies no where-clause filters for ALL with no search term', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);

    await listUsersForAdmin(BASE_QUERY);

    const findManyArgs = prismaMock.user.findMany.mock.calls[0]![0];
    expect(findManyArgs.where).toEqual({});
    expect(prismaMock.user.count).toHaveBeenCalledWith({ where: {} });
  });

  it('searches by email or profile fullName, case-insensitive, when q is set', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);

    await listUsersForAdmin({ ...BASE_QUERY, q: 'jane' });

    const where = prismaMock.user.findMany.mock.calls[0]![0].where;
    expect(where.OR).toEqual([
      { email: { contains: 'jane', mode: 'insensitive' } },
      { profile: { fullName: { contains: 'jane', mode: 'insensitive' } } },
    ]);
  });

  it('filters to users with a CONNECTED Oura row for ouraStatus=CONNECTED', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);

    await listUsersForAdmin({ ...BASE_QUERY, ouraStatus: 'CONNECTED' });

    const where = prismaMock.user.findMany.mock.calls[0]![0].where;
    expect(where.wearableConnections).toEqual({ some: { provider: 'OURA', status: 'CONNECTED' } });
  });

  it('filters DISCONNECTED to users with no CONNECTED/AUTH_REQUIRED/ERROR row — covers both "never connected" and an explicit DISCONNECTED row', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);

    await listUsersForAdmin({ ...BASE_QUERY, ouraStatus: 'DISCONNECTED' });

    const where = prismaMock.user.findMany.mock.calls[0]![0].where;
    expect(where.wearableConnections).toEqual({
      none: { provider: 'OURA', status: { in: ['CONNECTED', 'AUTH_REQUIRED', 'ERROR'] } },
    });
  });

  it('paginates with skip/take derived from page and pageSize', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);

    await listUsersForAdmin({ ...BASE_QUERY, page: 3, pageSize: 10 });

    const findManyArgs = prismaMock.user.findMany.mock.calls[0]![0];
    expect(findManyArgs.skip).toBe(20);
    expect(findManyArgs.take).toBe(10);
  });

  it('maps a user with a current Oura connection to its status and lastSyncAt', async () => {
    const lastSyncAt = new Date('2026-06-01T00:00:00Z');
    prismaMock.user.findMany.mockResolvedValue([
      userRow({ wearableConnections: [{ status: 'CONNECTED', lastSyncAt }] }),
    ]);
    prismaMock.user.count.mockResolvedValue(1);

    const result = await listUsersForAdmin(BASE_QUERY);

    expect(result.users[0]).toEqual({
      id: 'u1',
      email: 'user@example.com',
      fullName: 'Jane Doe',
      role: 'USER',
      status: 'ACTIVE',
      ouraStatus: 'CONNECTED',
      lastSyncAt,
      createdAt: userRow().createdAt,
    });
  });

  it('defaults ouraStatus to DISCONNECTED and lastSyncAt to null for a user with no connection row', async () => {
    prismaMock.user.findMany.mockResolvedValue([userRow()]);
    prismaMock.user.count.mockResolvedValue(1);

    const result = await listUsersForAdmin(BASE_QUERY);

    expect(result.users[0]?.ouraStatus).toBe('DISCONNECTED');
    expect(result.users[0]?.lastSyncAt).toBeNull();
  });

  it('defaults fullName to null when the user has no profile yet', async () => {
    prismaMock.user.findMany.mockResolvedValue([userRow({ profile: null })]);
    prismaMock.user.count.mockResolvedValue(1);

    const result = await listUsersForAdmin(BASE_QUERY);

    expect(result.users[0]?.fullName).toBeNull();
  });

  it('returns total/page/pageSize alongside the mapped users', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(42);

    const result = await listUsersForAdmin({ ...BASE_QUERY, page: 2, pageSize: 15 });

    expect(result).toEqual({ users: [], total: 42, page: 2, pageSize: 15 });
  });
});

describe('getUserDetailForAdmin', () => {
  it('returns null when the target user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await getUserDetailForAdmin('missing');

    expect(result).toBeNull();
    expect(getConnectionForUserAndProviderMock).not.toHaveBeenCalled();
  });

  it('assembles the user, connection, today snapshot, and recent sync jobs for an existing user', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      role: 'USER',
      status: 'ACTIVE',
      emailVerifiedAt: new Date('2026-01-02T00:00:00Z'),
      lastLoginAt: new Date('2026-06-10T00:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      profile: { fullName: 'Jane Doe' },
    });
    getConnectionForUserAndProviderMock.mockResolvedValue({ id: 'conn-1', status: 'CONNECTED' });
    getTodaySnapshotMock.mockResolvedValue({ date: new Date('2026-06-15'), isToday: true });
    prismaMock.syncJob.findMany.mockResolvedValue([
      {
        id: 'job-1',
        type: 'DAILY',
        status: 'SUCCESS',
        startedAt: new Date('2026-06-15T03:00:00Z'),
        finishedAt: new Date('2026-06-15T03:01:00Z'),
        recordsFetched: 5,
        recordsCreated: 2,
        recordsUpdated: 3,
        errorCode: null,
        errorMessage: null,
        createdAt: new Date('2026-06-15T03:00:00Z'),
      },
    ]);

    const result = await getUserDetailForAdmin('u1');

    expect(getConnectionForUserAndProviderMock).toHaveBeenCalledWith('u1', 'OURA');
    expect(getTodaySnapshotMock).toHaveBeenCalledWith('u1');
    expect(prismaMock.syncJob.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    expect(result?.user).toEqual({
      id: 'u1',
      email: 'user@example.com',
      fullName: 'Jane Doe',
      role: 'USER',
      status: 'ACTIVE',
      emailVerifiedAt: new Date('2026-01-02T00:00:00Z'),
      lastLoginAt: new Date('2026-06-10T00:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(result?.connection).toEqual({ id: 'conn-1', status: 'CONNECTED' });
    expect(result?.todaySnapshot).toEqual({ date: new Date('2026-06-15'), isToday: true });
    expect(result?.recentSyncJobs).toHaveLength(1);
    expect(result?.recentSyncJobs[0]).toMatchObject({ id: 'job-1', status: 'SUCCESS' });
  });

  it('defaults fullName to null when the target user has no profile', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      role: 'USER',
      status: 'ACTIVE',
      emailVerifiedAt: null,
      lastLoginAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      profile: null,
    });
    getConnectionForUserAndProviderMock.mockResolvedValue({ id: null, status: 'DISCONNECTED' });
    getTodaySnapshotMock.mockResolvedValue(null);
    prismaMock.syncJob.findMany.mockResolvedValue([]);

    const result = await getUserDetailForAdmin('u1');

    expect(result?.user.fullName).toBeNull();
    expect(result?.todaySnapshot).toBeNull();
    expect(result?.recentSyncJobs).toEqual([]);
  });
});

describe('userExistsForAdmin', () => {
  it('returns true when the user row exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });

    await expect(userExistsForAdmin('u1')).resolves.toBe(true);
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { id: true },
    });
  });

  it('returns false when no user row exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(userExistsForAdmin('missing')).resolves.toBe(false);
  });
});

describe('recordAdminViewUser', () => {
  it('writes an ADMIN_VIEW_USER audit row scoped to the actor and target, via the central audit-log service', async () => {
    recordAuditLogMock.mockResolvedValue(undefined);

    await recordAdminViewUser('admin-1', 'u1');

    expect(recordAuditLogMock).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      targetUserId: 'u1',
      action: 'ADMIN_VIEW_USER',
      entityType: 'User',
      entityId: 'u1',
    });
  });
});

describe('recordAdminTriggerSync', () => {
  it('writes an ADMIN_TRIGGER_SYNC audit row referencing the SyncJob, via the central audit-log service', async () => {
    recordAuditLogMock.mockResolvedValue(undefined);

    await recordAdminTriggerSync('admin-1', 'u1', 'job-1');

    expect(recordAuditLogMock).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      targetUserId: 'u1',
      action: 'ADMIN_TRIGGER_SYNC',
      entityType: 'SyncJob',
      entityId: 'job-1',
    });
  });
});
