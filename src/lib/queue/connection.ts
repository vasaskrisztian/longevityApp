import IORedis from 'ioredis';

/**
 * Lazy singleton BullMQ/ioredis connection. `maxRetriesPerRequest: null` is
 * BullMQ's own documented requirement for any connection it's handed
 * (without it, a Queue/Worker's blocking commands can throw instead of
 * waiting). `lazyConnect: true` means constructing this client does NOT open
 * a socket — the first actual command (the first `queue.add()`/worker
 * start) does. That matters here specifically: this module is imported by
 * API routes (`app/api/integrations/oura/sync`) and by the OAuth callback
 * route, and Next.js may load route modules (dev server, build analysis)
 * without ever invoking them — with `lazyConnect: true`, that import alone
 * never attempts a Redis connection, so nothing breaks when no Redis is
 * reachable (e.g. this sandbox — see docs/phase-7-summary.md's Known
 * limitations).
 */
let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return connection;
}

/** Test-only escape hatch, mirroring provider-registry.ts's `_resetRegistryForTests`. */
export function _resetConnectionForTests(): void {
  connection = null;
}
