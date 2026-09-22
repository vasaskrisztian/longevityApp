import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Client-side helpers for the free-text "tag list" inputs used by the
 * onboarding wizard and profile edit forms (custom activities, allergies,
 * intolerances, avoided foods): the UI collects these as a single
 * comma-separated text field for a simpler form, but the underlying schema
 * (and the database column) is always a string array.
 */
export function parseTagList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function formatTagList(values: string[] | undefined | null): string {
  return (values ?? []).join(', ');
}
