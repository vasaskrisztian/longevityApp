import { apiFetch, apiFetchJson } from '@/src/api/client';
import type { CreateChallengeInput } from '@/src/validation/schemas';

export type ChallengeStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'FAILED';

export interface ChallengeProgress {
  status: ChallengeStatus;
  currentCount: number;
  requiredCount: number;
  daysRemaining: number | null;
}

export interface Challenge {
  id: string;
  type: 'SLEEP_SCORE' | 'DAILY_STEPS' | 'WEEKLY_WORKOUTS';
  name: string | null;
  requiredCount: number;
  threshold: number;
  windowDays: number;
  activatedAt: string | null;
  expiresAt: string | null;
  visibility: 'PRIVATE' | 'PUBLIC';
  progress: ChallengeProgress;
}

// No Decimal fields here (requiredCount/threshold/windowDays are plain Int
// columns) — unlike goals/supplements/protocols, the raw JSON shape already
// matches Challenge one-to-one, so no raw->DTO numeric conversion is needed.
function toChallenge(raw: Challenge): Challenge {
  return { ...raw, name: raw.name ?? null };
}

export async function listChallenges(): Promise<Challenge[]> {
  const raw = await apiFetchJson<Challenge[]>('/api/challenges');
  return raw.map(toChallenge);
}

export async function createChallenge(input: CreateChallengeInput): Promise<Challenge> {
  const response = await apiFetch('/api/challenges', { method: 'POST', body: JSON.stringify(input) });
  if (!response.ok) throw new Error(`Failed to create challenge (${response.status}).`);
  return toChallenge(await response.json());
}

/** PATCH /api/challenges/:id with a full-terms edit — only valid while the
 * challenge is still a DRAFT; the server returns 409 once activatedAt is
 * set (see the root app's challenge [id] route doc comment). */
export async function updateChallengeTerms(id: string, input: Partial<CreateChallengeInput>): Promise<Challenge> {
  const response = await apiFetch(`/api/challenges/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  if (!response.ok) throw new Error(`Failed to update challenge (${response.status}).`);
  return toChallenge(await response.json());
}

/** PATCH /api/challenges/:id with `{ activate: true }` — starts the clock.
 * A distinct call from updateChallengeTerms, never merged into one generic
 * "update" function: the server dispatches on these exact body shapes
 * ({activate}, {visibility} alone, or a terms object), so collapsing them
 * client-side would risk sending a shape the route doesn't recognize. */
export async function activateChallenge(id: string): Promise<Challenge> {
  const response = await apiFetch(`/api/challenges/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ activate: true }),
  });
  if (!response.ok) throw new Error(`Failed to activate challenge (${response.status}).`);
  return toChallenge(await response.json());
}

/** PATCH /api/challenges/:id with `{ visibility }` ALONE — the one edit the
 * server allows even on an already-active challenge (see activateChallenge's
 * comment on why this stays a separate call). */
export async function setChallengeVisibility(id: string, visibility: 'PRIVATE' | 'PUBLIC'): Promise<Challenge> {
  const response = await apiFetch(`/api/challenges/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ visibility }),
  });
  if (!response.ok) throw new Error(`Failed to update challenge visibility (${response.status}).`);
  return toChallenge(await response.json());
}

export async function deleteChallenge(id: string): Promise<void> {
  const response = await apiFetch(`/api/challenges/${id}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete challenge (${response.status}).`);
  }
}
