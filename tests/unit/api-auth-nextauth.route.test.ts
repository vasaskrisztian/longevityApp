import { describe, it, expect, vi } from 'vitest';

// The route itself is a trivial re-export of Auth.js's own request handlers
// (`export const { GET, POST } = handlers`); the only thing worth asserting
// is that it re-exports the SAME functions '@/lib/auth/auth' produces,
// rather than, say, dropping one of the two HTTP methods.
const handlersMock = { GET: vi.fn(), POST: vi.fn() };
vi.mock('@/lib/auth/auth', () => ({ handlers: handlersMock }));

const route = await import('@/app/api/auth/[...nextauth]/route');

describe('GET/POST /api/auth/[...nextauth]', () => {
  it('re-exports GET from the Auth.js handlers', () => {
    expect(route.GET).toBe(handlersMock.GET);
  });

  it('re-exports POST from the Auth.js handlers', () => {
    expect(route.POST).toBe(handlersMock.POST);
  });
});
