import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  protocol: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  protocolSupplement: {
    deleteMany: vi.fn(),
  },
  supplement: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  // createProtocol/updateProtocol pass an array of already-invoked Prisma
  // call promises, matching real Prisma's `$transaction([...])` array form
  // (see profile.service.test.ts for the same convention).
  $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
};

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

const {
  listProtocols,
  getProtocolById,
  getActiveProtocol,
  createProtocol,
  updateProtocol,
  deleteProtocol,
  resolveSupplements,
  flattenProtocol,
  UnknownSupplementError,
} = await import('@/modules/protocols/protocols.service');

// What every protocol query asks Prisma for: lines joined with the user's own supplement.
const INCLUDE = { supplements: { include: { supplement: true }, orderBy: { createdAt: 'asc' } } };

const MAGNESIUM = { id: 's1', userId: 'u1', name: 'Magnesium', dosage: '400', unit: 'mg', frequency: 'DAILY', timing: 'EVENING' };
// A line stores only the link; the values live on the supplement.
const MAGNESIUM_LINE = { supplementId: 's1' };

const CREATE_INPUT = {
  name: 'Base building',
  isActive: false as boolean,
  supplements: [] as { name: string }[],
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
});

describe('listProtocols', () => {
  it('lists protocols scoped to the given userId, newest first, with supplements included', async () => {
    prismaMock.protocol.findMany.mockResolvedValue([{ id: 'p1' }]);

    const result = await listProtocols('u1');

    expect(prismaMock.protocol.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { createdAt: 'desc' },
      include: INCLUDE,
    });
    expect(result).toEqual([{ id: 'p1', supplements: [] }]);
  });
});

describe('getProtocolById', () => {
  it('returns the protocol with supplements when found', async () => {
    prismaMock.protocol.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1' });
    await expect(getProtocolById('p1')).resolves.toEqual({ id: 'p1', userId: 'u1', supplements: [] });
    expect(prismaMock.protocol.findUnique).toHaveBeenCalledWith({
      where: { id: 'p1' },
      include: INCLUDE,
    });
  });

  it('returns null when not found', async () => {
    prismaMock.protocol.findUnique.mockResolvedValue(null);
    await expect(getProtocolById('missing')).resolves.toBeNull();
  });
});

describe('getActiveProtocol', () => {
  it('finds the one active protocol scoped to userId', async () => {
    prismaMock.protocol.findFirst.mockResolvedValue({ id: 'p1', isActive: true });

    const result = await getActiveProtocol('u1');

    expect(prismaMock.protocol.findFirst).toHaveBeenCalledWith({
      where: { userId: 'u1', isActive: true },
      include: INCLUDE,
    });
    expect(result).toEqual({ id: 'p1', isActive: true, supplements: [] });
  });

  it('returns null when the user has no active protocol', async () => {
    prismaMock.protocol.findFirst.mockResolvedValue(null);
    await expect(getActiveProtocol('u1')).resolves.toBeNull();
  });
});

describe('createProtocol', () => {
  it('creates an inactive protocol without touching other rows', async () => {
    prismaMock.protocol.create.mockResolvedValue({ id: 'p1', userId: 'u1', ...CREATE_INPUT });

    const result = await createProtocol('u1', CREATE_INPUT);

    expect(prismaMock.protocol.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.protocol.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        isActive: false,
        name: 'Base building',
        supplements: { create: [] },
      },
      include: INCLUDE,
    });
    expect(result.id).toBe('p1');
  });

  it('demotes the user\'s other active protocols first when created as active', async () => {
    prismaMock.protocol.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.protocol.create.mockResolvedValue({ id: 'p2', userId: 'u1', isActive: true });

    await createProtocol('u1', { ...CREATE_INPUT, isActive: true });

    expect(prismaMock.protocol.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', isActive: true },
      data: { isActive: false },
    });
    expect(prismaMock.protocol.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: true }) }),
    );
  });

  it('links chosen supplements by id, copying nothing the client sent', async () => {
    prismaMock.supplement.findMany.mockResolvedValue([MAGNESIUM]);
    prismaMock.protocol.create.mockResolvedValue({ id: 'p1' });

    await createProtocol('u1', { ...CREATE_INPUT, supplementIds: ['s1'] } as never);

    expect(prismaMock.supplement.findMany).toHaveBeenCalledWith({ where: { id: { in: ['s1'] }, userId: 'u1' } });
    expect(prismaMock.protocol.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ supplements: { create: [MAGNESIUM_LINE] } }),
      include: INCLUDE,
    });
  });

  it('refuses a supplement that is not the caller\'s own', async () => {
    prismaMock.supplement.findMany.mockResolvedValue([]);

    await expect(createProtocol('u1', { ...CREATE_INPUT, supplementIds: ['someone-elses'] } as never)).rejects.toBeInstanceOf(
      UnknownSupplementError,
    );
    expect(prismaMock.protocol.create).not.toHaveBeenCalled();
  });

  it('maps inline lines (older app builds) onto the user\'s own list and ignores a client-supplied id', async () => {
    prismaMock.supplement.findFirst.mockResolvedValue(MAGNESIUM);
    prismaMock.protocol.create.mockResolvedValue({ id: 'p1' });

    await createProtocol('u1', {
      ...CREATE_INPUT,
      supplements: [{ id: 'should-be-ignored', name: 'magnesium', dosage: 400, unit: 'mg', frequency: 'DAILY', timing: 'EVENING' } as never],
    });

    expect(prismaMock.supplement.create).not.toHaveBeenCalled();
    expect(prismaMock.protocol.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ supplements: { create: [MAGNESIUM_LINE] } }),
      include: INCLUDE,
    });
  });
});

