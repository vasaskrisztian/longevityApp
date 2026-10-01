import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthenticatedError, ForbiddenError } from '@/lib/auth/errors';

const requireAuthenticatedUserMock = vi.fn();

function toErrorResponse(error: unknown): Response {
  if (error instanceof UnauthenticatedError || error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  throw error;
}

vi.mock('@/lib/auth/authorization', () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock,
  toErrorResponse,
  UnauthenticatedError,
  ForbiddenError,
}));

const listProtocolsMock = vi.fn();
const createProtocolMock = vi.fn();
vi.mock('@/modules/protocols/protocols.service', () => ({
  listProtocols: listProtocolsMock,
  createProtocol: createProtocolMock,
}));

// Phase 13: the route imports creators.service.ts for the PUBLIC-visibility
// gate — mocked here so importing the route never touches the real Prisma
// client (which isn't initialized in this sandbox, see docs/phase-1-summary.md).
const canPublishPubliclyMock = vi.fn();
vi.mock('@/modules/creators/creators.service', () => ({
  canPublishPublicly: canPublishPubliclyMock,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { GET, POST } = await import('@/app/api/protocols/route');

const VALID_PROTOCOL = { name: 'Base building', targetSleepScore: 85 };

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/protocols', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  listProtocolsMock.mockReset();
  createProtocolMock.mockReset();
  canPublishPubliclyMock.mockReset();
});

describe('GET /api/protocols', () => {
  it('returns 401 when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET();

    expect(response.status).toBe(401);
    expect(listProtocolsMock).not.toHaveBeenCalled();
  });

  it('lists protocols scoped to the caller\'s own id', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    listProtocolsMock.mockResolvedValue([{ id: 'p1' }]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(listProtocolsMock).toHaveBeenCalledWith('u1');
    const body = await response.json();
    expect(body).toEqual([{ id: 'p1' }]);
  });
});

describe('POST /api/protocols', () => {
  it('returns 401 and never calls the service when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await POST(postRequest(VALID_PROTOCOL));

    expect(response.status).toBe(401);
    expect(createProtocolMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid payload (missing name)', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await POST(postRequest({ ...VALID_PROTOCOL, name: '' }));

    expect(response.status).toBe(400);
    expect(createProtocolMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an unparsable JSON body', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    const badRequest = new Request('http://localhost/api/protocols', { method: 'POST', body: 'not json' });

    const response = await POST(badRequest);

    expect(response.status).toBe(400);
  });

  it('creates a protocol scoped to the caller\'s own id and returns 201', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    createProtocolMock.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      ...VALID_PROTOCOL,
      isActive: false,
      supplements: [],
    });

    const response = await POST(postRequest(VALID_PROTOCOL));

    expect(response.status).toBe(201);
    expect(createProtocolMock).toHaveBeenCalledWith('u1', expect.objectContaining({ name: 'Base building' }));
  });

  it('returns 500 when the service throws', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    createProtocolMock.mockRejectedValue(new Error('db down'));

    const response = await POST(postRequest(VALID_PROTOCOL));

    expect(response.status).toBe(500);
  });

  // Phase 13
  it('returns 403 for visibility: PUBLIC when the caller is not a consenting creator', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    canPublishPubliclyMock.mockResolvedValue(false);

    const response = await POST(postRequest({ ...VALID_PROTOCOL, visibility: 'PUBLIC' }));

    expect(response.status).toBe(403);
    expect(createProtocolMock).not.toHaveBeenCalled();
  });

  it('creates a PUBLIC protocol when the caller is a consenting creator', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    canPublishPubliclyMock.mockResolvedValue(true);
    createProtocolMock.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      ...VALID_PROTOCOL,
      visibility: 'PUBLIC',
      isActive: false,
      supplements: [],
    });

    const response = await POST(postRequest({ ...VALID_PROTOCOL, visibility: 'PUBLIC' }));

    expect(response.status).toBe(201);
    expect(createProtocolMock).toHaveBeenCalledWith('u1', expect.objectContaining({ visibility: 'PUBLIC' }));
  });
});
