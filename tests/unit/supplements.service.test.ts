import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  supplement: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

const {
  listSupplements,
  getSupplementById,
  createSupplement,
  updateSupplement,
  deleteSupplement,
} = await import('@/modules/supplements/supplements.service');

const CREATE_INPUT = {
  name: 'Vitamin D3',
  dosage: 2000,
  unit: 'IU',
  frequency: 'DAILY' as const,
  timing: 'MORNING' as const,
  active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listSupplements', () => {
  it('lists supplements scoped to the given userId, newest first', async () => {
    prismaMock.supplement.findMany.mockResolvedValue([{ id: 's1' }]);

    const result = await listSupplements('u1');

    expect(prismaMock.supplement.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([{ id: 's1' }]);
  });
});

describe('getSupplementById', () => {
  it('returns the supplement when found', async () => {
    prismaMock.supplement.findUnique.mockResolvedValue({ id: 's1', userId: 'u1' });
    await expect(getSupplementById('s1')).resolves.toEqual({ id: 's1', userId: 'u1' });
    expect(prismaMock.supplement.findUnique).toHaveBeenCalledWith({ where: { id: 's1' } });
  });

  it('returns null when not found', async () => {
    prismaMock.supplement.findUnique.mockResolvedValue(null);
    await expect(getSupplementById('missing')).resolves.toBeNull();
  });
});

describe('createSupplement', () => {
  it('creates a supplement scoped to userId with the given fields', async () => {
    prismaMock.supplement.create.mockResolvedValue({ id: 's1', userId: 'u1', ...CREATE_INPUT });

    const result = await createSupplement('u1', CREATE_INPUT);

    expect(prismaMock.supplement.create).toHaveBeenCalledWith({
      data: { userId: 'u1', ...CREATE_INPUT },
    });
    expect(result.id).toBe('s1');
  });
});

describe('updateSupplement', () => {
  it('updates the supplement by id with the given fields', async () => {
    prismaMock.supplement.update.mockResolvedValue({ id: 's1', dosage: 500 });

    const result = await updateSupplement('s1', { dosage: 500 });

    expect(prismaMock.supplement.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { dosage: 500 },
    });
    expect(result.dosage).toBe(500);
  });
});

describe('deleteSupplement', () => {
  it('deletes the supplement by id', async () => {
    prismaMock.supplement.delete.mockResolvedValue({});
    await deleteSupplement('s1');
    expect(prismaMock.supplement.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
  });
});
