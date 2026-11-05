import { z } from 'zod';

/**
 * The languages the product speaks. English is the source language and the
 * fallback; Hungarian and German are full translations. The same three codes
 * are used by the app (mobile/src/i18n) and stored on `User.language`.
 */
export const SUPPORTED_LANGUAGES = ['en', 'hu', 'de'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

export const LanguageSchema = z.enum(SUPPORTED_LANGUAGES);

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** Whatever is stored or sent (`hu-HU`, `DE`, junk, null) → a supported language, English if unknown. */
export function normalizeLanguage(value: unknown): Language {
  if (typeof value !== 'string') return DEFAULT_LANGUAGE;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return isLanguage(base) ? base : DEFAULT_LANGUAGE;
}
