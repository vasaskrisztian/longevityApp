import type { Language } from '@/lib/i18n/languages';

export type Messages = Record<string, string>;
export type Params = Record<string, string | number>;

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

function pluralCategory(language: Language, count: number): 'one' | 'other' {
  return new Intl.PluralRules(language).select(count) === 'one' ? 'one' : 'other';
}

/**
 * Server-side twin of mobile/src/i18n/translate.ts: look the key up in the
 * language's catalogue (English, then the key itself as fallback), fill
 * `{name}` placeholders, pick `key_one` / `key_other` from a numeric `count`.
 */
export function translate(
  catalogs: Record<Language, Messages>,
  language: Language,
  key: string,
  params?: Params,
): string {
  const lookup = (lang: Language): string | undefined => {
    const messages = catalogs[lang];
    if (typeof params?.count === 'number') {
      const plural = messages[`${key}_${pluralCategory(lang, params.count)}`];
      if (plural !== undefined) return plural;
    }
    return messages[key];
  };
  const found = lookup(language) ?? lookup('en');
  return found === undefined ? key : interpolate(found, params);
}
