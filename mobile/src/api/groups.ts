import { apiFetch, apiFetchJson } from '@/src/api/client';
import { API_BASE_URL } from '@/src/config/env';

/**
 * Corporate wellbeing (groups, invitations, group challenges). Every
 * function mirrors one backend route 1:1 (src/app/api/admin/groups/**,
 * src/app/api/me/wellbeing/**, src/app/api/invitations/**); the admin ones
 * are gated server-side by requireAdmin(), so nothing here checks a role.
 */

export type GroupChallengeType = 'SLEEP_SCORE' | 'DAILY_STEPS' | 'WEEKLY_WORKOUTS' | 'VIDEO_SESSIONS';
export type GroupChallengeStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED';
/** INDIVIDUAL: everyone has their own goal. COLLECTIVE: one shared team total (steps, workouts or video sessions). */
export type GroupChallengeMode = 'INDIVIDUAL' | 'COLLECTIVE';

export interface GroupSummary {
  id: string;
  name: string;
  /** Relative API path of the logo, or null. Use `groupLogoSource`. */
  logoUrl: string | null;
  memberCount: number;
  pendingInvitationCount: number;
  challengeCount: number;
  createdAt: string;
}

export interface GroupMember {
  userId: string;
  email: string;
  fullName: string | null;
  joinedAt: string;
  lastSyncAt: string | null;
  connectedProviders: string[];
}

export interface GroupInvitation {
  id: string;
  email: string;
  state: 'PENDING' | 'EXPIRED';
  sentAt: string;
  expiresAt: string;
}

export interface GroupDetail extends GroupSummary {
  members: GroupMember[];
  invitations: GroupInvitation[];
}

export interface LogoUpload {
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  dataBase64: string;
}

/** Absolute URL for an `<Image source={{ uri }}>` — logos are public, no token needed. */
export function groupLogoUri(logoUrl: string | null): string | null {
  return logoUrl ? `${API_BASE_URL}${logoUrl}` : null;
}

// ---------------------------------------------------------------- admin

export const listAdminGroups = () => apiFetchJson<{ groups: GroupSummary[] }>('/api/admin/groups').then((r) => r.groups);

export const createAdminGroup = (input: { name: string; logo?: LogoUpload }) =>
  apiFetchJson<GroupSummary>('/api/admin/groups', { method: 'POST', body: JSON.stringify(input) });

export const getAdminGroup = (id: string) => apiFetchJson<GroupDetail>(`/api/admin/groups/${id}`);

/** `logo: null` removes the logo; omit it to leave it unchanged. */
export const updateAdminGroup = (id: string, input: { name?: string; logo?: LogoUpload | null }) =>
  apiFetchJson<GroupSummary>(`/api/admin/groups/${id}`, { method: 'PATCH', body: JSON.stringify(input) });

async function expectNoContent(path: string, init: RequestInit): Promise<void> {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${response.status}).`);
  }
}

export const deleteAdminGroup = (id: string) => expectNoContent(`/api/admin/groups/${id}`, { method: 'DELETE' });

export interface InviteResult {
  email: string;
  outcome: 'invited' | 'already_member';
}

/** `emails`: addresses, or one pasted string (commas/spaces/newlines). */
export const inviteToGroup = (id: string, emails: string | string[]) =>
  apiFetchJson<{ results: InviteResult[] }>(`/api/admin/groups/${id}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ emails }),
  }).then((r) => r.results);

export const revokeGroupInvitation = (groupId: string, invitationId: string) =>
  expectNoContent(`/api/admin/groups/${groupId}/invitations/${invitationId}`, { method: 'DELETE' });

export const removeGroupMember = (groupId: string, userId: string) =>
  expectNoContent(`/api/admin/groups/${groupId}/members/${userId}`, { method: 'DELETE' });

export interface TeamSummary {
  participants: number;
  members: number;
  completed: number;
  averagePercent: number;
}

export interface MemberProgress {
  currentCount: number;
  requiredCount: number;
  percent: number;
  completed: boolean;
}

