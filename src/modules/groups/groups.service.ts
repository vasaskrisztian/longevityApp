import { prisma } from '@/lib/db/prisma';
import { recordAuditLog } from '@/lib/audit/audit-log.service';
import { decodeLogo } from './group-logo';
import type { CreateGroupInput, UpdateGroupInput } from '@/lib/validation/group.schemas';

/**
 * Corporate wellbeing groups. Every function here assumes its caller already
 * passed the right gate in the Route Handler (`requireAdmin` for the admin
 * functions, `requireAuthenticatedUser` + own userId for the member ones) —
 * same convention as modules/admin and modules/challenges.
 *
 * Privacy model: a person is a *member* only after accepting an invitation
 * AND explicitly consenting to the group's administrators seeing their health
 * data (`GroupMembership.consentAcceptedAt`). Leaving deletes the membership
 * (and the person's participation in the group's challenges), which ends the
 * administrators' access immediately.
 */

export interface GroupSummaryDTO {
  id: string;
  name: string;
  /** Relative API path of the logo (cache-busted), null when the group has none. */
  logoUrl: string | null;
  memberCount: number;
  pendingInvitationCount: number;
  challengeCount: number;
  createdAt: string;
}

export interface GroupMemberDTO {
  userId: string;
  email: string;
  fullName: string | null;
  joinedAt: string;
  /** Most recent successful device sync across the person's connections. */
  lastSyncAt: string | null;
  connectedProviders: string[];
}

export type GroupInvitationState = 'PENDING' | 'EXPIRED';

export interface GroupInvitationDTO {
  id: string;
  email: string;
  state: GroupInvitationState;
  sentAt: string;
  expiresAt: string;
}

export interface GroupDetailDTO extends GroupSummaryDTO {
  members: GroupMemberDTO[];
  invitations: GroupInvitationDTO[];
}

export interface MyGroupDTO {
  id: string;
  name: string;
  logoUrl: string | null;
  memberCount: number;
  joinedAt: string;
}

export function groupLogoUrl(group: { id: string; hasLogo: boolean; updatedAt: Date }): string | null {
  return group.hasLogo ? `/api/groups/${group.id}/logo?v=${group.updatedAt.getTime()}` : null;
}

export function invitationState(invitation: { expiresAt: Date }, now: Date = new Date()): GroupInvitationState {
  return invitation.expiresAt.getTime() <= now.getTime() ? 'EXPIRED' : 'PENDING';
}

// `@prisma/client` row types aren't available in every environment this
// project is developed in (see inbody.service.ts), hence the loose row types.
/* eslint-disable @typescript-eslint/no-explicit-any */

function toSummary(row: any): GroupSummaryDTO {
  const now = new Date();
  return {
    id: row.id,
    name: row.name,
    logoUrl: groupLogoUrl({ id: row.id, hasLogo: Boolean(row.logoContentType), updatedAt: row.updatedAt }),
    memberCount: row._count?.members ?? 0,
    pendingInvitationCount: (row.invitations ?? []).filter(
      (invitation: any) => invitation.status === 'PENDING' && invitationState(invitation, now) === 'PENDING',
    ).length,
    challengeCount: row._count?.challenges ?? 0,
    createdAt: row.createdAt.toISOString(),
  };
}

const SUMMARY_SELECT = {
  id: true,
  name: true,
  logoContentType: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { members: true, challenges: true } },
  invitations: { where: { status: 'PENDING' }, select: { status: true, expiresAt: true } },
} as const;

export async function createGroup(adminId: string, input: CreateGroupInput): Promise<GroupSummaryDTO> {
  const logo = input.logo ? decodeLogo(input.logo) : null;
  const row: any = await prisma.wellbeingGroup.create({
    data: {
      name: input.name,
      createdById: adminId,
      ...(logo ? { logoData: logo.data, logoContentType: logo.contentType } : {}),
    },
    select: SUMMARY_SELECT,
  });
  await recordAuditLog({
    actorUserId: adminId,
    targetUserId: null,
    action: 'ADMIN_GROUP_CREATE',
    entityType: 'WellbeingGroup',
    entityId: row.id,
  });
  return toSummary(row);
}

export async function updateGroup(
  adminId: string,
  groupId: string,
  input: UpdateGroupInput,
): Promise<GroupSummaryDTO | null> {
  const existing = await prisma.wellbeingGroup.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!existing) return null;

  const data: { name?: string; logoData?: Buffer | null; logoContentType?: string | null } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.logo === null) {
    data.logoData = null;
    data.logoContentType = null;
  } else if (input.logo) {
    const logo = decodeLogo(input.logo);
    data.logoData = logo.data;
    data.logoContentType = logo.contentType;
  }

  const row: any = await prisma.wellbeingGroup.update({ where: { id: groupId }, data, select: SUMMARY_SELECT });
  await recordAuditLog({
    actorUserId: adminId,
    targetUserId: null,
    action: 'ADMIN_GROUP_UPDATE',
    entityType: 'WellbeingGroup',
    entityId: groupId,
  });
  return toSummary(row);
}

