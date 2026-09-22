import type { WearableProviderAdapter, WearableProviderId } from './wearable-provider.types';

/**
 * In-memory registry of provider adapters — pure, zero I/O, zero framework
 * imports. Phase 4 will call `registerProvider(new OuraProvider(...))` once
 * at startup (from a composition-root module, never from here); nothing
 * registers anything yet, so `getProvider()` returns undefined for every
 * provider today. That's the correct state for Phase 3: the seam exists,
 * nothing is plugged into it.
 *
 * A module-level Map (rather than a class) matches the rest of lib/'s
 * singleton pattern (see lib/db/prisma.ts, lib/encryption/encryption.service.ts).
 */
const registry = new Map<WearableProviderId, WearableProviderAdapter>();

export function registerProvider(adapter: WearableProviderAdapter): void {
  registry.set(adapter.id, adapter);
}

export function getProvider(id: WearableProviderId): WearableProviderAdapter | undefined {
  return registry.get(id);
}

export function getRegisteredProviderIds(): WearableProviderId[] {
  return Array.from(registry.keys());
}

/** Test-only escape hatch — production code never needs to unregister a provider. */
export function _resetRegistryForTests(): void {
  registry.clear();
}
