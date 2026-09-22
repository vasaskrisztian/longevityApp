import { prisma } from '@/lib/db/prisma';

/**
 * ARCHITECTURE.md §10 threat #15: "Every admin data-access/mutation writes
 * AuditLog; explicit denylist of fields that must never appear in metadata
 * (tokens, passwords, raw payloads)." Before Phase 9, every call site wrote
 * `prisma.auditLog.create` directly (admin.service.ts's two writers, the
 * Oura callback's USER_CONNECT_OURA, the disconnect route's
 * USER_DISCONNECT_OURA) — the denylist existed only as a sentence in this
 * doc, never as code. This module is now the single choke point every
 * AuditLog write goes through, so the denylist is enforced once, not
 * re-implemented (or quietly skipped) at each call site.
 */

export interface AuditLogEntry {
  actorUserId: string | null;
  targetUserId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  /** Free-form, non-sensitive context only — see FORBIDDEN_METADATA_KEY_PATTERNS. */
  metadata?: Record<string, unknown>;
}

// Case-insensitive substring match, deliberately broader than an
// exact-key list — "accessToken", "refresh_token", "Authorization",
// "ciphertext", "authTag" and similar all get caught by one entry here,
// which is the point: a narrow exact-match list is exactly the kind of
// thing a future call site's slightly-differently-named field slips past.
const FORBIDDEN_METADATA_KEY_PATTERNS = [
  'token',
  'password',
  'secret',
  'ciphertext',
  'authtag',
  'credential',
] as const;

export class UnsafeAuditMetadataError extends Error {
  constructor(public readonly field: string) {
    super(
      `Refusing to write AuditLog metadata: field "${field}" looks like a secret and must never be logged (ARCHITECTURE.md §10 threat #15).`,
    );
    this.name = 'UnsafeAuditMetadataError';
  }
}

function assertSafeMetadata(metadata: Record<string, unknown> | undefined): void {
  if (!metadata) {
    return;
  }
  for (const key of Object.keys(metadata)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_METADATA_KEY_PATTERNS.some((pattern) => lower.includes(pattern))) {
      throw new UnsafeAuditMetadataError(key);
    }
  }
}

/**
 * Writes one AuditLog row. Throws `UnsafeAuditMetadataError` — refusing to
 * write anything — rather than silently stripping the offending field: a
 * caller that tried to log a token has a bug worth surfacing loudly, not a
 * log entry worth partially saving.
 */
export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
  assertSafeMetadata(entry.metadata);
  await prisma.auditLog.create({
    data: {
      actorUserId: entry.actorUserId,
      targetUserId: entry.targetUserId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata,
    },
  });
}
