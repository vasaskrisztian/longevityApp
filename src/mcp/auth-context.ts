import type { McpAuthContext } from './gateway';

/**
 * How src/mcp/server.ts resolves McpAuthContext for a stdio-transport local
 * process. There is no HTTP session to piggyback on here (unlike every
 * Route Handler, which resolves session.user.id via requireAuthenticatedUser
 * — see lib/auth/authorization.ts) — a stdio MCP server is one process bound
 * to one local user for its whole lifetime, the same shape Claude Desktop /
 * Claude Code's own MCP config uses (one configured server entry per user).
 *
 * MVP simplification, deliberately documented (see docs/phase-10-summary.md
 * Known limitations): the user is fixed once at process startup from a
 * required MCP_USER_ID environment variable, exactly the same
 * fail-loudly-if-unset pattern lib/encryption/encryption.service.ts already
 * uses for TOKEN_ENCRYPTION_KEY. A real multi-user remote MCP deployment
 * (HTTP/SSE transport, many concurrent callers) would need per-request
 * token-based auth instead of a single startup-time env var — out of scope
 * for this phase, which only has to satisfy §9's local/stdio MVP.
 */
export class McpConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpConfigurationError';
  }
}

export function resolveMcpAuthContextFromEnv(env: NodeJS.ProcessEnv = process.env): McpAuthContext {
  const userId = env.MCP_USER_ID;
  if (!userId || userId.trim() === '') {
    throw new McpConfigurationError(
      'MCP_USER_ID is not set. The MCP server must be started with MCP_USER_ID=<your user id> ' +
        '(see docs/phase-10-summary.md for how to find your user id and run the server).',
    );
  }
  return { userId };
}
