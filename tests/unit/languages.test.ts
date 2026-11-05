import { describe, it, expect } from 'vitest';
import { LanguageSchema, normalizeLanguage } from '@/lib/i18n/languages';

describe('languages', () => {
  it('accepts exactly en, hu and de', () => {
    for (const l of ['en', 'hu', 'de']) expect(LanguageSchema.safeParse(l).success).toBe(true);
    expect(LanguageSchema.safeParse('fr').success).toBe(false);
    expect(LanguageSchema.safeParse('HU').success).toBe(false);
  });

  it('normalises device locales and unknown values', () => {
    expect(normalizeLanguage('hu-HU')).toBe('hu');
    expect(normalizeLanguage('de_AT')).toBe('de');
    expect(normalizeLanguage(' EN-us ')).toBe('en');
    expect(normalizeLanguage('fr-FR')).toBe('en');
    expect(normalizeLanguage(null)).toBe('en');
    expect(normalizeLanguage(undefined)).toBe('en');
  });
});
