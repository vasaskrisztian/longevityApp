// Precompiles the worker entry point (src/jobs/worker-process.ts) to a
// single, plain-JavaScript ESM file at dist-worker/worker-process.mjs.
//
// WHY THIS EXISTS: the worker service's Railway start command used to be
// `npm run worker` (= `tsx src/jobs/worker-process.ts`) — tsx JIT-transpiles
// TypeScript on the fly via a persistent, separate `esbuild --service`
// helper process (visible as its own PID in `ps aux` inside the worker
// container). That's a fine tool for local development, but it's an unusual
// thing to have in a production runtime path, and it was the one concrete
// architectural difference between "code that has never shown the sync
// write path's freeze" (the web app, which runs fully precompiled output
// via `next build`/`next start`, and a bare `node someScript.js`
// reproduction) and "code that reproduces the freeze 100% of the time, at
// the exact same point, no matter how many times the surrounding SQL/pool
// code was rewritten" (the tsx-run worker). Nothing before this had ever
// removed tsx/esbuild-service from the worker's runtime path to see whether
// that alone changes anything — this script does exactly that, with no
// change to any application code.
//
// This intentionally does NOT bundle node_modules (`packages: 'external'`):
// only this repo's own source files (resolved through the `@/*` tsconfig
// path alias) get inlined into the single output file. Every npm dependency
// (pg, bullmq, ioredis, @prisma/client, argon2's native addon, etc.) is
// still loaded normally from node_modules at runtime, exactly as it is
// today under tsx — this changes *how the TypeScript gets turned into JS*,
// not how dependencies are resolved.
//
// Output is `.mjs` (not `.js`) so Node always runs it as ESM regardless of
// package.json's "type" field — worker-process.ts's own isMainModule check
// (`import.meta.url` vs `pathToFileURL(process.argv[1])`) depends on that.

import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('dist-worker', { recursive: true });

await build({
  entryPoints: ['src/jobs/worker-process.ts'],
  outfile: 'dist-worker/worker-process.mjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  packages: 'external',
  tsconfig: 'tsconfig.json',
  sourcemap: true,
  logLevel: 'info',
});
