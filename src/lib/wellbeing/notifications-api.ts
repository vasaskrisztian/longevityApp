import { apiFetchJson } from './http';

export type NotificationKind = 'GROUP_INVITATION' | 'GROUP_CHALLENGE_NEW' | 'GROUP_CHALLENGE_SUMMARY';

export interface AppNotification {
  id: string;
  type: NotificationKind;
  title: string;
  body: string;
  /** Ids the screen needs to act on it (invitationId, groupId, challengeId). */
  data: Record<string, string> | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationList {
  items: AppNotification[];
  unreadCount: number;
}

/** GET /api/notifications — also sends any overdue end-of-challenge summaries server-side. */
export const listNotifications = (limit = 50) => apiFetchJson<NotificationList>(`/api/notifications?limit=${limit}`);

/** POST /api/notifications/read — the given ids, or `'all'`. */
export const markNotificationsRead = (ids: string[] | 'all') =>
  apiFetchJson<{ updated: number }>('/api/notifications/read', { method: 'POST', body: JSON.stringify({ ids }) });