/** Team-total progress of a COLLECTIVE challenge. */
export interface CollectiveProgress {
  total: number;
  targetTotal: number;
  percent: number;
  reached: boolean;
}

/** One day of the team chart: what the team added that day and the running total. */
export interface SeriesPoint {
  date: string;
  amount: number;
  cumulative: number;
}

export interface CollectiveSeries {
  targetTotal: number;
  points: SeriesPoint[];
}

export interface GroupChallenge {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  type: GroupChallengeType;
  threshold: number;
  requiredCount: number;
  mode: GroupChallengeMode;
  /** The team total to reach — COLLECTIVE only, else null. */
  targetTotal: number | null;
  startDate: string;
  endDate: string;
  status: GroupChallengeStatus;
  target: string;
  daysRemaining: number | null;
  /** VIDEO_SESSIONS only: the YouTube video to watch to the end. */
  video: { videoId: string; title: string; durationSec: number } | null;
}

export interface AdminGroupChallengeListItem extends GroupChallenge {
  team: TeamSummary;
  collective: CollectiveProgress | null;
}

export interface CreateGroupChallengeInput {
  name: string;
  description?: string;
  type: GroupChallengeType;
  /** INDIVIDUAL (default): per-person goal. */
  mode?: GroupChallengeMode;
  threshold?: number;
  requiredCount?: number;
  /** COLLECTIVE: the total (steps, workouts or video sessions) the whole team has to reach. */
  targetTotal?: number;
  /** VIDEO_SESSIONS: the YouTube link, an optional player title, and the video's length in seconds. */
  videoUrl?: string;
  videoTitle?: string;
  videoDurationSec?: number;
  startDate: string;
  endDate: string;
}

export const listAdminGroupChallenges = (groupId: string) =>
  apiFetchJson<{ challenges: AdminGroupChallengeListItem[] }>(`/api/admin/groups/${groupId}/challenges`).then(
    (r) => r.challenges,
  );

export const createAdminGroupChallenge = (groupId: string, input: CreateGroupChallengeInput) =>
  apiFetchJson<GroupChallenge>(`/api/admin/groups/${groupId}/challenges`, { method: 'POST', body: JSON.stringify(input) });

export interface AdminChallengeDetail {
  challenge: GroupChallenge;
  team: TeamSummary;
  collective: CollectiveProgress | null;
  /** The team's running total per day — COLLECTIVE only. */
  series: CollectiveSeries | null;
  participants: { userId: string; email: string; fullName: string | null; progress: MemberProgress }[];
  notJoined: { userId: string; email: string; fullName: string | null }[];
}

export const getAdminGroupChallenge = (groupId: string, challengeId: string) =>
  apiFetchJson<AdminChallengeDetail>(`/api/admin/groups/${groupId}/challenges/${challengeId}`);

export const deleteAdminGroupChallenge = (groupId: string, challengeId: string) =>
  expectNoContent(`/api/admin/groups/${groupId}/challenges/${challengeId}`, { method: 'DELETE' });

export interface MemberHealth {
  member: { userId: string; email: string; fullName: string | null; joinedAt: string };
  connections: { provider: string; status: string; lastSyncAt: string | null }[];
  snapshot: {
    date: string;
    isToday: boolean;
    sourceProviders: string[];
    sleepScore: number | null;
    readinessScore: number | null;
    activityScore: number | null;
    totalSleepMinutes: number | null;
    restingHeartRate: number | null;
    averageHrv: number | null;
    steps: number | null;
    activeCalories: number | null;
  } | null;
  trend: {
    date: string;
    sleepScore: number | null;
    readinessScore: number | null;
    activityScore: number | null;
    totalSleepMinutes: number | null;
    restingHeartRate: number | null;
    averageHrv: number | null;
    steps: number | null;
    activeCalories: number | null;
  }[];
  weeklyWorkouts: number;
  recentWorkouts: { startedAt: string; durationMin: number; activityType: string; provider: string; source: string | null }[];
}

