import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  goal: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

const { listGoals, getGoalById, createGoal, updateGoal, deleteGoal } = await import(
  '@/modules/goals/goals.service'
);

const CREATE_INPUT = {
  type: 'WEIGHT_LOSS' as const,
  name: 'Lose 5kg',
  status: 'ACTIVE' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listGoals', () => {
  it('lists goals scoped to the given userId, newest first', async () => {
    prismaMock.goal.findMany.mockResolvedValue([{ id: 'g1' }]);

    const result = await listGoals('u1');

    expect(prismaMock.goal.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([{ id: 'g1' }]);
  });
});

describe('getGoalById', () => {
  it('returns the goal when found', async () => {
    prismaMock.goal.findUnique.mockResolvedValue({ id: 'g1', userId: 'u1' });
    await expect(getGoalById('g1')).resolves.toEqual({ id: 'g1', userId: 'u1' });
    expect(prismaMock.goal.findUnique).toHaveBeenCalledWith({ where: { id: 'g1' } });
  });

  it('returns null when not found', async () => {
    prismaMock.goal.findUnique.mockResolvedValue(null);
    await expect(getGoalById('missing')).resolves.toBeNull();
  });
});

describe('createGoal', () => {
  it('creates a goal scoped to userId with the given fields', async () => {
    prismaMock.goal.create.mockResolvedValue({ id: 'g1', userId: 'u1', ...CREATE_INPUT });

    const result = await createGoal('u1', CREATE_INPUT);

    expect(prismaMock.goal.create).toHaveBeenCalledWith({
      data: { userId: 'u1', ...CREATE_INPUT },
    });
    expect(result.id).toBe('g1');
  });
});

describe('updateGoal', () => {
  it('updates the goal by id with the given fields', async () => {
    prismaMock.goal.update.mockResolvedValue({ id: 'g1', status: 'PAUSED' });

    const result = await updateGoal('g1', { status: 'PAUSED' });

    expect(prismaMock.goal.update).toHaveBeenCalledWith({
      where: { id: 'g1' },
      data: { status: 'PAUSED' },
    });
    expect(result.status).toBe('PAUSED');
  });
});

describe('deleteGoal', () => {
  it('deletes the goal by id', async () => {
    prismaMock.goal.delete.mockResolvedValue({});
    await deleteGoal('g1');
    expect(prismaMock.goal.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
  });
});
