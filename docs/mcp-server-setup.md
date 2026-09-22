# Running the MCP server

This is the local/stdio MCP server ARCHITECTURE.md §9 describes, shipped in
Phase 10 (see `docs/phase-10-summary.md` for the design decisions). It
exposes five read-only, per-user health tools to an MCP client such as
Claude Desktop or Claude Code — never a caller-supplied user id, never
Oura's OAuth tokens, never anything under `lib/encryption/**`.

## 1. Find your user id

The tools operate on exactly one user, fixed for the lifetime of the
process. Find your `User.id` however you already look up ids in this app
(e.g. `psql` against your own database, or the admin user list if you're an
admin) — this is the app's internal user id, not your email.

## 2. Set the required environment variables

The server needs everything the rest of the app needs to read
`DailyHealthMetric` rows (`DATABASE_URL`), plus one MCP-specific variable:

```
DATABASE_URL=postgresql://...   # same as the rest of the app
MCP_USER_ID=<your User.id>      # required — the server refuses to start without it
```

Missing `MCP_USER_ID` fails fast with a clear `McpConfigurationError`
naming the variable, the same fail-loudly pattern
`TOKEN_ENCRYPTION_KEY` already uses elsewhere in this app — it is never
silently defaulted.

## 3. Run it

```
npm run mcp:server
```

This starts an `McpServer` over stdio and logs `mcp_server_started` naming
all five registered tools once connected.

## 4. Point an MCP client at it

A typical Claude Desktop/Claude Code MCP config entry:

```json
{
  "mcpServers": {
    "longevity-health": {
      "command": "npm",
      "args": ["run", "mcp:server"],
      "cwd": "/absolute/path/to/longevity-app",
      "env": {
        "DATABASE_URL": "postgresql://...",
        "MCP_USER_ID": "<your User.id>"
      }
    }
  }
}
```

## What the five tools return

- `get_user_daily_health` — the latest daily snapshot (falls back to the
  most recent day with data if today hasn't synced yet).
- `get_user_sleep_trend` / `get_user_readiness_trend` /
  `get_user_activity_trend` — each takes an optional `rangeDays` (`7` or
  `30`, default `7`) and returns one point per calendar day over that
  window. As of this phase all three return the same underlying metric set
  (see `docs/phase-10-summary.md`'s Known limitations) — they're kept as
  separate tools because they're separate questions a model may ask, even
  though today's answer is the same data.
- `get_user_health_summary` — a composite: the latest snapshot plus all
  three trends for the same window, in one call. Adds no data the other
  four tools don't already expose.

## Known limitation

`MCP_USER_ID` binds the whole process to one user — this is a single-user,
local-process MVP, not a multi-user remote deployment. See
`docs/phase-10-summary.md` for why, and what a real multi-user version
would need instead.
