import { describe, it, expect, vi, beforeEach } from 'vitest';

const IORedisMock = vi.fn().mockImplementation(function (this: unknown) {
  return this;
});
vi.mock('ioredis', () => ({ default: IORedisMock }));

const { getRedisConnection, _resetConnectionForTests } = await import('@/lib/queue/connection');

beforeEach(() => {
  IORedisMock.mockClear();
  _resetConnectionForTests();
  delete process.env.REDIS_URL;
});

describe('getRedisConnection', () => {
  it('constructs with lazyConnect true and maxRetriesPerRequest null — BullMQ requires the latter, and lazyConnect keeps a bare import from opening a socket', () => {
    getRedisConnection();

    expect(IORedisMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ maxRetriesPerRequest: null, lazyConnect: true }),
    );
  });

  it('uses REDIS_URL when set', () => {
    process.env.REDIS_URL = 'redis://example.com:6380';

    getRedisConnection();

    expect(IORedisMock).toHaveBeenCalledWith('redis://example.com:6380', expect.anything());
  });

  it('falls back to localhost when REDIS_URL is unset', () => {
    getRedisConnection();

    expect(IORedisMock).toHaveBeenCalledWith('redis://localhost:6379', expect.anything());
  });

  it('is a singleton — a second call never constructs a second client', () => {
    const first = getRedisConnection();
    const second = getRedisConnection();

    expect(first).toBe(second);
    expect(IORedisMock).toHaveBeenCalledTimes(1);
  });

  it('_resetConnectionForTests forces the next call to construct a fresh client', () => {
    getRedisConnection();
    _resetConnectionForTests();
    getRedisConnection();

    expect(IORedisMock).toHaveBeenCalledTimes(2);
  });
});
