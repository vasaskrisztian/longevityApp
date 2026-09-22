// Shared test environment defaults. Individual tests still override via
// vi.stubEnv() where a specific value matters (e.g. TOKEN_ENCRYPTION_KEY).
process.env.TOKEN_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');
process.env.AUTH_SECRET ??= 'test-secret';
process.env.APP_URL ??= 'http://localhost:3000';
