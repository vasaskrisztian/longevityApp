import { useSyncExternalStore } from 'react';

/**
 * Shared unread-notification count for the tab badge and the desktop
 * sidebar. Outside React (like health/deviceSyncStore) so the poller, the
 * Notifications screen and both navigation shells all see one value.
 */
let unread = 0;
const listeners = new Set<() => void>();

export function setUnreadCount(next: number): void {
  const value = Math.max(0, Math.floor(next));
  if (value === unread) return;
  unread = value;
  listeners.forEach((listener) => listener());
}

export const getUnreadCount = () => unread;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useUnreadCount(): number {
  return useSyncExternalStore(subscribe, getUnreadCount, getUnreadCount);
}

export function _resetUnreadStoreForTests(): void {
  unread = 0;
  listeners.clear();
}
