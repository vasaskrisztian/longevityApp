import { prisma } from '@/lib/db/prisma';
import { recordAuditLog } from '@/lib/audit/audit-log.service';
import { generateRawToken, hashToken } from '@/lib/auth/tokens';
import { sendGroupInvitationEmail } from '@/lib/email/group-invitation-email';
import { createNotification } from '@/modules/notifications/notifications.service';
import { groupLogoUrl } from './groups.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export type InvitationLookupStatus = 'valid' | 'expired' | 'revoked' | 'accepted' | 'invalid';

export class InvitationError extends Error {
  constructor(
    public readonly reason: 'invalid' | 'expired' | 'revoked' | 'accepted' | 'email_mismatch',
    message?: string,
  ) {
    super(message ?? `Invitation ${reason}`);
    this.name = 'InvitationError';
  }
}

export interface InviteResult {
  email: string;
  outcome: 'invited' | 'already_member';
}

/**
 * Creates (or refreshes) one invitation per address and emails each one.
 * Re-inviting an address that already has a row for this group replaces its
 * token and expiry rather than adding rows, so the admin's list stays one
 * line per person and an old link stops working. People who are already
 * members are skipped. If the address already belongs to a registered
 * user, they additionally get an in-app notification they can accept from.
 */
export async function inviteMembers(params: {
  adminId: string;
  groupId: string;
  emails: string[];
}): Promise<InviteResult[] | null> {
  const group: any = await prisma.wellbeingGroup.findUnique({
    where: { id: params.groupId },
    select: { id: true, name: true, logoContentType: true },
  });
  if (!group) return null;

  const inviter: any = await prisma.user.findUnique({
    where: { id: params.adminId },
    select: { profile: { select: { fullName: true } } },
  });
  const inviterName: string | null = inviter?.profile?.fullName ?? null;

  const emails = Array.from(new Set(params.emails.map((email) => email.trim().toLowerCase())));
  const results: InviteResult[] = [];

  for (const email of emails) {
    const existingUser: any = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      const membership = await prisma.groupMembership.findUnique({
        where: { groupId_userId: { groupId: group.id, userId: existingUser.id } },
        select: { id: true },
      });
      if (membership) {
        results.push({ email, outcome: 'already_member' });
        continue;
      }
    }

    const rawToken = generateRawToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
    const invitation: any = await prisma.groupInvitation.upsert({
      where: { groupId_email: { groupId: group.id, email } },
      create: {
        groupId: group.id,
        email,
        tokenHash: hashToken(rawToken),
        status: 'PENDING',
        invitedById: params.adminId,
        expiresAt,
        lastSentAt: now,
      },
      update: {
        tokenHash: hashToken(rawToken),
        status: 'PENDING',
        invitedById: params.adminId,
        expiresAt,
        lastSentAt: now,
        acceptedAt: null,
        acceptedUserId: null,
      },
    });

    if (existingUser) {
      await createNotification(existingUser.id, {
        type: 'GROUP_INVITATION',
        title: `Invitation to ${group.name}`,
        body: `You have been invited to join ${group.name}. Accepting lets the group's administrators see your health data; you can leave at any time.`,
        data: { invitationId: invitation.id, groupId: group.id },
      });
    }

    await sendGroupInvitationEmail({
      to: email,
      groupId: group.id,
      groupName: group.name,
      hasLogo: Boolean(group.logoContentType),
      rawToken,
      inviterName,
      expiresAt,
    });
    results.push({ email, outcome: 'invited' });
  }

  await recordAuditLog({
    actorUserId: params.adminId,
    targetUserId: null,
    action: 'ADMIN_GROUP_INVITE',
    entityType: 'WellbeingGroup',
    entityId: group.id,
    metadata: { invited: results.filter((r) => r.outcome === 'invited').length },
  });

  return results;
}

/** Cancels a pending invitation (its link stops working). False when it doesn't exist in that group. */
export async function revokeInvitation(adminId: string, groupId: string, invitationId: string): Promise<boolean> {
  const invitation: any = await prisma.groupInvitation.findUnique({ where: { id: invitationId } });
  if (!invitation || invitation.groupId !== groupId) return false;
  if (invitation.status === 'ACCEPTED') return false;
  await prisma.groupInvitation.delete({ where: { id: invitationId } });
  await recordAuditLog({
    actorUserId: adminId,
    targetUserId: null,
    action: 'ADMIN_GROUP_REVOKE_INVITATION',
    entityType: 'WellbeingGroup',
    entityId: groupId,
  });
  return true;
}

function lookupStatus(invitation: any, now: Date = new Date()): InvitationLookupStatus {
  if (invitation.status === 'REVOKED') return 'revoked';
  if (invitation.status === 'ACCEPTED') return 'accepted';
  if (invitation.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'valid';
}

async function findInvitationByToken(rawToken: string): Promise<any | null> {
  if (!rawToken) return null;
  return prisma.groupInvitation.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { group: { select: { id: true, name: true, logoContentType: true, updatedAt: true } } },
  });
}

