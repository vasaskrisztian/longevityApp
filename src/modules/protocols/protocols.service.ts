import { prisma } from '@/lib/db/prisma';
import type { Protocol, ProtocolSupplement } from '@prisma/client';
import type { CreateProtocolInput, UpdateProtocolInput } from '@/lib/validation/protocol.schemas';

/**
 * Ownership (IDOR/BOLA) checks happen in the Route Handler, via
 * requireOwnResourceOrAdmin, BEFORE any of the by-id functions below are
 * called — see src/app/api/protocols/[id]/route.ts. These functions assume
 * the caller has already verified the right to act on `id`. The one
 * exception is `userId`, threaded through explicitly on create/update: it's
 * needed to scope the "only one active protocol" invariant below, which the
 * route's per-resource ownership check doesn't (and can't) cover on its own.
 */

export type ProtocolWithSupplements = Protocol & { supplements: ProtocolSupplement[] };

export async function listProtocols(userId: string): Promise<ProtocolWithSupplements[]> {
  return prisma.protocol.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { supplements: true },
  });
}

export async function getProtocolById(id: string): Promise<ProtocolWithSupplements | null> {
  return prisma.protocol.findUnique({ where: { id }, include: { supplements: true } });
}

/** The protocol the dashboard compares today's actuals against — at most one per user. */
export async function getActiveProtocol(userId: string): Promise<ProtocolWithSupplements | null> {
  return prisma.protocol.findFirst({
    where: { userId, isActive: true },
    include: { supplements: true },
  });
}

function stripSupplementId(supplement: { id?: string }) {
  const { id: _id, ...rest } = supplement;
  return rest;
}

/**
 * Marking a protocol active demotes whatever else was active for this user,
 * in the same transaction as the write itself — so a page reload never sees
 * two protocols both `isActive: true`. Uses this codebase's established
 * array-form `$transaction([...])` (see profile.service.ts's
 * completeOnboarding) rather than the interactive callback form, so the ops
 * stay trivially mockable in tests.
 */
export async function createProtocol(
  userId: string,
  input: CreateProtocolInput,
): Promise<ProtocolWithSupplements> {
  const { supplements, isActive, ...rest } = input;

  const ops: unknown[] = [];
  if (isActive) {
    ops.push(prisma.protocol.updateMany({ where: { userId, isActive: true }, data: { isActive: false } }));
  }
  ops.push(
    prisma.protocol.create({
      data: {
        userId,
        isActive: isActive ?? false,
        ...rest,
        supplements: { create: (supplements ?? []).map(stripSupplementId) },
      },
      include: { supplements: true },
    }),
  );

  const results = await prisma.$transaction(ops);
  return results[results.length - 1] as ProtocolWithSupplements;
}

export async function updateProtocol(
  id: string,
  userId: string,
  input: UpdateProtocolInput,
): Promise<ProtocolWithSupplements> {
  const { supplements, isActive, ...rest } = input;

  const ops: unknown[] = [];
  if (isActive) {
    ops.push(
      prisma.protocol.updateMany({
        where: { userId, isActive: true, NOT: { id } },
        data: { isActive: false },
      }),
    );
  }
  if (supplements) {
    // Whole-list replace, not a diff — protocols are edited as a unit from
    // the manager form, and lists here are short (a handful of supplements).
    ops.push(prisma.protocolSupplement.deleteMany({ where: { protocolId: id } }));
  }
  ops.push(
    prisma.protocol.update({
      where: { id },
      data: {
        ...rest,
        ...(isActive !== undefined ? { isActive } : {}),
        ...(supplements ? { supplements: { create: supplements.map(stripSupplementId) } } : {}),
      },
      include: { supplements: true },
    }),
  );

  const results = await prisma.$transaction(ops);
  return results[results.length - 1] as ProtocolWithSupplements;
}

export async function deleteProtocol(id: string): Promise<void> {
  await prisma.protocol.delete({ where: { id } });
}
