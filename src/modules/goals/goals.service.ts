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

export async function createGoal(userId: string, input: CreateGoalInput): Promise<Goal> {
  return prisma.goal.create({ data: { userId, ...input } });
}

export async function updateGoal(id: string, input: UpdateGoalInput): Promise<Goal> {
  return prisma.goal.update({ where: { id }, data: input });
}

export async function deleteGoal(id: string): Promise<void> {
  await prisma.goal.delete({ where: { id } });
}
