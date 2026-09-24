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
 *
 * UPDATE — the adapter switch above did NOT fix the sync write path: it
 * kept hanging forever at the exact same point even after switching
 * storeRawRecords to bypass Prisma Client entirely and issue hand-written
 * SQL straight through node-postgres (see raw-record.service.ts). Live
 * diagnosis eventually isolated why: `dbPool` below and the `pool` handed
 * to `PrismaPg` used to be the SAME `pg.Pool` instance. A manual
 * reproduction — a brand-new, independent `pg.Pool` in the very same
 * container, running the exact query storeRawRecords issues — returned in
 * well under 100ms every time, which rules out Postgres, the network, and
 * the query shape. What's left is the shared pool object itself: Prisma
 * Client / @prisma/adapter-pg always runs at least one query
 * (ensureFreshAccessToken's read of wearable_connections) immediately
 * before storeRawRecords' first raw query in the same job, and both used
 * to go through the identical Pool. @prisma/adapter-pg manages its own
 * connection checkout/release bookkeeping on top of whatever pool it's
 * given; sharing that pool with unrelated direct `.query()` calls from
 * other code is an unusual and fragile pattern; if the adapter ever
 * leaves that shared pool's bookkeeping thinking a slot is checked out
 * when it isn't (or vice versa), a later direct `dbPool.query()` call can
 * end up queued forever behind a slot that will never free — with zero
 * trace in Postgres itself, exactly the symptom reproduced live, and
 * exactly the class of hang this file's `pool.on('error', ...)` listener
 * further down was already trying to guard against.
 *
 * Fix: two independent `pg.Pool` instances, same connection settings,
 * never shared. `prismaPool` belongs to Prisma Client / adapter-pg only;
 * `dbPool` belongs to hand-written SQL only (raw-record.service.ts and
 * anything else that needs to bypass Prisma). Neither can leave the other
 * in a bad state, whatever either one's internal bookkeeping does.
 */

declare global {
  // eslint-disable-next-line no-var
  var __prismaPool__: Pool | undefined;
  // eslint-disable-next-line no-var
  var __dbPool__: Pool | undefined;
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

function createPool(): Pool {
  return new Pool({
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
}

// Prisma Client / @prisma/adapter-pg's own pool. Nothing outside this file
// and the PrismaClient constructor below should ever touch it directly.
const prismaPool: Pool =
  globalThis.__prismaPool__ ??
  createPool();

// A second, fully independent pool for hand-written SQL that bypasses
// Prisma Client (see raw-record.service.ts's comment for why that's
// necessary on the sync write path). Deliberately NOT the same object as
// prismaPool — see this file's top comment for why that used to be a bug.
const dbPoolInstance: Pool = globalThis.__dbPool__ ?? createPool();

function attachIdleErrorLogger(pool: Pool, label: string): void {
  // node-postgres's own docs are explicit about this: "the pool will emit
  // an error event if a client emits an error event unexpectedly... you
  // should register a listener on the pool to catch these errors".
  // Without this listener, a client that errors while sitting idle in the
  // pool (e.g. its TCP connection is silently reset by Railway's internal
  // networking, or Postgres itself closes it) can leave the pool's own
  // bookkeeping thinking a slot is still in use when the underlying
  // connection is already gone — and stops Node from crashing the whole
  // process on the unhandled 'error' event, which pg's docs also warn
  // about. Labelled per-pool now that there are two, so a Railway log line
  // says which one recovered.
  pool.on('error', (err) => {
    // eslint-disable-next-line no-console -- deliberately not routed
    // through the app's structured logger: this can fire outside any
    // request/job context.
    console.error(`[pg pool:${label}] idle client error (pool continues; see prisma.ts comment)`, err);
  });
}

attachIdleErrorLogger(prismaPool, 'prisma');
attachIdleErrorLogger(dbPoolInstance, 'raw');

const adapter = new PrismaPg(prismaPool);

// Exported so a hot path can bypass Prisma Client / @prisma/adapter-pg
// entirely and talk to Postgres directly when that's warranted — see
// raw-record.service.ts's comment for why that turned out to be
// necessary for the sync write path. Backed by its own Pool (see top
// comment) — never shared with Prisma's.
export const dbPool: Pool = dbPoolInstance;

export const prisma: PrismaClient =
  globalThis.__prisma__ ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prismaPool__ = prismaPool;
  globalThis.__dbPool__ = dbPoolInstance;
  globalThis.__prisma__ = prisma;
}
