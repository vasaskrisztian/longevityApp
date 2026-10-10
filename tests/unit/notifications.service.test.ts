import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  notification: { create: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
};
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

const {
  createNotification,
  createNotificationsForUsers,
  listNotifications,
  markNotificationsRead,
  countUnreadNotifications,
} = await import('@/modules/notifications/notifications.service');

beforeEach(() => vi.clearAllMocks());

describe('notifications.service', () => {
  it('creates one notification with its action data', async () => {
    await createNotification('u1', { type: 'GROUP_INVITATION', title: 'T', body: 'B', data: { invitationId: 'i1' } });
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: { userId: 'u1', type: 'GROUP_INVITATION', title: 'T', body: 'B', data: { invitationId: 'i1' } },
    });
  });

  it('fans one message out to many users in a single insert, and does nothing for an empty list', async () => {
    await createNotificationsForUsers(['u1', 'u2'], { type: 'GROUP_CHALLENGE_NEW', title: 'T', body: 'B' });
    expect(prismaMock.notification.createMany.mock.calls[0]![0].data).toHaveLength(2);
    prismaMock.notification.createMany.mockClear();
    await createNotificationsForUsers([], { type: 'GROUP_CHALLENGE_NEW', title: 'T', body: 'B' });
    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
  });

  it('lists only the caller’s notifications, newest first, with the unread count and ISO dates', async () => {
    const created = new Date('2026-10-10T10:00:00Z');
    prismaMock.notification.findMany.mockResolvedValue([
      { id: 'n1', type: 'GROUP_INVITATION', title: 'T', body: 'B', data: { x: '1' }, readAt: null, createdAt: created },
      { id: 'n2', type: 'GROUP_CHALLENGE_NEW', title: 'T', body: 'B', data: null, readAt: created, createdAt: created },
    ]);
    prismaMock.notification.count.mockResolvedValue(1);

    const result = await listNotifications('u1', 500);

    const args = prismaMock.notification.findMany.mock.calls[0]![0];
    expect(args.where).toEqual({ userId: 'u1' });
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    expect(args.take).toBe(100); // capped
    expect(prismaMock.notification.count).toHaveBeenCalledWith({ where: { userId: 'u1', readAt: null } });
    expect(result.unreadCount).toBe(1);
    expect(result.items[0]).toMatchObject({ id: 'n1', readAt: null, createdAt: created.toISOString(), data: { x: '1' } });
    expect(result.items[1]!.readAt).toBe(created.toISOString());
  });

  it('marks only the caller’s own unread notifications read (ids or all)', async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 2 });
    expect(await markNotificationsRead('u1', ['a', 'b'])).toBe(2);
    expect(prismaMock.notification.updateMany.mock.calls[0]![0].where).toEqual({ userId: 'u1', readAt: null, id: { in: ['a', 'b'] } });
    await markNotificationsRead('u1', 'all');
    expect(prismaMock.notification.updateMany.mock.calls[1]![0].where).toEqual({ userId: 'u1', readAt: null });
    expect(prismaMock.notification.updateMany.mock.calls[1]![0].data.readAt).toBeInstanceOf(Date);
  });

  it('counts unread', async () => {
    prismaMock.notification.count.mockResolvedValue(4);
    expect(await countUnreadNotifications('u1')).toBe(4);
  });
});
