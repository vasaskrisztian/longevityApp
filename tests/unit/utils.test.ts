import { describe, it, expect } from 'vitest';
import { cn, parseTagList, formatTagList } from '@/lib/utils';

describe('cn', () => {
  it('joins plain class strings', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, null, 'c')).toBe('a c');
  });

  it('resolves conflicting Tailwind utilities to the last one (tailwind-merge)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('supports the conditional-object form', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active');
  });
});

describe('parseTagList', () => {
  it('splits a comma-separated string into a trimmed array', () => {
    expect(parseTagList('peanuts, shellfish , soy')).toEqual(['peanuts', 'shellfish', 'soy']);
  });

  it('drops empty entries from stray/double commas', () => {
    expect(parseTagList('a,,b, ,c')).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array for an empty or whitespace-only string', () => {
    expect(parseTagList('')).toEqual([]);
    expect(parseTagList('   ')).toEqual([]);
  });

  it('returns a single-element array for a string with no commas', () => {
    expect(parseTagList('lactose')).toEqual(['lactose']);
  });
});

describe('formatTagList', () => {
  it('joins an array into a comma-and-space-separated string', () => {
    expect(formatTagList(['peanuts', 'shellfish'])).toBe('peanuts, shellfish');
  });

  it('returns an empty string for an empty array', () => {
    expect(formatTagList([])).toBe('');
  });

  it('returns an empty string for undefined or null', () => {
    expect(formatTagList(undefined)).toBe('');
    expect(formatTagList(null)).toBe('');
  });

  it('round-trips through parseTagList for a simple list', () => {
    const original = ['a', 'b', 'c'];
    expect(parseTagList(formatTagList(original))).toEqual(original);
  });
});
