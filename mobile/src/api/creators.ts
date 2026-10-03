import { apiFetch, apiFetchJson } from '@/src/api/client';
import type { Protocol } from '@/src/api/protocols';
import type { Challenge } from '@/src/api/challenges';

export interface CreatorDirectoryItem {
  id: string;
  fullName: string | null;
  /** ISO datetime string. */
  memberSince: string;
  followerCount: number;
  publicProtocolCount: number;
  publicChallengeCount: number;
}

/** GET /api/creators — deliberately public on the server (no auth
 * required), but called here through the same authenticated apiFetch as
 * everything else: harmless (the server ignores the Bearer header for this
 * route) and keeps one client plumbing path instead of two. */
export async function getCreatorDirectory(): Promise<CreatorDirectoryItem[]> {
  return apiFetchJson<CreatorDirectoryItem[]>('/api/creators');
}

export interface PublicMetricPoint {
  /** ISO datetime string. */
  date: string;
  sleepScore: number | null;
  steps: number | null;
  restingHeartRate: number | null;
  averageHrv: number | null;
  activeCalories: number | null;
}

export interface CreatorPublicProfile {
  id: string;
  fullName: string | null;
  memberSince: string;
  followerCount: number;
  protocols: Protocol[];
  challenges: Challenge[];
  recentMetrics: PublicMetricPoint[];
}

/** GET /api/creators/:id — also public. Returns null on a 404 (same
 * collapsed not-found/not-a-creator/not-consenting shape the server uses —
 * see creators.service.ts's getCreatorPublicProfile doc comment) rather
 * than throwing, since a 404 here is an expected, normal outcome, not an
 * error condition the caller needs to catch. */
export async function getCreatorProfile(id: string): Promise<CreatorPublicProfile | null> {
  const response = await apiFetch(`/api/creators/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to load creator profile (${response.status}).`);
  return response.json();
}

export async function getFollowStatus(id: string): Promise<boolean> {
  const { following } = await apiFetchJson<{ following: boolean }>(`/api/creators/${id}/follow`);
  return following;
}

export async function followCreator(id: string): Promise<void> {
  const response = await apiFetch(`/api/creators/${id}/follow`, { method: 'POST' });
  if (!response.ok) throw new Error(`Failed to follow creator (${response.status}).`);
}

export async function unfollowCreator(id: string): Promise<void> {
  const response = await apiFetch(`/api/creators/${id}/follow`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Failed to unfollow creator (${response.status}).`);
}

export interface FollowedCreatorSummary {
  id: string;
  fullName: string | null;
  /** ISO datetime string. */
  followedAt: string;
  publicProtocolCount: number;
  publicChallengeCount: number;
}

/** GET /api/creators/me/following — feeds the Discover screen. */
export async function getMyFollowing(): Promise<FollowedCreatorSummary[]> {
  return apiFetchJson<FollowedCreatorSummary[]>('/api/creators/me/following');
}

export interface PublicProfileStatus {
  accountType: 'MEMBER' | 'CREATOR' | 'ADMIN';
  canPublish: boolean;
}

/** GET /api/creators/me/consent — decides whether Protocols/Challenges show
 * their Publish toggle (canPublish) and whether the Profile hub shows the
 * creator public-profile section at all (accountType === 'CREATOR'). */
export async function getPublicProfileStatus(): Promise<PublicProfileStatus> {
  return apiFetchJson<PublicProfileStatus>('/api/creators/me/consent');
}

/** PATCH /api/creators/me/consent — the CREATOR's own opt-in/opt-out. */
export async function setPublicProfileConsent(consent: boolean): Promise<void> {
  const response = await apiFetch('/api/creators/me/consent', {
    method: 'PATCH',
    body: JSON.stringify({ consent }),
  });
  if (!response.ok) throw new Error(`Failed to update public profile setting (${response.status}).`);
}
