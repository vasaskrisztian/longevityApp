# CI/CD setup — GitHub Actions (CI) + Railway (CD)

Not one of ARCHITECTURE.md §12's phased-delivery items — a cross-cutting
infrastructure request so the app can be tried out continuously on an
external host instead of only in this dev container. Chosen stack, per the
project's own decision: **GitHub** for source + CI, **Railway** for hosting
(web service + worker service + managed Postgres + managed Redis), deploying
automatically on every push to `main`.

## Why Railway (not Vercel)

ARCHITECTURE.md §1.4 requires "one deployable Next.js app + one worker
process" — Phase 7 built a real BullMQ worker (`npm run worker`) that has to
run continuously, not on-demand. Vercel's serverless model has no place to
run that process. Railway (like Render/Fly.io) runs Docker containers as
long-lived services, so the same image can back two services — a "web" one
and a "worker" one — sharing one Postgres and one Redis instance. That's
what this setup builds.

## What this phase added

- **`Dockerfile`** — single image (Node 20 Alpine), used by both Railway
  services. Builds the Next.js app (`npm run build`) and, on boot, runs
  `npx prisma migrate deploy && npm run start`. Deliberately a single stage,
  not an optimized multi-stage/`output: standalone` build — simplicity over
  image size for a first pass; see "Optional next steps" below.
- **`.dockerignore`** — keeps `node_modules`, `.next`, docs, tests, and the
  Windows-desktop `Claude outputs/` scratch folder out of the build context.
- **`railway.json`** — tells Railway to build with the Dockerfile and
  healthcheck `/api/health` (new: `src/app/api/health/route.ts`, a
  dependency-free liveness endpoint — not behind auth, not touching
  Prisma/Redis, so a DB or Redis blip doesn't also fail the container's own
  healthcheck and trigger a restart loop).
- **`.github/workflows/ci.yml`** — on every push/PR to `main`: install,
  `prisma generate`, typecheck, lint, `test:coverage` (555 tests), and a full
  `next build`. This is the safety net Railway's own deploy doesn't check —
  see "How the pieces connect" below for why the two aren't wired together
  more tightly in this first pass.
- **`.gitignore`** — added `Claude outputs/` (the device-bridge scratch
  folder created for zip deliveries — never part of the app).

## One-time setup — do these once, in order

### 1. Generate the first Prisma migration (do this locally, not in this
   sandbox)

`prisma/migrations/` doesn't exist yet in this repo — every phase so far
mocked Prisma in tests because this cloud dev container has no reachable
Postgres, so `prisma migrate dev` has never actually been run against a
real database. Railway's `prisma migrate deploy` only *applies* committed
migrations — it can't generate the first one. On your own machine, with
`docker-compose.yml`'s Postgres running:

```
docker compose up -d postgres
npm run prisma:migrate -- --name init
```

Commit the resulting `prisma/migrations/` folder. This is a required,
one-time step before the first real deploy — Railway's Postgres will start
empty otherwise.

### 2. Push this repo to GitHub

```
git init
git add .
git commit -m "Initial commit"
```

Create an empty repository on GitHub (no README/license — this repo
already has one), then:

```
git remote add origin https://github.com/<your-account>/<repo-name>.git
git branch -M main
git push -u origin main
```

CI (`.github/workflows/ci.yml`) starts running automatically from this
first push — no extra setup needed on GitHub's side.

### 3. Create the Railway project

1. New Project → **Deploy from GitHub repo** → pick this repo.
2. **Add a Postgres plugin** and a **Redis plugin** to the project (Railway
   provisions both and injects their connection variables automatically as
   `DATABASE_URL`/similar — check the exact variable name Railway assigns
   and reference it, e.g. `${{Postgres.DATABASE_URL}}`, in the web/worker
   services' own `DATABASE_URL`/`REDIS_URL` variables).
3. The first service Railway creates from the repo is your **web** service.
   Rename it if you like. It will pick up `railway.json` automatically
   (Dockerfile build, `/api/health` healthcheck).
4. **Add a second service** from the *same* GitHub repo for the **worker**.
   In that service's Settings → Deploy, override the **Start Command** to:
   ```
   npm run worker
   ```
   (This replaces the Dockerfile's default CMD, which is
   `npx prisma migrate deploy && npm run start` — only the web service
   should run migrations, so the worker's overridden command skips that
   entirely.) Also disable/clear that service's healthcheck path — it has
   no HTTP server, so `/api/health` doesn't apply to it.
5. Set environment variables on **both** services (`.env.example` lists
   every name this app reads):
   - `DATABASE_URL` — reference the Postgres plugin's variable.
   - `REDIS_URL` — reference the Redis plugin's variable.
   - `AUTH_SECRET` — generate with `openssl rand -base64 32`.
   - `TOKEN_ENCRYPTION_KEY` — generate with `openssl rand -base64 32`
     (must decode to exactly 32 bytes — see
     `src/lib/encryption/encryption.service.ts`).
   - `APP_URL` — the web service's public Railway URL (Railway assigns one
     once you expose the web service; you can add a custom domain later).
   - `OURA_CLIENT_ID` / `OURA_CLIENT_SECRET` / `OURA_REDIRECT_URI` — from
     your Oura API application; the redirect URI must be
     `<APP_URL>/api/integrations/oura/callback`, registered with Oura too.
   - `OURA_MOCK_MODE` — `true` if you want to try the app out before real
     Oura credentials exist; `false` for real Oura data.
   - `SENTRY_DSN` — optional, leave unset if you don't use Sentry yet.
6. Expose the web service publicly (Railway → web service → Settings →
   Networking → Generate Domain).

### 4. Every push to `main` from here on

GitHub Actions runs the full check suite; independently, Railway's GitHub
integration rebuilds and redeploys both services from the same push. Watch
the Railway dashboard's deploy logs for the first deploy in particular — the
`prisma migrate deploy` step in the web service's boot command will do the
real schema-creation work you tested with `npm run prisma:migrate` locally.

## How the pieces connect (and what's deliberately not automated yet)

CI and CD run **independently** in this first pass: GitHub Actions checks
the code, Railway deploys the code, but a red CI run does not currently
block Railway's deploy — they're two separate triggers off the same push.
For a project this size that's a reasonable trade for simplicity, but if you
later want deploys gated on CI passing, the standard upgrade is: turn off
Railway's automatic GitHub deploy, generate a Railway API token, store it as
a GitHub Actions secret (`RAILWAY_TOKEN`), and add a `deploy` job to
`ci.yml` that only runs `needs: ci` and calls the Railway CLI
(`railway up`) after the checks pass.

## Known limitations

- **No live Postgres/Redis in the sandbox this was built in** — every file
  above is written and reasoned about against that constraint (the same one
  documented in every phase's summary), but none of it has been run against
  a real Railway deployment from this session. The one-time migration step
  above has to happen on a machine with real Postgres access (yours).
- **The `Dockerfile` is intentionally simple, not size-optimized** — no
  multi-stage build, no `output: 'standalone'`. Fine for a first "try it out
  continuously" pass; worth revisiting once deploy time or image size
  actually matters.
- **CI does not gate Railway's deploy** (see above) — a deliberate,
  documented simplification for a first "alap" pipeline, not an oversight.
- **This repo has no git history yet** — step 2 above is the very first
  commit; there was nothing to preserve.
