const mockFetchJson = jest.fn();
const mockFetch = jest.fn();
jest.mock('@/src/api/client', () => ({
  apiFetchJson: (...a: unknown[]) => mockFetchJson(...a),
  apiFetch: (...a: unknown[]) => mockFetch(...a),
}));
jest.mock('@/src/config/env', () => ({ API_BASE_URL: 'https://api.test' }));

import { acceptInvitationByToken, groupLogoUri, previewInvitation } from '../groups';
import { markNotificationsRead } from '../notifications';

beforeEach(() => {
  mockFetchJson.mockReset().mockResolvedValue({});
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn();
});

describe('groups api', () => {
  it('builds absolute logo urls', () => {
    expect(groupLogoUri(null)).toBeNull();
    expect(groupLogoUri('/api/groups/g1/logo?v=1')).toBe('https://api.test/api/groups/g1/logo?v=1');
  });
  it('accepts an invitation with explicit consent', async () => {
    await acceptInvitationByToken('a/b');
    expect(mockFetchJson).toHaveBeenCalledWith('/api/invitations/a%2Fb/accept', {
      method: 'POST',
      body: JSON.stringify({ consent: true }),
    });
  });
  it('previews anonymously and tolerates failures', async () => {
    const f = (global as unknown as { fetch: jest.Mock }).fetch;
    f.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'valid' }) });
    await expect(previewInvitation('tok')).resolves.toEqual({ status: 'valid' });
    expect(f).toHaveBeenCalledWith('https://api.test/api/invitations/tok');
    f.mockResolvedValueOnce({ ok: false });
    await expect(previewInvitation('tok')).resolves.toBeNull();
    f.mockRejectedValueOnce(new Error('offline'));
    await expect(previewInvitation('tok')).resolves.toBeNull();
  });
  it('marks notifications read', async () => {
    await markNotificationsRead('all');
    expect(mockFetchJson).toHaveBeenCalledWith('/api/notifications/read', { method: 'POST', body: JSON.stringify({ ids: 'all' }) });
  });
});
