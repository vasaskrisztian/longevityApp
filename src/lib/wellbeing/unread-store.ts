import { useSyncExternalStore } from 'react';

/**
 * Shared unread-notification count for the sidebar badge and the inbox
 * (outside React, like the mobile app's store, so the poller, the page and
 * the navigation all see one value).
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
  return useSyncExternalStore(subscribe, getUnreadCount, () => 0);
}

export function _resetUnreadStoreForTests(): void {
  unread = 0;
  listeners.clear();
}
