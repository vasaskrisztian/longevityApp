import type { Language } from '@/src/i18n/languages';

export type Messages = Record<string, string>;
export type Params = Record<string, string | number>;

/** A translation catalogue with exactly the keys of an English source object. */
export type Catalog<T> = { [K in keyof T]: string };

/** `x_one` / `x_other` plural variants are called as plain `x`. */
export type BaseKey<K> = K extends `${infer B}_${'one' | 'other'}` ? B : K;

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

function pluralCategory(language: Language, count: number): 'one' | 'other' {
  try {
    return new Intl.PluralRules(language).select(count) === 'one' ? 'one' : 'other';
  } catch {
    return count === 1 ? 'one' : 'other';
  }
}

/**
 * Looks a key up in the language's catalogue, falling back to English and
 * finally to the key itself (so a missing text is visible, not blank).
 * `{name}` placeholders are filled from `params`; with a numeric `count`
 * the `key_one` / `key_other` variant is picked first.
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
