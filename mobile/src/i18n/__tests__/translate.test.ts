import { detectDeviceLanguage, normalizeLanguage } from '@/src/i18n/languages';
import { translate, type Messages } from '@/src/i18n/translate';

const catalogs = {
  en: {
    'hello': 'Hello {name}',
    'only.en': 'Only English',
    'items_one': '{count} item',
    'items_other': '{count} items',
  } as Messages,
  hu: { 'hello': 'Szia {name}', 'items_one': '{count} elem', 'items_other': '{count} elem' } as Messages,
  de: { 'hello': 'Hallo {name}' } as Messages,
};

describe('translate', () => {
  it('fills placeholders', () => {
    expect(translate(catalogs, 'hu', 'hello', { name: 'Kris' })).toBe('Szia Kris');
    expect(translate(catalogs, 'de', 'hello', { name: 'Kris' })).toBe('Hallo Kris');
  });

  it('leaves an unknown placeholder visible rather than blank', () => {
    expect(translate(catalogs, 'en', 'hello')).toBe('Hello {name}');
  });

  it('falls back to English, then to the key itself', () => {
    expect(translate(catalogs, 'hu', 'only.en')).toBe('Only English');
    expect(translate(catalogs, 'de', 'nope')).toBe('nope');
  });

  it('picks the plural variant from count', () => {
    expect(translate(catalogs, 'en', 'items', { count: 1 })).toBe('1 item');
    expect(translate(catalogs, 'en', 'items', { count: 3 })).toBe('3 items');
    expect(translate(catalogs, 'hu', 'items', { count: 2 })).toBe('2 elem');
  });
});

describe('languages', () => {
  it('maps device locales to a supported language', () => {
    expect(normalizeLanguage('hu-HU')).toBe('hu');
    expect(normalizeLanguage('de_AT')).toBe('de');
    expect(normalizeLanguage('EN')).toBe('en');
    expect(normalizeLanguage('fr-FR')).toBe('en');
    expect(normalizeLanguage(undefined)).toBe('en');
  });

  it('always detects a supported language', () => {
    expect(['en', 'hu', 'de']).toContain(detectDeviceLanguage());
  });
});

describe('language store', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function load(stored: string | null) {
    const getItem = jest.fn().mockResolvedValue(stored);
    jest.doMock('@/src/auth/secureStorage', () => ({
      secureStorage: { getItem, setItem: jest.fn().mockResolvedValue(undefined), deleteItem: jest.fn() },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@/src/i18n/store') as typeof import('@/src/i18n/store');
  }

  it('keeps an explicit choice when the stored value is read later', async () => {
    const store = load('hu');
    store.setLanguage('de');
    await store.loadStoredLanguage();
    expect(store.getLanguage()).toBe('de');
  });

  it('restores the stored language when nothing else chose one', async () => {
    const store = load('hu');
    await store.loadStoredLanguage();
    expect(store.getLanguage()).toBe('hu');
  });
});
