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
} = await import('@/modules/protocols/protocols.service');

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
      include: { supplements: true },
    });
    expect(result).toEqual([{ id: 'p1' }]);
  });
});

describe('getProtocolById', () => {
  it('returns the protocol with supplements when found', async () => {
    prismaMock.protocol.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1' });
    await expect(getProtocolById('p1')).resolves.toEqual({ id: 'p1', userId: 'u1' });
    expect(prismaMock.protocol.findUnique).toHaveBeenCalledWith({
      where: { id: 'p1' },
      include: { supplements: true },
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
      include: { supplements: true },
    });
    expect(result).toEqual({ id: 'p1', isActive: true });
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
      include: { supplements: true },
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

  it('strips any client-supplied id off nested supplements before creating', async () => {
    prismaMock.protocol.create.mockResolvedValue({ id: 'p1' });

    await createProtocol('u1', {
      ...CREATE_INPUT,
      supplements: [{ id: 'should-be-stripped', name: 'Vitamin D3' } as never],
    });

    expect(prismaMock.protocol.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        supplements: { create: [{ name: 'Vitamin D3' }] },
      }),
      include: { supplements: true },
    });
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
      include: { supplements: true },
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

  it('replaces the whole supplement list wholesale when supplements are provided', async () => {
    prismaMock.protocol.update.mockResolvedValue({ id: 'p1' });

    await updateProtocol('p1', 'u1', { supplements: [{ name: 'Omega-3' }] });

    expect(prismaMock.protocolSupplement.deleteMany).toHaveBeenCalledWith({
      where: { protocolId: 'p1' },
    });
    expect(prismaMock.protocol.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { supplements: { create: [{ name: 'Omega-3' }] } },
      include: { supplements: true },
    });
  });

  it('does not demote other protocols when isActive is explicitly set to false', async () => {
    prismaMock.protocol.update.mockResolvedValue({ id: 'p1', isActive: false });

    await updateProtocol('p1', 'u1', { isActive: false });

    expect(prismaMock.protocol.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.protocol.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { isActive: false },
      include: { supplements: true },
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
