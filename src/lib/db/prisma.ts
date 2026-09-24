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

const adapter = new PrismaPg(pool);

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
