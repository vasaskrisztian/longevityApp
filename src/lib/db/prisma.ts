import { PrismaClient } from '@prisma/client';

// Standard Next.js-safe Prisma singleton: avoids exhausting the DB connection
// pool from hot-reloaded route handlers in development.
declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma__ = prisma;
}
