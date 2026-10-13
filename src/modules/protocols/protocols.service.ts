import { prisma } from '@/lib/db/prisma';
import type { Prisma, Protocol, ProtocolSupplement, Supplement } from '@prisma/client';
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

/**
 * A protocol line as the API reports it: the link row plus the linked
 * supplement's own name/dose/frequency/timing (the line itself stores only the
 * link).
 */
export type ProtocolLine = ProtocolSupplement & Pick<Supplement, 'name' | 'dosage' | 'unit' | 'frequency' | 'timing'>;

export type ProtocolWithSupplements = Protocol & { supplements: ProtocolLine[] };

/**
 * A protocol's supplements are lines that point at the user's own supplement
 * list (the single source of name, dose, frequency and timing). Reads join the
 * supplement in and report ITS values on each line, so editing a supplement in
 * Plan > Supplements is reflected in every protocol that uses it.
 */
export const PROTOCOL_INCLUDE = {
  supplements: { include: { supplement: true }, orderBy: { createdAt: 'asc' } },
} as const;

type ProtocolRow = Protocol & {
  supplements: (ProtocolSupplement & { supplement: Supplement })[];
};

export function flattenProtocol(row: ProtocolRow): ProtocolWithSupplements {
  return {
    ...row,
    supplements: (row.supplements ?? []).map(({ supplement, ...line }: ProtocolRow['supplements'][number]) => ({
      ...line,
      name: supplement.name,
      dosage: supplement.dosage,
      unit: supplement.unit,
      frequency: supplement.frequency,
      timing: supplement.timing,
    })),
  };
}

/** Thrown when a protocol refers to a supplement that is not on the caller's own list. */
export class UnknownSupplementError extends Error {
  constructor() {
    super('One of the selected supplements is not on your list.');
    this.name = 'UnknownSupplementError';
  }
}

type InlineSupplement = NonNullable<CreateProtocolInput['supplements']>[number];

/**
 * Turns what a client sent into the user's own supplements, in order and
 * without duplicates: `supplementIds` must all be the caller's; inline lines
 * (what older app builds send: name/dose/...) reuse the user's matching
 * supplement or create it, so no client can bypass the single list.
 */
export async function resolveSupplements(
  userId: string,
  supplementIds: string[] | undefined,
  inline: InlineSupplement[] | undefined,
): Promise<Supplement[]> {
  const resolved: Supplement[] = [];

  const ids = Array.from(new Set(supplementIds ?? []));
  if (ids.length > 0) {
    const owned: Supplement[] = await prisma.supplement.findMany({ where: { id: { in: ids }, userId } });
    if (owned.length !== ids.length) throw new UnknownSupplementError();
    for (const id of ids) resolved.push(owned.find((s) => s.id === id)!);
  }

  for (const line of inline ?? []) {
    const match = {
      userId,
      name: { equals: line.name, mode: 'insensitive' as const },
      dosage: line.dosage ?? null,
      unit: line.unit ?? null,
      frequency: line.frequency ?? null,
      timing: line.timing ?? null,
    };
    const existing = await prisma.supplement.findFirst({ where: match, orderBy: { createdAt: 'asc' } });
    const supplement: Supplement =
      existing ??
      (await prisma.supplement.create({
        data: {
          userId,
          name: line.name,
          dosage: line.dosage ?? null,
          unit: line.unit ?? null,
          frequency: line.frequency ?? null,
          timing: line.timing ?? null,
        },
      }));
    if (!resolved.some((s) => s.id === supplement.id)) resolved.push(supplement);
  }

  return resolved;
}

function lineFor(supplement: Supplement) {
  return { supplementId: supplement.id };
}

export async function listProtocols(userId: string): Promise<ProtocolWithSupplements[]> {
  const rows = await prisma.protocol.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: PROTOCOL_INCLUDE,
  });
  return (rows as ProtocolRow[]).map(flattenProtocol);
}

export async function getProtocolById(id: string): Promise<ProtocolWithSupplements | null> {
  const row = await prisma.protocol.findUnique({ where: { id }, include: PROTOCOL_INCLUDE });
  return row ? flattenProtocol(row as ProtocolRow) : null;
}

/** The protocol the dashboard compares today's actuals against — at most one per user. */
export async function getActiveProtocol(userId: string): Promise<ProtocolWithSupplements | null> {
  const row = await prisma.protocol.findFirst({
    where: { userId, isActive: true },
    include: PROTOCOL_INCLUDE,
  });
  return row ? flattenProtocol(row as ProtocolRow) : null;
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
  const { supplements, supplementIds, isActive, ...rest } = input;
  const chosen = await resolveSupplements(userId, supplementIds, supplements);

  // Typed as Prisma.PrismaPromise<unknown>[] (not `unknown[]`) because
  // $transaction's array-form overload requires exactly that element type --
  // caught by Railway's build, which has the real @prisma/client generated
  // types, not by this sandbox's or the device's stubbed client.
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  if (isActive) {
    ops.push(prisma.protocol.updateMany({ where: { userId, isActive: true }, data: { isActive: false } }));
  }
  ops.push(
    prisma.protocol.create({
      data: {
        userId,
        isActive: isActive ?? false,
        ...rest,
        supplements: { create: chosen.map(lineFor) },
      },
      include: PROTOCOL_INCLUDE,
    }),
  );

  const results = await prisma.$transaction(ops);
  return flattenProtocol(results[results.length - 1] as ProtocolRow);
}

export async function updateProtocol(
  id: string,
  userId: string,
  input: UpdateProtocolInput,
): Promise<ProtocolWithSupplements> {
  const { supplements, supplementIds, isActive, ...rest } = input;
  // Only touch the list when the client sent one (either form); an update that
  // leaves both out keeps the protocol's supplements as they are.
  const chosen =
    supplements !== undefined || supplementIds !== undefined
      ? await resolveSupplements(userId, supplementIds, supplements)
      : null;

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  if (isActive) {
    ops.push(
      prisma.protocol.updateMany({
        where: { userId, isActive: true, NOT: { id } },
        data: { isActive: false },
      }),
    );
  }
  if (chosen) {
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
        ...(chosen ? { supplements: { create: chosen.map(lineFor) } } : {}),
      },
      include: PROTOCOL_INCLUDE,
    }),
  );

  const results = await prisma.$transaction(ops);
  return flattenProtocol(results[results.length - 1] as ProtocolRow);
}

export async function deleteProtocol(id: string): Promise<void> {
  await prisma.protocol.delete({ where: { id } });
}
