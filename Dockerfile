# Single image, shared by both Railway services this app needs
# (ARCHITECTURE.md §1.4: "one deployable Next.js app + one worker process").
# The "web" service runs this image's default CMD as-is; the "worker"
# service overrides its Start Command to `npm run worker:prod` in the
# Railway dashboard — see docs/ci-cd-setup.md. Deliberately a single, simple
# stage (not a multi-stage/standalone-output build) so a first CI/CD pass
# stays easy to reason about; trimming the image down is a fine later
# optimization.
#
# worker:prod runs precompiled JS (dist-worker/worker-process.mjs, built
# below by `npm run build:worker`), NOT `npm run worker` (tsx's on-the-fly
# TypeScript execution, which spawns its own persistent `esbuild --service`
# helper process). See scripts/build-worker.mjs's top comment for why: tsx
# was the one architectural difference between the worker (which reproduced
# a long-standing sync-write-path freeze 100% of the time) and everything
# else in this app (which never did), so the worker's runtime path no
# longer goes through it. `npm run worker` (tsx) is kept only for local
# development, where its file-watching/fast-refresh is actually useful.

FROM node:20-alpine

# Prisma's query engine needs OpenSSL on Alpine; libc6-compat covers a few
# native-addon deps (e.g. argon2) that assume glibc.
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Reads only prisma/schema.prisma to generate the client — no DATABASE_URL
# connectivity needed at build time.
RUN npx prisma generate

RUN npm run build
RUN npm run build:worker

ENV NODE_ENV=production
EXPOSE 3000

# `prisma migrate deploy` applies committed migrations and is safe to run on
# every boot (a no-op once the DB is up to date). Only the "web" service's
# CMD should run this — the "worker" service's overridden start command
# (`npm run worker:prod`) skips it, so two processes never race migrations
# on a simultaneous deploy.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
