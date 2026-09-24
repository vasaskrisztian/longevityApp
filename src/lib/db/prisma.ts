import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';

/**
 * Driver adapter (node-postgres) instead of Prisma's bundled Rust query
 * engine — see schema.prisma's `previewFeatures = ["driverAdapters"]`
 * comment for the full story. In short: a production sync job (and,
 * separately, ordinary read queries from this same web app) were observed
 * hanging forever inside a DB call, with Postgres's own pg_stat_activity
 * showing the connection already `idle` (i.e. Postgres had already
 * answered) — the response just never made it back out of the engine to
 * Node. That hang appeared to freeze the entire event loop (even a plain
 * `setTimeout`-based watchdog never fired), which points at something
 * blocking inside the engine's native layer rather than an ordinary stuck
 * Promise. Handing all socket I/O to `pg` — which talks to Postgres over
 * plain non-blocking Node sockets, the same as everything else in this
 * app — removes that whole failure class, and lets us set real, enforced
 * timeouts (`statement_timeout`/`query_timeout`) and TCP keepalive
 * ourselves instead of hoping a DATABASE_URL query param reaches wherever
 * the engine got stuck (adding `connect_timeout`/`socket_timeout` to the
 * connection string did not fix the hang).
 */

declare global {
  // eslint-disable-next-line no-var
  var __prismaPool__: Pool | undefined;
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

const pool: Pool =
  globalThis.__prismaPool__ ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Detect a silently-dead connection at the TCP level instead of
    // waiting on it forever — this is the piece a bare DATABASE_URL query
    // param couldn't give us with the old Rust-engine connector.
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    // Belt-and-braces query-level timeouts (ms), enforced by `pg` itself:
    // a hung query is killed and its promise rejects instead of hanging.
    statement_timeout: 20_000,
    query_timeout: 20_000,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });

// node-postgres's own docs are explicit about this: "the pool will emit an
// error event if a client emits an error event unexpectedly... you should
// register a listener on the pool to catch these errors". Without this
// listener, a client that errors while sitting idle in the pool (e.g. its
// TCP connection is silently reset by Railway's internal networking, or
// Postgres itself closes it) can leave the pool's own bookkeeping thinking
// a slot is still in use when the underlying connection is already gone.
// The pool then has no free client to hand out and — critically — `pg`
// has no default timeout for *waiting for a client to free up* (only for
// establishing a brand-new one, via connectionTimeoutMillis below): a
// `pool.query()` call queued behind a phantom slot like that waits
// forever, with nothing ever reaching Postgres. That failure signature —
// a hang with zero corresponding rows in pg_stat_activity, no pg-level
// timeout ever firing, sequential vs. concurrent making no difference,
// Prisma vs. raw `pg` making no difference — is exactly what was
// reproduced live, repeatedly, on the sync write path. This listener
// doesn't change query behavior; it just stops a dead idle client from
// silently going unaccounted-for (and stops Node from crashing the whole
// process on the unhandled 'error' event, which pg's docs also warn about).
pool.on('error', (err) => {
  // eslint-disable-next-line no-console -- deliberately not routed through
  // the app's structured logger: this can fire outside any request/job
  // context, and the point is a bare, always-visible signal in Railway's
  // logs that the pool just recovered from a dead idle connection.
  console.error('[pg pool] idle client error (pool continues; see prisma.ts comment)', err);
});

const adapter = new PrismaPg(pool);

// Exported so a hot path can bypass Prisma Client / @prisma/adapter-pg
// entirely and talk to Postgres directly when that's warranted — see
// raw-record.service.ts's comment for why that turned out to be necessary
// for the sync write path.
export const dbPool: Pool = pool;

export const prisma: PrismaClient =
  globalThis.__prisma__ ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prismaPool__ = pool;
  globalThis.__prisma__ = prisma;
}
