/**
 * Minimal fixed-window rate limiter for Phase 1. It is in-memory and
 * per-instance, which is fine for a single dev/staging instance but NOT
 * sufficient once the app runs on multiple instances — swap the store for
 * Redis (already provisioned via REDIS_URL for BullMQ) before production
 * multi-instance deployment. The interface is deliberately storage-agnostic
 * so that swap doesn't touch call sites.
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface RateLimitStore {
  hit(key: string, windowMs: number, max: number): RateLimitResult;
}

class InMemoryRateLimitStore implements RateLimitStore {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  hit(key: string, windowMs: number, max: number): RateLimitResult {
    const now = Date.now();
    const entry = this.hits.get(key);

    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
    }

    entry.count += 1;
    const allowed = entry.count <= max;
    return { allowed, remaining: Math.max(0, max - entry.count), resetAt: entry.resetAt };
  }
}

const store: RateLimitStore = new InMemoryRateLimitStore();

/**
 * Rate-limit key = identifier (IP) + a scope name, per ARCHITECTURE.md §10:
 * `/login`, `/register`, `/password-reset`, OAuth connect, manual sync.
 */
export function checkRateLimit(
  scope: string,
  identifier: string,
  options: { windowMs: number; max: number },
): RateLimitResult {
  return store.hit(`${scope}:${identifier}`, options.windowMs, options.max);
}

export const AUTH_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 5 };
export const MANUAL_SYNC_RATE_LIMIT = { windowMs: 5 * 60 * 1000, max: 1 };

export function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  return forwardedFor?.split(',')[0]?.trim() ?? 'unknown';
}
