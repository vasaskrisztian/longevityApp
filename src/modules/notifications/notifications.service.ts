import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export type NotificationKind = 'GROUP_INVITATION' | 'GROUP_CHALLENGE_NEW' | 'GROUP_CHALLENGE_SUMMARY' | 'GROUP_CHALLENGE_GOAL_REACHED';

export interface NotificationInput {
  type: NotificationKind;
  title: string;
  body: string;
  /** Ids the client needs to act on it (invitationId, groupId, challengeId). */
  data?: Record<string, string>;
}

export interface NotificationDTO {
  id: string;
  type: NotificationKind;
  title: string;
  body: string;
  data: Record<string, string> | null;
  readAt: string | null;
  createdAt: string;
}

export async function createNotification(userId: string, input: NotificationInput): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

/** One notification per user id (same content) — e.g. "new challenge" to every member. */
export async function createNotificationsForUsers(userIds: string[], input: NotificationInput): Promise<void> {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
    })),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDTO(row: any): NotificationDTO {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: (row.data as Record<string, string> | null) ?? null,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function listNotifications(
  userId: string,
  limit = 30,
): Promise<{ items: NotificationDTO[]; unreadCount: number }> {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(limit, 1), 100) }),
    countUnreadNotifications(userId),
  ]);
  return { items: rows.map(toDTO), unreadCount };
}

/** Marks the given notifications (always only the caller's own) — or all of them — read. */
export async function markNotificationsRead(userId: string, ids: string[] | 'all'): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId, readAt: null, ...(ids === 'all' ? {} : { id: { in: ids } }) },
    data: { readAt: new Date() },
  });
  return count;
}
