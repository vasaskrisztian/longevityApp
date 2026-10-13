import { FIELD_DEFS } from '@/src/api/inbody';
import { GLOSSARY, isGlossaryKey } from '@/src/content/glossary';

describe('glossary', () => {
  it('explains every InBody field the screen shows', () => {
    for (const field of FIELD_DEFS) {
      expect(isGlossaryKey(field.key)).toBe(true);
    }
  });

  it('has a title and a readable-length text for every entry', () => {
    for (const [key, entry] of Object.entries(GLOSSARY)) {
      expect(entry.title.length).toBeGreaterThan(2);
      expect(entry.text.length).toBeGreaterThan(40);
      expect(entry.text.length).toBeLessThan(420);
      expect(key).not.toBe('');
    }
  });

  it('rejects unknown keys', () => {
    expect(isGlossaryKey('nope')).toBe(false);
    expect(isGlossaryKey('toString')).toBe(false);
  });
});
