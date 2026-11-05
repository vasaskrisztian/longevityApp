import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireAuthenticatedUser = vi.fn();
vi.mock('@/lib/auth/authorization', () => ({
  requireAuthenticatedUser,
  toErrorResponse: (error: Error & { status?: number }) =>
    Response.json({ error: error.message }, { status: error.status ?? 401 }),
}));
const getUserLanguage = vi.fn();
const setUserLanguage = vi.fn();
vi.mock('@/modules/auth/account.service', () => ({ getUserLanguage, setUserLanguage }));

const { GET, PUT } = await import('@/app/api/account/language/route');

const put = (body: unknown) =>
  new Request('http://localhost/api/account/language', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthenticatedUser.mockResolvedValue({ id: 'u1', role: 'USER' });
});

describe('/api/account/language', () => {
  it('requires a signed-in user', async () => {
    requireAuthenticatedUser.mockRejectedValue(Object.assign(new Error('Unauthenticated'), { status: 401 }));
    expect((await GET()).status).toBe(401);
    expect((await PUT(put({ language: 'de' }))).status).toBe(401);
    expect(setUserLanguage).not.toHaveBeenCalled();
  });

  it('returns the stored language', async () => {
    getUserLanguage.mockResolvedValue('hu');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ language: 'hu' });
    expect(getUserLanguage).toHaveBeenCalledWith('u1');
  });

  it('saves a supported language', async () => {
    const response = await PUT(put({ language: 'de' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ language: 'de' });
    expect(setUserLanguage).toHaveBeenCalledWith('u1', 'de');
  });

  it('rejects an unsupported language or a malformed body', async () => {
    expect((await PUT(put({ language: 'fr' }))).status).toBe(400);
    expect((await PUT(put({}))).status).toBe(400);
    expect((await PUT(new Request('http://localhost/x', { method: 'PUT', body: 'nope' }))).status).toBe(400);
    expect(setUserLanguage).not.toHaveBeenCalled();
  });
});
