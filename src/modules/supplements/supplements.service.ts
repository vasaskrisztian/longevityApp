import { prisma } from '@/lib/db/prisma';
import type { Supplement } from '@prisma/client';
import type {
  CreateSupplementInput,
  UpdateSupplementInput,
} from '@/lib/validation/supplement.schemas';

/**
 * Ownership (IDOR/BOLA) checks happen in the Route Handler, via
 * requireOwnResourceOrAdmin, BEFORE any of the by-id functions below are
 * called — see src/app/api/supplements/[id]/route.ts. These functions
 * assume the caller has already verified the right to act on `id`.
 */

export async function listSupplements(userId: string): Promise<Supplement[]> {
  return prisma.supplement.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getSupplementById(id: string): Promise<Supplement | null> {
  return prisma.supplement.findUnique({ where: { id } });
}

export async function createSupplement(
  userId: string,
  input: CreateSupplementInput,
): Promise<Supplement> {
  return prisma.supplement.create({
    data: { userId, ...input },
  });
}

export async function updateSupplement(
  id: string,
  input: UpdateSupplementInput,
): Promise<Supplement> {
  return prisma.supplement.update({ where: { id }, data: input });
}

export async function deleteSupplement(id: string): Promise<void> {
  await prisma.supplement.delete({ where: { id } });
}
