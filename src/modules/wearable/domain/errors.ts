/**
 * Dependency-free error classes for the wearable domain — same pattern as
 * lib/auth/errors.ts: no Prisma, no Next.js, so anything (tests, route
 * handlers, future MCP tools) can import these without dragging in the
 * whole auth/db chain, and can do `instanceof` checks reliably.
 */

/** The OAuth `state` param is missing, unknown, expired, or already used. */
export class InvalidOAuthStateError extends Error {
  constructor(message = 'Invalid or expired OAuth state') {
    super(message);
    this.name = 'InvalidOAuthStateError';
  }
}

/** OURA_CLIENT_ID/OURA_CLIENT_SECRET/OURA_REDIRECT_URI missing and mock mode is off. */
export class ProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`${provider} is not configured (missing client credentials) and OURA_MOCK_MODE is not enabled`);
    this.name = 'ProviderNotConfiguredError';
  }
}

/** The provider's token endpoint (exchange or refresh) returned an error. */
export class ProviderTokenExchangeError extends Error {
  constructor(
    provider: string,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(`${provider} token exchange failed: ${message}`);
    this.name = 'ProviderTokenExchangeError';
  }
}

/** No EncryptedCredential row exists for the given connectionId. */
export class CredentialNotFoundError extends Error {
  constructor(connectionId: string) {
    super(`No credential found for connection ${connectionId}`);
    this.name = 'CredentialNotFoundError';
  }
}

/** Couldn't acquire the advisory refresh lock within the retry budget — the caller should treat this as retryable. */
export class CredentialLockTimeoutError extends Error {
  constructor(connectionId: string) {
    super(`Timed out waiting for the refresh lock on connection ${connectionId}`);
    this.name = 'CredentialLockTimeoutError';
  }
}

/** The optimistic-concurrency CAS on EncryptedCredential.refreshVersion failed — should not happen while the advisory lock is held; indicates a bug or a bypassed lock. */
export class CredentialVersionConflictError extends Error {
  constructor(connectionId: string) {
    super(`refreshVersion changed underneath us for connection ${connectionId} — refusing to overwrite`);
    this.name = 'CredentialVersionConflictError';
  }
}
