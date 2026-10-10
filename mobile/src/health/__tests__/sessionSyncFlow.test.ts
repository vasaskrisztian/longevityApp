import { needsReconnect, runSessionSyncFlow, type SessionSyncResponse } from '../sessionSyncFlow';

type Poll = { provider: string; lastSyncAt: string | null }[] | Error;

function deps(response: SessionSyncResponse, polls: Poll[] = []) {
  const getConnections = jest.fn();
  polls.forEach((p) => (p instanceof Error ? getConnections.mockRejectedValueOnce(p) : getConnections.mockResolvedValueOnce(p)));
  return {
    requestSessionSync: jest.fn().mockResolvedValue(response),
    getConnections,
    sleep: jest.fn().mockResolvedValue(undefined),
    onWaiting: jest.fn(),
    onResponse: jest.fn(),
  };
}

const queued: SessionSyncResponse = {
  queued: true,
  providers: [{ provider: 'OURA', status: 'queued', jobId: 'j1', lastSyncAt: '2026-10-10T08:00:00.000Z' }],
};

describe('runSessionSyncFlow', () => {
  it('returns immediately, without polling, when nothing was queued', async () => {
    const d = deps({ queued: false, providers: [{ provider: 'OURA', status: 'fresh', lastSyncAt: null }] });
    expect(await runSessionSyncFlow(d)).toMatchObject({ waited: false, updated: false });
    expect(d.getConnections).not.toHaveBeenCalled();
    expect(d.onWaiting).not.toHaveBeenCalled();
  });

  it('hands device_push entries to the caller without waiting for them', async () => {
    const response = { queued: false, providers: [{ provider: 'APPLE_HEALTH', status: 'device_push', lastSyncAt: null }] };
    const d = deps(response);
    expect((await runSessionSyncFlow(d)).waited).toBe(false);
    expect(d.onResponse).toHaveBeenCalledWith(response);
  });

  it('polls until the watched provider lastSyncAt moves', async () => {
    const same = [{ provider: 'OURA', lastSyncAt: '2026-10-10T08:00:00.000Z' }];
    const d = deps(queued, [same, same, [{ provider: 'OURA', lastSyncAt: '2026-10-10T12:00:05.000Z' }]]);
    expect(await runSessionSyncFlow(d, { pollIntervalMs: 1000, maxPolls: 10 })).toMatchObject({ waited: true, updated: true });
    expect(d.getConnections).toHaveBeenCalledTimes(3);
    expect(d.sleep).toHaveBeenCalledWith(1000);
  });

  it('gives up after maxPolls without claiming an update, and survives failing polls', async () => {
    const same = [{ provider: 'OURA', lastSyncAt: '2026-10-10T08:00:00.000Z' }];
    const d = deps(queued, [new Error('network'), same, same]);
    expect(await runSessionSyncFlow(d, { maxPolls: 3 })).toMatchObject({ waited: true, updated: false });
    expect(d.getConnections).toHaveBeenCalledTimes(3);
  });

  it('propagates a failure of the initial request', async () => {
    const d = deps(queued);
    d.requestSessionSync.mockRejectedValue(new Error('401'));
    await expect(runSessionSyncFlow(d)).rejects.toThrow('401');
  });
});

describe('needsReconnect', () => {
  it('lists providers whose connection needs attention', () => {
    expect(needsReconnect({ queued: false, providers: [{ provider: 'OURA', status: 'reconnect_required', lastSyncAt: null }] })).toEqual(['OURA']);
    expect(needsReconnect(queued)).toEqual([]);
  });
});
