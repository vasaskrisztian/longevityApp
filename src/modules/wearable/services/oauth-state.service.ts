import { prisma } from '@/lib/db/prisma';
import { generateRawToken } from '@/lib/auth/tokens';
import { InvalidOAuthStateError } from '../domain/errors';
import type { WearableProviderId } from '../domain/wearable-provider.types';

/**
 * ARCHITECTURE.md §5: `state` is generated server-side, stored bound to the
 * user's session, and single-use with a short TTL. Unlike password-reset
 * tokens (lib/auth/tokens.ts's hashToken), `state` is stored in the clear —
 * schema.prisma's `OAuthState.state` is the direct `@unique` lookup key,
 * and the value round-trips through the browser in under a minute rather
 * than sitting in an email inbox, so hashing it at rest buys nothing here.
 */

const DEFAULT_TTL_MINUTES = 10;

export interface CreateOAuthStateInput {
  userId: string;
  provider: WearableProviderId;
  redirectUri: string;
  codeVerifier?: string;
  ttlMinutes?: number;
}

export interface ConsumedOAuthState {
  userId: string;
  redirectUri: string | null;
  codeVerifier: string | null;
}

export async function createOAuthState(
  input: CreateOAuthStateInput,
): Promise<{ state: string; expiresAt: Date }> {
  const state = generateRawToken();
  const expiresAt = new Date(Date.now() + (input.ttlMinutes ?? DEFAULT_TTL_MINUTES) * 60_000);

  await prisma.oAuthState.create({
    data: {
      state,
      userId: input.userId,
      provider: input.provider,
      redirectUri: input.redirectUri,
      codeVerifier: input.codeVerifier,
      expiresAt,
    },
  });

  return { state, expiresAt };
}

/**
 * Validates AND marks the state used, atomically. The single `updateMany`
 * with `usedAt: null` in its WHERE clause is the whole single-use
 * guarantee: Postgres serializes concurrent UPDATEs to the same row, so of
 * two simultaneous callback requests presenting the same `state` (a
 * double-submit, a replay, or a resent provider callback), at most one can
 * ever see `count === 1` — no separate SELECT-then-UPDATE transaction or
 * row lock is needed for this property. Also enforces the provider match
 * (a state minted for OURA must not validate a GARMIN callback).
 */
export async function consumeOAuthState(
  state: string,
  provider: WearableProviderId,
): Promise<ConsumedOAuthState> {
  const result = await prisma.oAuthState.updateMany({
    where: {
      state,
      provider,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });

  if (result.count !== 1) {
    throw new InvalidOAuthStateError();
  }

  const row = await prisma.oAuthState.findUnique({ where: { state } });
  // Cannot actually happen (we just updated this exact row in the same
  // request), but keeps the return type honest without a non-null assertion.
  if (!row) {
    throw new InvalidOAuthStateError();
  }

  return {
    userId: row.userId,
    redirectUri: row.redirectUri,
    codeVerifier: row.codeVerifier,
  };
}