export const getGroupMemberHealth = (groupId: string, userId: string) =>
  apiFetchJson<MemberHealth>(`/api/admin/groups/${groupId}/members/${userId}/health`);

// --------------------------------------------------------------- member

export interface MyGroup {
  id: string;
  name: string;
  logoUrl: string | null;
  memberCount: number;
  joinedAt: string;
}

export interface PendingInvitation {
  id: string;
  groupId: string;
  groupName: string;
  logoUrl: string | null;
  expiresAt: string;
}

export const getMyWellbeing = () =>
  apiFetchJson<{ groups: MyGroup[]; pendingInvitations: PendingInvitation[] }>('/api/me/wellbeing');

export const acceptInvitationById = (invitationId: string) =>
  apiFetchJson<{ groupId: string; groupName: string }>(`/api/me/wellbeing/invitations/${invitationId}/accept`, {
    method: 'POST',
    body: JSON.stringify({ consent: true }),
  });

export const acceptInvitationByToken = (token: string) =>
  apiFetchJson<{ groupId: string; groupName: string }>(`/api/invitations/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    body: JSON.stringify({ consent: true }),
  });

export const leaveGroup = (groupId: string) => expectNoContent(`/api/me/wellbeing/groups/${groupId}`, { method: 'DELETE' });

export interface MyGroupChallenge extends GroupChallenge {
  joined: boolean;
  /** INDIVIDUAL: own progress. COLLECTIVE: own contribution (currentCount) against the team target. */
  me: MemberProgress | null;
  collective: CollectiveProgress | null;
  /** The team's running total per day — COLLECTIVE only; aggregate numbers. */
  series: CollectiveSeries | null;
  team: TeamSummary;
  /** VIDEO_SESSIONS only: whether the video was already finished today (own day), else null. */
  videoDoneToday: boolean | null;
}

export const listMyGroupChallenges = (groupId: string) =>
  apiFetchJson<{ challenges: MyGroupChallenge[] }>(`/api/me/wellbeing/groups/${groupId}/challenges`).then(
    (r) => r.challenges,
  );

export const joinGroupChallenge = (groupId: string, challengeId: string) =>
  apiFetchJson<{ joined: true }>(`/api/me/wellbeing/groups/${groupId}/challenges/${challengeId}/participation`, {
    method: 'POST',
  });

export const leaveGroupChallenge = (groupId: string, challengeId: string) =>
  expectNoContent(`/api/me/wellbeing/groups/${groupId}/challenges/${challengeId}/participation`, { method: 'DELETE' });

export interface VideoWatchStart {
  watchId: string;
  startedAt: string;
}

export interface VideoWatchResult {
  /** False when today's session had already been counted. */
  counted: boolean;
  sessions: number;
  day: string;
}

/** Starts a viewing of the challenge's video; the `watchId` is needed to finish it. */
export const startVideoWatch = (groupId: string, challengeId: string) =>
  apiFetchJson<VideoWatchStart>(`/api/me/wellbeing/groups/${groupId}/challenges/${challengeId}/video/start`, { method: 'POST' });

/** Reports the video as watched to the end; the server checks the real time and the playing time. */
export const completeVideoWatch = (groupId: string, challengeId: string, input: { watchId: string; watchedSeconds: number }) =>
  apiFetchJson<VideoWatchResult>(`/api/me/wellbeing/groups/${groupId}/challenges/${challengeId}/video/complete`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

// --------------------------------------------------- public invitation

export type InvitationStatus = 'valid' | 'expired' | 'revoked' | 'accepted' | 'invalid';

export interface InvitationPreview {
  status: InvitationStatus;
  groupName?: string;
  logoUrl?: string | null;
  email?: string;
  accountExists?: boolean;
}

/** GET /api/invitations/:token — public (plain fetch: the visitor is usually signed out). */
export async function previewInvitation(token: string): Promise<InvitationPreview | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/invitations/${encodeURIComponent(token)}`);
    if (!response.ok) return null;
    return (await response.json()) as InvitationPreview;
  } catch {
    return null;
  }
}
