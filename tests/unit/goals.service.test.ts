import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  goal: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  protocol: {
    findFirst: vi.fn(),
  },
};

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

const { listGoals, getGoalById, createGoal, updateGoal, deleteGoal, UnknownProtocolError } = await import(
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
  it('puts a goal sent without a protocol under the active protocol (older app builds)', async () => {
    prismaMock.protocol.findFirst.mockResolvedValue({ id: 'p-active' });
    prismaMock.goal.create.mockResolvedValue({ id: 'g1', userId: 'u1', ...CREATE_INPUT });

    const result = await createGoal('u1', CREATE_INPUT);

    expect(prismaMock.protocol.findFirst).toHaveBeenCalledWith({ where: { userId: 'u1', isActive: true }, select: { id: true } });
    expect(prismaMock.goal.create).toHaveBeenCalledWith({
      data: { userId: 'u1', ...CREATE_INPUT, protocolId: 'p-active' },
    });
    expect(result.id).toBe('g1');
  });

  it('leaves the goal without a protocol when there is no active one', async () => {
    prismaMock.protocol.findFirst.mockResolvedValue(null);
    prismaMock.goal.create.mockResolvedValue({ id: 'g1' });

    await createGoal('u1', CREATE_INPUT);

    expect(prismaMock.goal.create).toHaveBeenCalledWith({ data: { userId: 'u1', ...CREATE_INPUT, protocolId: null } });
  });

  it('honours an explicit null (no protocol) without looking for the active one', async () => {
    prismaMock.goal.create.mockResolvedValue({ id: 'g1' });

    await createGoal('u1', { ...CREATE_INPUT, protocolId: null });

    expect(prismaMock.protocol.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.goal.create).toHaveBeenCalledWith({ data: { userId: 'u1', ...CREATE_INPUT, protocolId: null } });
  });

  it('attaches to a chosen protocol only if it is the user\'s own', async () => {
    prismaMock.protocol.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prismaMock.goal.create.mockResolvedValue({ id: 'g1' });

    await createGoal('u1', { ...CREATE_INPUT, protocolId: 'p1' });

    expect(prismaMock.protocol.findFirst).toHaveBeenCalledWith({ where: { id: 'p1', userId: 'u1' }, select: { id: true } });
    expect(prismaMock.goal.create).toHaveBeenCalledWith({ data: { userId: 'u1', ...CREATE_INPUT, protocolId: 'p1' } });

    prismaMock.protocol.findFirst.mockResolvedValueOnce(null);
    await expect(createGoal('u1', { ...CREATE_INPUT, protocolId: 'foreign' })).rejects.toBeInstanceOf(UnknownProtocolError);
  });
});

describe('updateGoal', () => {
  it('updates the goal by id with the given fields', async () => {
    prismaMock.goal.update.mockResolvedValue({ id: 'g1', status: 'PAUSED' });

    const result = await updateGoal('g1', 'u1', { status: 'PAUSED' });

    expect(prismaMock.protocol.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.goal.update).toHaveBeenCalledWith({
      where: { id: 'g1' },
      data: { status: 'PAUSED' },
    });
    expect(result.status).toBe('PAUSED');
  });

  it('checks a new protocol belongs to the owner, and lets a goal be detached with null', async () => {
    prismaMock.goal.update.mockResolvedValue({ id: 'g1' });

    prismaMock.protocol.findFirst.mockResolvedValueOnce(null);
    await expect(updateGoal('g1', 'u1', { protocolId: 'foreign' })).rejects.toBeInstanceOf(UnknownProtocolError);
    expect(prismaMock.goal.update).not.toHaveBeenCalled();

    await updateGoal('g1', 'u1', { protocolId: null });
    expect(prismaMock.goal.update).toHaveBeenCalledWith({ where: { id: 'g1' }, data: { protocolId: null } });
  });
});

describe('deleteGoal', () => {
  it('deletes the goal by id', async () => {
    prismaMock.goal.delete.mockResolvedValue({});
    await deleteGoal('g1');
    expect(prismaMock.goal.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
  });
});
