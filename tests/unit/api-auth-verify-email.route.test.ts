import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyEmailMock = vi.fn();
vi.mock('@/modules/auth/auth.service', () => ({
  verifyEmail: verifyEmailMock,
}));

const { GET } = await import('@/app/api/auth/verify-email/route');

beforeEach(() => {
  verifyEmailMock.mockReset();
});

describe('GET /api/auth/verify-email', () => {
  it('returns 400 and never calls the service when the token query param is missing', async () => {
    const response = await GET(new Request('http://localhost/api/auth/verify-email'));

    expect(response.status).toBe(400);
    expect(verifyEmailMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid or expired token', async () => {
    verifyEmailMock.mockResolvedValue(false);

    const response = await GET(
      new Request('http://localhost/api/auth/verify-email?token=expired'),
    );

    expect(response.status).toBe(400);
    expect(verifyEmailMock).toHaveBeenCalledWith('expired');
  });

  it('redirects to /login?verified=1 for a valid token', async () => {
    verifyEmailMock.mockResolvedValue(true);

    const response = await GET(new Request('http://localhost/api/auth/verify-email?token=valid'), );

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get('location')).toMatch(/\/login\?verified=1$/);
  });
});
