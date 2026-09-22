import { NextResponse } from 'next/server';

/**
 * Liveness endpoint for the hosting platform's healthcheck (Railway, load
 * balancers, uptime monitors) — not covered by middleware's protected-route
 * matcher (src/middleware.ts), so it's reachable with no auth.
 *
 * Deliberately does not touch Prisma/Redis: a healthcheck should answer "is
 * this process up and serving requests", not "is every downstream
 * dependency reachable" — the latter would turn a transient DB blip into a
 * full outage via failed healthchecks and a restart loop.
 */
export async function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
