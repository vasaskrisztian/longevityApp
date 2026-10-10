import { useSyncExternalStore } from 'react';

/**
 * Tiny shared store for the login-time device sync (health/useDeviceAutoSync):
 * `dataVersion` goes up whenever fresh device data has landed on the server,
 * so screens that show it (Dashboard, Trends) reload; `syncing` drives the
 * "Syncing your devices…" hint. Outside React on purpose, like auth/sessionStore.
 */
let state = { dataVersion: 0, syncing: false };
const listeners = new Set<() => void>();

function emit(next: Partial<typeof state>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function subscribeDeviceSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getDeviceDataVersion = () => state.dataVersion;
export const getDeviceSyncing = () => state.syncing;
export const bumpDeviceDataVersion = () => emit({ dataVersion: state.dataVersion + 1 });
export const setDeviceSyncing = (syncing: boolean) => emit({ syncing });

/** Re-renders when device data changed; screens put it in their load effect's deps. */
export function useDeviceDataVersion(): number {
  return useSyncExternalStore(subscribeDeviceSync, getDeviceDataVersion, getDeviceDataVersion);
}

export function useDeviceSyncing(): boolean {
  return useSyncExternalStore(subscribeDeviceSync, getDeviceSyncing, getDeviceSyncing);
}

export function _resetDeviceSyncStoreForTests() {
  state = { dataVersion: 0, syncing: false };
  listeners.clear();
}
