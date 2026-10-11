import { useSyncExternalStore } from 'react';

/**
 * Number of group invitations waiting for the signed-in person — drives the
 * badge on the Community tab / sidebar item. Outside React (same pattern as
 * notifications/unreadStore) so the poller, the Groups screen and both
 * navigation shells share one value.
 */
let pending = 0;
const listeners = new Set<() => void>();

export function setPendingInvitations(next: number): void {
  const value = Math.max(0, Math.floor(next));
  if (value === pending) return;
  pending = value;
  listeners.forEach((listener) => listener());
}

export const getPendingInvitations = () => pending;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePendingInvitations(): number {
  return useSyncExternalStore(subscribe, getPendingInvitations, getPendingInvitations);
}

export function _resetPendingInvitationsForTests(): void {
  pending = 0;
  listeners.clear();
}
