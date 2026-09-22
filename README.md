# Longevity App

Oura Ring–first health & wellness platform. See [`ARCHITECTURE.md`](./ARCHITECTURE.md)
for the full system design — this README is just the local dev quick-start.

## Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL + Redis)

## Setup

```bash
cp .env.example .env.local
# fill in AUTH_SECRET, TOKEN_ENCRYPTION_KEY (32 random bytes, base64),
# and DATABASE_URL if you're not using the docker-compose defaults

docker compose up -d          # PostgreSQL + Redis
npm install
npm run prisma:migrate        # creates the schema
npm run prisma:seed           # admin@example.com / demo@example.com
npm run dev
```

Set `OURA_MOCK_MODE=true` in `.env.local` to develop without a real Oura
Developer account — see `ARCHITECTURE.md` §11 and the mock adapter added in
Phase 5.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (includes the layering rules in `.eslintrc.json`) |
| `npm run prisma:migrate` | Apply Prisma migrations locally |
| `npm run prisma:studio` | Browse the database |
| `npm run test:unit` / `test:integration` | Vitest |
| `npm run test:e2e` | Playwright |
| `npm run mcp:server` | Start the local MCP server (`MCP_USER_ID` required) |

## Deployment / CI-CD

GitHub Actions runs lint/typecheck/tests/build on every push (see
`.github/workflows/ci.yml`); Railway deploys a web service and a worker
service from the same `Dockerfile` on every push to `main`. Full one-time
setup steps: [`docs/ci-cd-setup.md`](./docs/ci-cd-setup.md).

## MCP / AI-ready layer

Five read-only, per-user health tools exposed to an MCP client (Claude
Desktop, Claude Code) over stdio — see
[`docs/mcp-server-setup.md`](./docs/mcp-server-setup.md) for how to run it
and [`docs/phase-10-summary.md`](./docs/phase-10-summary.md) for the design.

## Project status

Phase 1 (this commit): Next.js + TypeScript strict + Tailwind + Prisma +
Auth.js foundation, central authorization helpers, base navigation shell.
No Oura integration yet — that starts in Phase 3/4. See `ARCHITECTURE.md`
§12 for the full phase plan.
