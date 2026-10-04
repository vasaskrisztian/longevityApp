import { API_BASE_URL } from '@/src/config/env';
import type { CreatorDirectoryItem } from '@/src/api/creators';

/**
 * Signed-out ("teaser") creator endpoints. Plain `fetch` — no Bearer token
 * to attach and no refresh to attempt while signed out (same reasoning as
 * src/api/auth.ts). The directory list route is public by design and only
 * ever carries counts; the per-creator teaser route is a separate, stripped
 * DTO (no protocol/challenge content, no health metrics) — the full
 * /api/creators/:id profile is deliberately NOT used here.
 */

export interface CreatorTeaser extends CreatorDirectoryItem {
  /** Days of health data tracked — a count only, never the values. */
  trackedDays: number;
}

export class RateLimitedError extends Error {}

export async function getPublicCreatorDirectory(): Promise<CreatorDirectoryItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/creators`);
  if (!response.ok) throw new Error(`Failed to load creators (${response.status}).`);
  return response.json();
}

/** Returns null on 404 (missing / not a creator / not consenting — the
 * server collapses those on purpose). */
export async function getCreatorTeaser(id: string): Promise<CreatorTeaser | null> {
  const response = await fetch(`${API_BASE_URL}/api/creators/${encodeURIComponent(id)}/teaser`);
  if (response.status === 404) return null;
  if (response.status === 429) throw new RateLimitedError('Too many requests.');
  if (!response.ok) throw new Error(`Failed to load creator (${response.status}).`);
  return response.json();
}
