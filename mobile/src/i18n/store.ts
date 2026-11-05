import { secureStorage } from '@/src/auth/secureStorage';
import { DEFAULT_LANGUAGE, detectDeviceLanguage, isLanguage, type Language } from '@/src/i18n/languages';

/**
 * The language the app currently speaks — plain (non-React) store like
 * src/auth/sessionStore.ts, so API helpers and text helpers can read it
 * outside components while `useT` subscribes for re-rendering.
 *
 * Order of precedence: the person's account language once signed in (applied
 * by the session store), else what was last chosen on this device, else the
 * device's own language, else English.
 */

const STORAGE_KEY = 'longevity.language';

let current: Language = detectDeviceLanguage();
// True once something chose a language explicitly (picker, account) — a slower read of the
// stored value must not overwrite that.
let chosen = false;
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  return current;
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Switches the app language now; remembered on this device unless `persist` is false. */
export function setLanguage(next: Language, options: { persist?: boolean } = {}): void {
  if (options.persist !== false) chosen = true;
  if (next !== current) {
    current = next;
    listeners.forEach((listener) => listener());
  }
  if (options.persist !== false) {
    secureStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }
}

/** Restores the language chosen on this device earlier (called once at app start). */
export async function loadStoredLanguage(): Promise<void> {
  try {
    const stored = await secureStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored) && !chosen) setLanguage(stored, { persist: false });
  } catch {
    // keep the detected default
  }
}

/** Test-only reset. */
export function _resetLanguageForTests(language: Language = DEFAULT_LANGUAGE): void {
  current = language;
  chosen = false;
  listeners.clear();
}
