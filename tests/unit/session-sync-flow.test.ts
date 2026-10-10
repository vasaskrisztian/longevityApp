import { describe, it, expect, vi } from 'vitest';
import { needsReconnect, runSessionSyncFlow, type SessionSyncResponse } from '@/lib/wearable/session-sync-flow';

function deps(response: SessionSyncResponse, polls: ({ provider: string; lastSyncAt: string | null }[] | Error)[] = []) {
  const getConnections = vi.fn();
  polls.forEach((p) => (p instanceof Error ? getConnections.mockRejectedValueOnce(p) : getConnections.mockResolvedValueOnce(p)));
  return {
    requestSessionSync: vi.fn().mockResolvedValue(response),
    getConnections,
    sleep: vi.fn().mockResolvedValue(undefined),
    onWaiting: vi.fn(),
    onResponse: vi.fn(),
  };
}

const queued: SessionSyncResponse = {
  queued: true,
  providers: [{ provider: 'OURA', status: 'queued', jobId: 'j1', lastSyncAt: '2026-10-10T08:00:00.000Z' }],
};

describe('runSessionSyncFlow', () => {
  it('returns immediately, without polling, when nothing was queued', async () => {
    const d = deps({ queued: false, providers: [{ provider: 'OURA', status: 'fresh', lastSyncAt: null }] });
    const result = await runSessionSyncFlow(d);
    expect(result).toMatchObject({ waited: false, updated: false });
    expect(d.getConnections).not.toHaveBeenCalled();
    expect(d.onWaiting).not.toHaveBeenCalled();
  });

  it('does not wait for device-pushed providers (Apple Health) but still hands the response to the caller', async () => {
    const response = { queued: false, providers: [{ provider: 'APPLE_HEALTH', status: 'device_push', lastSyncAt: null }] };
    const d = deps(response);
    expect((await runSessionSyncFlow(d)).waited).toBe(false);
    expect(d.onResponse).toHaveBeenCalledWith(response);
  });

  it('polls until the watched provider lastSyncAt moves, then reports updated', async () => {
    const d = deps(queued, [
      [{ provider: 'OURA', lastSyncAt: '2026-10-10T08:00:00.000Z' }],
      [{ provider: 'OURA', lastSyncAt: '2026-10-10T08:00:00.000Z' }],
      [{ provider: 'OURA', lastSyncAt: '2026-10-10T12:00:05.000Z' }],
    ]);
    const result = await runSessionSyncFlow(d, { pollIntervalMs: 1000, maxPolls: 10 });
    expect(result).toMatchObject({ waited: true, updated: true });
    expect(d.getConnections).toHaveBeenCalledTimes(3);
    expect(d.sleep).toHaveBeenCalledWith(1000);
    expect(d.onWaiting).toHaveBeenCalledTimes(1);
  });

  it('also watches a job that was already in progress', async () => {
    const d = deps(
      { queued: false, providers: [{ provider: 'OURA', status: 'in_progress', jobId: 'j0', lastSyncAt: null }] },
      [[{ provider: 'OURA', lastSyncAt: '2026-10-10T12:00:05.000Z' }]],
    );
    expect(await runSessionSyncFlow(d)).toMatchObject({ waited: true, updated: true });
  });

  it('gives up after maxPolls without claiming an update', async () => {
    const same = [{ provider: 'OURA', lastSyncAt: '2026-10-10T08:00:00.000Z' }];
    const d = deps(queued, [same, same, same]);
    const result = await runSessionSyncFlow(d, { maxPolls: 3 });
    expect(result).toMatchObject({ waited: true, updated: false });
    expect(d.getConnections).toHaveBeenCalledTimes(3);
  });

  it('survives a failing poll and keeps going', async () => {
    const d = deps(queued, [new Error('network'), [{ provider: 'OURA', lastSyncAt: '2026-10-10T12:00:05.000Z' }]]);
    expect(await runSessionSyncFlow(d, { maxPolls: 5 })).toMatchObject({ updated: true });
  });

  it('propagates a failure of the initial request to the caller', async () => {
    const d = deps(queued);
    d.requestSessionSync.mockRejectedValue(new Error('401'));
    await expect(runSessionSyncFlow(d)).rejects.toThrow('401');
  });
});

describe('needsReconnect', () => {
  it('lists providers whose connection needs attention', () => {
    expect(
      needsReconnect({ queued: false, providers: [{ provider: 'OURA', status: 'reconnect_required', lastSyncAt: null }] }),
    ).toEqual(['OURA']);
    expect(needsReconnect(queued)).toEqual([]);
  });
});
