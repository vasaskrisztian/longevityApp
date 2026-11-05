import { LANGUAGES } from '@/src/i18n/languages';
import { catalogs, namespaces } from '@/src/i18n/locales';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('translation catalogues', () => {
  const enKeys = Object.keys(catalogs.en);

  it.each(LANGUAGES.filter((l) => l !== 'en'))('%s has exactly the keys of the English source', (language) => {
    const keys = Object.keys(catalogs[language]);
    expect(enKeys.filter((k) => !keys.includes(k))).toEqual([]);
    expect(keys.filter((k) => !enKeys.includes(k))).toEqual([]);
  });

  it.each(LANGUAGES)('%s has no empty text', (language) => {
    const empty = Object.entries(catalogs[language]).filter(([, text]) => text.trim() === '');
    expect(empty).toEqual([]);
  });

  it.each(LANGUAGES.filter((l) => l !== 'en'))('%s keeps the {placeholders} of the English text', (language) => {
    const mismatched = enKeys.filter((k) => placeholders(catalogs.en[k]!) !== placeholders(catalogs[language][k] ?? ''));
    expect(mismatched).toEqual([]);
  });

  it.each(LANGUAGES)('%s defines no key in two namespaces', (language) => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const [ns, messages] of Object.entries(namespaces[language])) {
      for (const key of Object.keys(messages)) {
        if (seen.has(key)) duplicates.push(`${key} (${seen.get(key)} / ${ns})`);
        seen.set(key, ns);
      }
    }
    expect(duplicates).toEqual([]);
  });

  it('has a plural pair (_one and _other) wherever one is used', () => {
    const lone = enKeys.filter((k) => /_(one|other)$/.test(k)).filter((k) => {
      const base = k.replace(/_(one|other)$/, '');
      return !(`${base}_one` in catalogs.en && `${base}_other` in catalogs.en);
    });
    expect(lone).toEqual([]);
  });
});
