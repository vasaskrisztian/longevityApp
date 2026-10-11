import { prisma } from '@/lib/db/prisma';
import type { Goal } from '@prisma/client';
import type { CreateGoalInput, UpdateGoalInput } from '@/lib/validation/goal.schemas';

/**
 * Ownership (IDOR/BOLA) checks happen in the Route Handler, via
 * requireOwnResourceOrAdmin, BEFORE any of the by-id functions below are
 * called — see src/app/api/goals/[id]/route.ts. These functions assume the
 * caller has already verified the right to act on `id`.
 */

export async function listGoals(userId: string): Promise<Goal[]> {
  return prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getGoalById(id: string): Promise<Goal | null> {
  return prisma.goal.findUnique({ where: { id } });
}

/** Thrown when a goal is attached to a protocol that is not the caller's own. */
export class UnknownProtocolError extends Error {
  constructor() {
    super('That protocol is not on your list.');
    this.name = 'UnknownProtocolError';
  }
}

async function assertOwnProtocol(userId: string, protocolId: string): Promise<void> {
  const protocol = await prisma.protocol.findFirst({ where: { id: protocolId, userId }, select: { id: true } });
  if (!protocol) throw new UnknownProtocolError();
}

export async function createGoal(userId: string, input: CreateGoalInput): Promise<Goal> {
  const { protocolId, ...rest } = input;
  let resolvedProtocolId: string | null;
  if (protocolId === undefined) {
    // Older app builds do not know about protocols: the goal goes under the active one.
    const active = await prisma.protocol.findFirst({ where: { userId, isActive: true }, select: { id: true } });
    resolvedProtocolId = active?.id ?? null;
  } else if (protocolId === null) {
    resolvedProtocolId = null;
  } else {
    await assertOwnProtocol(userId, protocolId);
    resolvedProtocolId = protocolId;
  }
  return prisma.goal.create({ data: { userId, ...rest, protocolId: resolvedProtocolId } });
}

/** `userId` is the goal's (already verified) owner — needed to check a new protocolId belongs to them. */
export async function updateGoal(id: string, userId: string, input: UpdateGoalInput): Promise<Goal> {
  if (input.protocolId) await assertOwnProtocol(userId, input.protocolId);
  return prisma.goal.update({ where: { id }, data: input });
}

export async function deleteGoal(id: string): Promise<void> {
  await prisma.goal.delete({ where: { id } });
}
