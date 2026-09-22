import { prisma } from '@/lib/db/prisma';
import { getConnectionForUserAndProvider } from '@/modules/wearable/services/wearable.service';
import { getTodaySnapshot, type DailyMetricSnapshot } from '@/modules/dashboard/dashboard.service';
import { recordAuditLog } from '@/lib/audit/audit-log.service';
import type { ConnectionSummary } from '@/modules/wearable/domain/wearable-provider.types';
import type { AdminUserListQuery } from '@/lib/validation/admin.schemas';

/**
 * ARCHITECTURE.md §8: admin-only reads/writes. Every function here assumes
 * its caller already passed `requireAdmin()` — this module has no
 * authorization logic of its own, exactly like every other module/*
 * service (the Route Handler is always the choke point, per §4.2). Nothing
 * here ever selects `EncryptedCredential` (§8.3) — the connection summary
 * comes from `wearable.service.ts`'s `getConnectionForUserAndProvider`,
 * which never touches that table either.
 */

const CONNECTED_OURA_STATUSES = ['CONNECTED', 'AUTH_REQUIRED', 'ERROR'] as const;

export interface AdminUserListItem {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
  ouraStatus: string;
  lastSyncAt: Date | null;
  createdAt: Date;
}

export interface AdminUserListResult {
  users: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * §8.2: "List all users, search, filter by Oura status" — read-only, not
 * individually audited per that same table. `q` matches email OR full
 * name, case-insensitive. `ouraStatus: 'DISCONNECTED'` matches both "never
 * attempted" (no WearableConnection row at all) and an explicit
 * DISCONNECTED row, mirroring how `wearable.service.ts` synthesizes a
 * DISCONNECTED summary for a user with no row.
 */
export async function listUsersForAdmin(query: AdminUserListQuery): Promise<AdminUserListResult> {
  const { q, ouraStatus, page, pageSize } = query;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { profile: { fullName: { contains: q, mode: 'insensitive' } } },
    ];
  }
  if (ouraStatus === 'DISCONNECTED') {
    where.wearableConnections = {
      none: { provider: 'OURA', status: { in: CONNECTED_OURA_STATUSES } },
    };
  } else if (ouraStatus !== 'ALL') {
    where.wearableConnections = { some: { provider: 'OURA', status: ouraStatus } };
  }

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        profile: { select: { fullName: true } },
        wearableConnections: { where: { provider: 'OURA' }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users: AdminUserListItem[] = rows.map((row: any) => {
    const connection = row.wearableConnections[0];
    return {
      id: row.id,
      email: row.email,
      fullName: row.profile?.fullName ?? null,
      role: row.role,
      status: row.status,
      ouraStatus: connection?.status ?? 'DISCONNECTED',
      lastSyncAt: connection?.lastSyncAt ?? null,
      createdAt: row.createdAt,
    };
  });

  return { users, total, page, pageSize };
}

export interface AdminUserDetail {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
    status: string;
    emailVerifiedAt: Date | null;
    lastLoginAt: Date | null;
    createdAt: Date;
  };
  connection: ConnectionSummary;
  todaySnapshot: DailyMetricSnapshot | null;
  recentSyncJobs: {
    id: string;
    type: string;
    status: string;
    startedAt: Date | null;
    finishedAt: Date | null;
    recordsFetched: number;
    recordsCreated: number;
    recordsUpdated: number;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: Date;
  }[];
}

/**
 * §8.2: "Open a user's full dashboard." Returns `null` when the target user
 * doesn't exist so the route can 404 — never throws, so a bad id never
 * looks any different from an authorization failure to a caller probing
 * ids (both routes this feeds return a plain 404, not a leaked "exists but
 * ...").
 */
export async function getUserDetailForAdmin(targetUserId: string): Promise<AdminUserDetail | null> {
  const userRow = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { profile: { select: { fullName: true } } },
  });
  if (!userRow) {
    return null;
  }

  const [connection, todaySnapshot, recentSyncJobs] = await Promise.all([
    getConnectionForUserAndProvider(targetUserId, 'OURA'),
    getTodaySnapshot(targetUserId),
    prisma.syncJob.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  return {
    user: {
      id: userRow.id,
      email: userRow.email,
      fullName: userRow.profile?.fullName ?? null,
      role: userRow.role,
      status: userRow.status,
      emailVerifiedAt: userRow.emailVerifiedAt,
      lastLoginAt: userRow.lastLoginAt,
      createdAt: userRow.createdAt,
    },
    connection,
    todaySnapshot,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recentSyncJobs: recentSyncJobs.map((job: any) => ({
      id: job.id,
      type: job.type,
      status: job.status,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      recordsFetched: job.recordsFetched,
      recordsCreated: job.recordsCreated,
      recordsUpdated: job.recordsUpdated,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
    })),
  };
}

/** Existence check only — used by the admin sync route's 404 (a target id that doesn't exist at all, vs. one that exists but has no connection). */
export async function userExistsForAdmin(targetUserId: string): Promise<boolean> {
  const row = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
  return Boolean(row);
}

/**
 * §8.2's `ADMIN_VIEW_USER` audit row — written on every admin read of
 * another user's dashboard, page or API alike. Phase 9: routed through the
 * central `recordAuditLog` (§10 threat #15's metadata denylist) instead of
 * a direct `prisma.auditLog.create` call.
 */
export async function recordAdminViewUser(actorUserId: string, targetUserId: string): Promise<void> {
  await recordAuditLog({
    actorUserId,
    targetUserId,
    action: 'ADMIN_VIEW_USER',
    entityType: 'User',
    entityId: targetUserId,
  });
}

/** §8.2's `ADMIN_TRIGGER_SYNC` audit row. */
export async function recordAdminTriggerSync(
  actorUserId: string,
  targetUserId: string,
  syncJobId: string,
): Promise<void> {
  await recordAuditLog({
    actorUserId,
    targetUserId,
    action: 'ADMIN_TRIGGER_SYNC',
    entityType: 'SyncJob',
    entityId: syncJobId,
  });
}