export async function deleteGroup(adminId: string, groupId: string): Promise<boolean> {
  const existing = await prisma.wellbeingGroup.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!existing) return false;
  await prisma.wellbeingGroup.delete({ where: { id: groupId } });
  await recordAuditLog({
    actorUserId: adminId,
    targetUserId: null,
    action: 'ADMIN_GROUP_DELETE',
    entityType: 'WellbeingGroup',
    entityId: groupId,
  });
  return true;
}

export async function listGroupsForAdmin(): Promise<GroupSummaryDTO[]> {
  const rows: any[] = await prisma.wellbeingGroup.findMany({
    orderBy: { createdAt: 'desc' },
    select: SUMMARY_SELECT,
  });
  return rows.map(toSummary);
}

/** The group, its (consented) members with their sync state, and every invitation that is still open or has lapsed. */
export async function getGroupDetailForAdmin(groupId: string): Promise<GroupDetailDTO | null> {
  const row: any = await prisma.wellbeingGroup.findUnique({
    where: { id: groupId },
    select: {
      ...SUMMARY_SELECT,
      members: {
        orderBy: { createdAt: 'asc' },
        select: {
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { fullName: true } },
              wearableConnections: { select: { provider: true, status: true, lastSyncAt: true } },
            },
          },
        },
      },
    },
  });
  if (!row) return null;

  const now = new Date();
  const members: GroupMemberDTO[] = (row.members ?? []).map((membership: any) => {
    const connections: any[] = membership.user.wearableConnections ?? [];
    const syncTimes = connections
      .map((connection) => (connection.lastSyncAt ? connection.lastSyncAt.getTime() : 0))
      .filter((time) => time > 0);
    return {
      userId: membership.user.id,
      email: membership.user.email,
      fullName: membership.user.profile?.fullName ?? null,
      joinedAt: membership.createdAt.toISOString(),
      lastSyncAt: syncTimes.length ? new Date(Math.max(...syncTimes)).toISOString() : null,
      connectedProviders: connections.filter((connection) => connection.status === 'CONNECTED').map((c) => c.provider),
    };
  });

  const invitationRows: any[] = await prisma.groupInvitation.findMany({
    where: { groupId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  const invitations: GroupInvitationDTO[] = invitationRows.map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    state: invitationState(invitation, now),
    sentAt: invitation.lastSentAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
  }));

  return { ...toSummary(row), members, invitations };
}

/** Public logo bytes (also embedded in invitation emails) — null when the group or its logo does not exist. */
export async function getGroupLogo(groupId: string): Promise<{ data: Buffer; contentType: string } | null> {
  const row: any = await prisma.wellbeingGroup.findUnique({
    where: { id: groupId },
    select: { logoData: true, logoContentType: true },
  });
  if (!row?.logoData || !row.logoContentType) return null;
  return { data: Buffer.from(row.logoData), contentType: row.logoContentType };
}

export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const row = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  return Boolean(row);
}

/** Member ids of a group — used for notifications and progress overviews. */
export async function listMemberIds(groupId: string): Promise<string[]> {
  const rows: any[] = await prisma.groupMembership.findMany({ where: { groupId }, select: { userId: true } });
  return rows.map((row) => row.userId);
}

/** Removes a person from a group and from that group's challenges. Used for "leave" and for an admin removing a member. */
export async function removeMembership(groupId: string, userId: string): Promise<boolean> {
  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!membership) return false;
  await prisma.$transaction([
    prisma.groupChallengeParticipant.deleteMany({ where: { userId, challenge: { groupId } } }),
    prisma.groupMembership.delete({ where: { groupId_userId: { groupId, userId } } }),
  ]);
  return true;
}

export async function removeMemberAsAdmin(adminId: string, groupId: string, userId: string): Promise<boolean> {
  const removed = await removeMembership(groupId, userId);
  if (removed) {
    await recordAuditLog({
      actorUserId: adminId,
      targetUserId: userId,
      action: 'ADMIN_GROUP_REMOVE_MEMBER',
      entityType: 'WellbeingGroup',
      entityId: groupId,
    });
  }
  return removed;
}

export async function listMyGroups(userId: string): Promise<MyGroupDTO[]> {
  const rows: any[] = await prisma.groupMembership.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: {
      createdAt: true,
      group: {
        select: {
          id: true,
          name: true,
          logoContentType: true,
          updatedAt: true,
          _count: { select: { members: true } },
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.group.id,
    name: row.group.name,
    logoUrl: groupLogoUrl({ id: row.group.id, hasLogo: Boolean(row.group.logoContentType), updatedAt: row.group.updatedAt }),
    memberCount: row.group._count?.members ?? 0,
    joinedAt: row.createdAt.toISOString(),
  }));
}