describe('resolveSupplements', () => {
  it('creates the supplement on the user\'s list when no existing one matches', async () => {
    prismaMock.supplement.findFirst.mockResolvedValue(null);
    prismaMock.supplement.create.mockResolvedValue({ id: 's9', name: 'Creatine' });

    const result = await resolveSupplements('u1', undefined, [{ name: 'Creatine', dosage: 5, unit: 'g' }]);

    expect(prismaMock.supplement.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        name: { equals: 'Creatine', mode: 'insensitive' },
        dosage: 5,
        unit: 'g',
        frequency: null,
        timing: null,
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(prismaMock.supplement.create).toHaveBeenCalledWith({
      data: { userId: 'u1', name: 'Creatine', dosage: 5, unit: 'g', frequency: null, timing: null },
    });
    expect(result).toEqual([{ id: 's9', name: 'Creatine' }]);
  });

  it('keeps order and drops duplicates across ids and inline lines', async () => {
    prismaMock.supplement.findMany.mockResolvedValue([MAGNESIUM, { id: 's2', name: 'Vitamin D' }]);
    prismaMock.supplement.findFirst.mockResolvedValue(MAGNESIUM);

    const result = await resolveSupplements('u1', ['s2', 's1', 's2'], [{ name: 'Magnesium' }]);

    expect(result.map((s) => s.id)).toEqual(['s2', 's1']);
  });

  it('returns an empty list for no input', async () => {
    await expect(resolveSupplements('u1', undefined, undefined)).resolves.toEqual([]);
  });
});

describe('flattenProtocol', () => {
  it('reports the linked supplement\'s values on each line, so editing the supplement edits every protocol', () => {
    const result = flattenProtocol({
      id: 'p1',
      supplements: [
        {
          id: 'l1',
          protocolId: 'p1',
          supplementId: 's1',
          supplement: MAGNESIUM,
        },
      ],
    } as never);

    expect(result.supplements[0]).toMatchObject({ id: 'l1', supplementId: 's1', name: 'Magnesium', dosage: '400', timing: 'EVENING' });
    expect(result.supplements[0]).not.toHaveProperty('supplement');
  });
});

describe('updateProtocol', () => {
  it('updates the protocol by id without touching other rows or supplements when neither changes', async () => {
    prismaMock.protocol.update.mockResolvedValue({ id: 'p1', name: 'Renamed' });

    const result = await updateProtocol('p1', 'u1', { name: 'Renamed' });

    expect(prismaMock.protocol.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.protocolSupplement.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.protocol.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { name: 'Renamed' },
      include: INCLUDE,
    });
    expect(result.name).toBe('Renamed');
  });

  it('demotes the user\'s other active protocols, excluding itself, when set active', async () => {
    prismaMock.protocol.update.mockResolvedValue({ id: 'p1', isActive: true });

    await updateProtocol('p1', 'u1', { isActive: true });

    expect(prismaMock.protocol.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', isActive: true, NOT: { id: 'p1' } },
      data: { isActive: false },
    });
    expect(prismaMock.protocol.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: true }) }),
    );
  });

  it('replaces the whole supplement list wholesale when supplementIds are provided', async () => {
    prismaMock.supplement.findMany.mockResolvedValue([MAGNESIUM]);
    prismaMock.protocol.update.mockResolvedValue({ id: 'p1' });

    await updateProtocol('p1', 'u1', { supplementIds: ['s1'] });

    expect(prismaMock.protocolSupplement.deleteMany).toHaveBeenCalledWith({
      where: { protocolId: 'p1' },
    });
    expect(prismaMock.protocol.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { supplements: { create: [MAGNESIUM_LINE] } },
      include: INCLUDE,
    });
  });

  it('clears the list when an empty one is sent, and still accepts the older inline form', async () => {
    prismaMock.protocol.update.mockResolvedValue({ id: 'p1' });
    await updateProtocol('p1', 'u1', { supplementIds: [] });
    expect(prismaMock.protocolSupplement.deleteMany).toHaveBeenCalledTimes(1);

    prismaMock.supplement.findFirst.mockResolvedValue(null);
    prismaMock.supplement.create.mockResolvedValue({ id: 's7', name: 'Omega-3', dosage: null, unit: null, frequency: null, timing: null });
    await updateProtocol('p1', 'u1', { supplements: [{ name: 'Omega-3' }] });
    expect(prismaMock.supplement.create).toHaveBeenCalledWith({
      data: { userId: 'u1', name: 'Omega-3', dosage: null, unit: null, frequency: null, timing: null },
    });
  });

  it('does not demote other protocols when isActive is explicitly set to false', async () => {
    prismaMock.protocol.update.mockResolvedValue({ id: 'p1', isActive: false });

    await updateProtocol('p1', 'u1', { isActive: false });

    expect(prismaMock.protocol.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.protocol.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { isActive: false },
      include: INCLUDE,
    });
  });
});

describe('deleteProtocol', () => {
  it('deletes the protocol by id', async () => {
    prismaMock.protocol.delete.mockResolvedValue({});
    await deleteProtocol('p1');
    expect(prismaMock.protocol.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });
});
