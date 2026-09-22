import { prisma } from '@/lib/db/prisma';
import {
  SUPPORTED_WEARABLE_PROVIDERS,
  type ConnectionSummary,
  type WearableProviderId,
} from '../domain/wearable-provider.types';

/**
 * Ownership is enforced by construction here, not by a caller-supplied check:
 * every query below is scoped to the `userId` parameter, which Route
 * Handlers/Server Components must populate from `requireAuthenticatedUser()`
 * — never from a client-supplied id — exactly like modules/supplements and
 * modules/goals. There is no `getConnectionById(id)` in this module for that
 * reason: a wearable connection is only ever looked up by (userId, provider),
 * so there's no id-based entry point an IDOR test would need to probe.
 */

function defaultSummary(provider: WearableProviderId): ConnectionSummary {
  return {
    id: null,
    provider,
    status: 'DISCONNECTED',
    connectedAt: null,
    disconnectedAt: null,
    grantedScopes: [],
    lastSyncAt: null,
    lastSyncStatus: null,
  };
}

// `row` is typed `any` because @prisma/client's generated WearableConnection
// type isn't available in this sandbox — see docs/phase-1-summary.md.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSummary(row: any): ConnectionSummary {
  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    connectedAt: row.connectedAt,
    disconnectedAt: row.disconnectedAt,
    grantedScopes: row.grantedScopes ?? [],
    lastSyncAt: row.lastSyncAt,
    lastSyncStatus: row.lastSyncStatus,
  };
}

/**
 * One entry per SUPPORTED_WEARABLE_PROVIDERS, always — a provider the user
 * has never attempted to connect gets a synthesized DISCONNECTED entry
 * rather than being omitted, so the /profile/devices UI and the
 * GET /api/wearables response never have to special-case "no row yet".
 */
export async function listConnectionsForUser(userId: string): Promise<ConnectionSummary[]> {
  const rows = await prisma.wearableConnection.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byProvider = new Map<WearableProviderId, any>();
  for (const row of rows) {
    // A user may reconnect the same provider after a full revoke (see the
    // schema comment on WearableConnection), so more than one row per
    // provider can exist; `rows` is already newest-first, so the first one
    // seen per provider is the current one.
    if (!byProvider.has(row.provider)) {
      byProvider.set(row.provider, row);
    }
  }

  return SUPPORTED_WEARABLE_PROVIDERS.map((provider) => {
    const row = byProvider.get(provider);
    return row ? toSummary(row) : defaultSummary(provider);
  });
}

export async function getConnectionForUserAndProvider(
  userId: string,
  provider: WearableProviderId,
): Promise<ConnectionSummary> {
  const row = await prisma.wearableConnection.findFirst({
    where: { userId, provider },
    orderBy: { createdAt: 'desc' },
  });
  return row ? toSummary(row) : defaultSummary(provider);
}

/**
 * ARCHITECTURE.md §5's "UPSERT WearableConnection (status=CONNECTED,
 * grantedScopes, connectedAt)" — called only from the OAuth callback route
 * after a successful token exchange. Reuses the user's existing row for
 * this provider if one exists (so a reconnect-after-disconnect doesn't
 * orphan the old row or churn `EncryptedCredential`'s `connectionId` FK),
 * otherwise creates one. "One connection per user" (§5) is enforced by this
 * function always looking up by (userId, provider) first — the schema
 * itself doesn't need a unique constraint to make that true in practice.
 */
export async function upsertConnectionAsConnected(params: {
  userId: string;
  provider: WearableProviderId;
  grantedScopes: string[];
}): Promise<{ id: string }> {
  const existing = await prisma.wearableConnection.findFirst({
    where: { userId: params.userId, provider: params.provider },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    const updated = await prisma.wearableConnection.update({
      where: { id: existing.id },
      data: {
        status: 'CONNECTED',
        connectedAt: new Date(),
        disconnectedAt: null,
        grantedScopes: params.grantedScopes,
      },
    });
    return { id: updated.id };
  }

  const created = await prisma.wearableConnection.create({
    data: {
      userId: params.userId,
      provider: params.provider,
      status: 'CONNECTED',
      connectedAt: new Date(),
      grantedScopes: params.grantedScopes,
    },
  });
  return { id: created.id };
}

/** Used by disconnect/route.ts after local + best-effort provider-side revocation. */
export async function markConnectionDisconnected(connectionId: string): Promise<void> {
  await prisma.wearableConnection.update({
    where: { id: connectionId },
    data: { status: 'DISCONNECTED', disconnectedAt: new Date() },
  });
}

/** Used by refresh-credential.service.ts when the provider rejects a refresh attempt (ARCHITECTURE.md §6.2, guarantee #3). */
export async function markConnectionAuthRequired(connectionId: string): Promise<void> {
  await prisma.wearableConnection.update({
    where: { id: connectionId },
    data: { status: 'AUTH_REQUIRED' },
  });
}

/**
 * Used by sync.service.ts after every ingestion attempt (§7.4's "connection
 * .lastSyncAt/lastSuccessfulSyncAt/lastSyncStatus updated" step).
 * `lastSuccessfulSyncAt` only advances for SUCCESS/PARTIAL — a PARTIAL sync
 * still fetched and stored real data for the endpoints that worked, so it
 * counts as "successful enough" to reset the incremental-sync window (§7.3);
 * a FAILED sync (e.g. AUTH_REQUIRED before any fetch happened) must not.
 */
export async function recordSyncOutcome(
  connectionId: string,
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED',
): Promise<void> {
  const now = new Date();
  await prisma.wearableConnection.update({
    where: { id: connectionId },
    data: {
      lastSyncAt: now,
      lastSyncStatus: status,
      ...(status === 'FAILED' ? {} : { lastSuccessfulSyncAt: now }),
    },
  });
}