export interface InvitationPreview {
  status: InvitationLookupStatus;
  groupName?: string;
  logoUrl?: string | null;
  /** The address the invitation was sent to (only for a valid link — the holder received it there). */
  email?: string;
  /** Whether that address already has an account (then the person signs in instead of registering). */
  accountExists?: boolean;
}

/** What the public invitation page shows. An unknown token reveals nothing but `invalid`. */
export async function previewInvitation(rawToken: string): Promise<InvitationPreview> {
  const invitation = await findInvitationByToken(rawToken);
  if (!invitation) return { status: 'invalid' };
  const status = lookupStatus(invitation);
  const base: InvitationPreview = {
    status,
    groupName: invitation.group.name,
    logoUrl: groupLogoUrl({
      id: invitation.group.id,
      hasLogo: Boolean(invitation.group.logoContentType),
      updatedAt: invitation.group.updatedAt,
    }),
  };
  if (status !== 'valid') return base;
  const user = await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
  return { ...base, email: invitation.email, accountExists: Boolean(user) };
}

/**
 * Registration with an invitation link: the token must be valid and sent to
 * exactly this address. Returns the invitation for `completeInvitation`.
 */
export async function requireUsableInvitationForEmail(rawToken: string, email: string): Promise<any> {
  const invitation = await findInvitationByToken(rawToken);
  if (!invitation) throw new InvitationError('invalid');
  const status = lookupStatus(invitation);
  if (status !== 'valid') throw new InvitationError(status === 'invalid' ? 'invalid' : status);
  if (invitation.email !== email.trim().toLowerCase()) throw new InvitationError('email_mismatch');
  return invitation;
}

/** Joins the user to the group (with the consent timestamp) and closes the invitation. Idempotent per (group, user). */
export async function completeInvitation(params: { invitation: { id: string; groupId: string }; userId: string }) {
  const now = new Date();
  await prisma.$transaction([
    prisma.groupMembership.upsert({
      where: { groupId_userId: { groupId: params.invitation.groupId, userId: params.userId } },
      create: { groupId: params.invitation.groupId, userId: params.userId, consentAcceptedAt: now },
      update: {},
    }),
    prisma.groupInvitation.update({
      where: { id: params.invitation.id },
      data: { status: 'ACCEPTED', acceptedAt: now, acceptedUserId: params.userId },
    }),
  ]);
}

/**
 * A signed-in user accepts an invitation, by link token or by invitation id
 * (from a notification / their pending list). The invitation must have been
 * sent to the user's own address. The route has already required explicit
 * consent to share health data with the group's administrators.
 */
export async function acceptInvitation(params: {
  userId: string;
  rawToken?: string;
  invitationId?: string;
}): Promise<{ groupId: string; groupName: string }> {
  const invitation: any = params.rawToken
    ? await findInvitationByToken(params.rawToken)
    : params.invitationId
      ? await prisma.groupInvitation.findUnique({
          where: { id: params.invitationId },
          include: { group: { select: { id: true, name: true, logoContentType: true, updatedAt: true } } },
        })
      : null;
  if (!invitation) throw new InvitationError('invalid');

  const user: any = await prisma.user.findUnique({ where: { id: params.userId }, select: { email: true } });
  if (!user || user.email.toLowerCase() !== invitation.email) throw new InvitationError('email_mismatch');

  const existing = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId: invitation.groupId, userId: params.userId } },
    select: { id: true },
  });
  if (existing) return { groupId: invitation.group.id, groupName: invitation.group.name };

  const status = lookupStatus(invitation);
  if (status !== 'valid') throw new InvitationError(status === 'invalid' ? 'invalid' : status);

  await completeInvitation({ invitation, userId: params.userId });
  return { groupId: invitation.group.id, groupName: invitation.group.name };
}

export interface PendingInvitationDTO {
  id: string;
  groupId: string;
  groupName: string;
  logoUrl: string | null;
  expiresAt: string;
}

/** Open, unexpired invitations addressed to the signed-in user's own email. */
export async function listMyPendingInvitations(userId: string): Promise<PendingInvitationDTO[]> {
  const user: any = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return [];
  const rows: any[] = await prisma.groupInvitation.findMany({
    where: { email: user.email.toLowerCase(), status: 'PENDING', expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    include: { group: { select: { id: true, name: true, logoContentType: true, updatedAt: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    groupId: row.group.id,
    groupName: row.group.name,
    logoUrl: groupLogoUrl({ id: row.group.id, hasLogo: Boolean(row.group.logoContentType), updatedAt: row.group.updatedAt }),
    expiresAt: row.expiresAt.toISOString(),
  }));
}
