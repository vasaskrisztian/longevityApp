/**
 * The languages of the app. English is the source language and the fallback;
 * Hungarian and German are complete translations. The same three codes are
 * stored on the person's account (backend: src/lib/i18n/languages.ts).
 */
export const LANGUAGES = ['en', 'hu', 'de'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

/** Each language is named in itself, so a person can always find their own. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  hu: 'Magyar',
  de: 'Deutsch',
};

/** BCP-47 tag used for dates and numbers (`toLocaleDateString` …). */
export const INTL_LOCALES: Record<Language, string> = {
  en: 'en-GB',
  hu: 'hu-HU',
  de: 'de-DE',
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** `hu-HU`, `de_AT`, `EN`, junk, null → a supported language (English when unknown). */
export function normalizeLanguage(value: unknown): Language {
  if (typeof value !== 'string') return DEFAULT_LANGUAGE;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return isLanguage(base) ? base : DEFAULT_LANGUAGE;
}

/** The device / browser language, mapped to a supported one. No native module needed. */
export function detectDeviceLanguage(): Language {
  try {
    const fromIntl = Intl.DateTimeFormat().resolvedOptions().locale;
    if (fromIntl) return normalizeLanguage(fromIntl);
  } catch {
    // fall through
  }
  const nav = (globalThis as { navigator?: { language?: string } }).navigator;
  return normalizeLanguage(nav?.language);
}
