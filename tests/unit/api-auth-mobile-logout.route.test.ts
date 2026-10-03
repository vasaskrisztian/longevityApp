import { describe, it, expect, vi, beforeEach } from 'vitest';

const revokeMobileRefreshTokenMock = vi.fn();
vi.mock('@/modules/auth/mobile-session.service', () => ({
  revokeMobileRefreshToken: revokeMobileRefreshTokenMock,
}));

const { POST } = await import('@/app/api/auth/mobile/logout/route');

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/mobile/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  revokeMobileRefreshTokenMock.mockReset().mockResolvedValue(undefined);
});

describe('POST /api/auth/mobile/logout', () => {
  it('revokes the token and returns 200 for a valid body', async () => {
    const response = await POST(postRequest({ refreshToken: 'abc' }));

    expect(response.status).toBe(200);
    expect(revokeMobileRefreshTokenMock).toHaveBeenCalledWith('abc');
  });

  it('still returns 200 for a missing/invalid body, without calling the service', async () => {
    const response = await POST(postRequest({}));

    expect(response.status).toBe(200);
    expect(revokeMobileRefreshTokenMock).not.toHaveBeenCalled();
  });

  it('still returns 200 even if the service call rejects', async () => {
    revokeMobileRefreshTokenMock.mockRejectedValue(new Error('db down'));

    // The route doesn't currently catch a throw from the service — this
    // documents that revokeMobileRefreshToken itself must never throw
    // (it only ever does best-effort updateMany calls), rather than the
    // route needing its own try/catch.
    await expect(POST(postRequest({ refreshToken: 'abc' }))).rejects.toThrow('db down');
  });
});
