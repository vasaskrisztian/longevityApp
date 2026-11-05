import { useSyncExternalStore } from 'react';

import { INTL_LOCALES, type Language } from '@/src/i18n/languages';
import { catalogs, type MessageKey } from '@/src/i18n/locales';
import { getLanguage, subscribeLanguage } from '@/src/i18n/store';
import { translate, type BaseKey, type Params } from '@/src/i18n/translate';

export * from '@/src/i18n/languages';
export { getLanguage, setLanguage, loadStoredLanguage } from '@/src/i18n/store';
export type { MessageKey } from '@/src/i18n/locales';

export type TextKey = BaseKey<MessageKey>;
export type TFunction = (key: TextKey, params?: Params) => string;

/**
 * Translates `key` into the current language. Safe to call anywhere at render
 * time (also in helper modules) — but never at module scope, where it would
 * freeze the language at import time. Components must also call `useT()` so
 * they re-render when the language changes.
 */
export const t: TFunction = (key, params) => translate(catalogs, getLanguage(), key, params);

/** For keys that are only known at run time (validation codes, API enums). Missing key → the key itself. */
export function tDynamic(key: string, params?: Params): string {
  return translate(catalogs, getLanguage(), key, params);
}

/** Subscribes the component to language changes. */
export function useT(): { t: TFunction; language: Language; locale: string } {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
  return { t, language, locale: INTL_LOCALES[language] };
}

/** BCP-47 tag of the current language, for `toLocaleDateString(locale(), …)`. */
export function locale(): string {
  return INTL_LOCALES[getLanguage()];
}
