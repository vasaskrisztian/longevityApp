import React from 'react';
import { AppState } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

const mockRunDeviceAutoSync = jest.fn();
jest.mock('../deviceAutoSync', () => ({
  runDeviceAutoSync: (...args: unknown[]) => mockRunDeviceAutoSync(...args),
}));

import { FOREGROUND_SYNC_MIN_INTERVAL_MS, useDeviceAutoSync } from '../useDeviceAutoSync';

function Probe({ enabled }: { enabled: boolean }) {
  useDeviceAutoSync(enabled);
  return null;
}

let appStateListener: ((state: string) => void) | null = null;
const remove = jest.fn();

beforeEach(() => {
  mockRunDeviceAutoSync.mockReset().mockResolvedValue(undefined);
  remove.mockReset();
  appStateListener = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, listener: (s: string) => void) => {
    appStateListener = listener;
    return { remove };
  }) as never);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

async function render(enabled: boolean) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<Probe enabled={enabled} />);
  });
  return renderer;
}

describe('useDeviceAutoSync', () => {
  it('does nothing while signed out', async () => {
    await render(false);
    expect(mockRunDeviceAutoSync).not.toHaveBeenCalled();
    expect(appStateListener).toBeNull();
  });

  it('syncs immediately when the signed-in screens mount (login / cold start)', async () => {
    await render(true);
    expect(mockRunDeviceAutoSync).toHaveBeenCalledTimes(1);
  });

  it('re-syncs on foreground only after the minimum interval', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-10T12:00:00Z') });
    await render(true);
    expect(mockRunDeviceAutoSync).toHaveBeenCalledTimes(1);

    await act(async () => appStateListener?.('active'));
    expect(mockRunDeviceAutoSync).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date(Date.now() + FOREGROUND_SYNC_MIN_INTERVAL_MS + 1000));
    await act(async () => appStateListener?.('active'));
    expect(mockRunDeviceAutoSync).toHaveBeenCalledTimes(2);

    await act(async () => appStateListener?.('background'));
    expect(mockRunDeviceAutoSync).toHaveBeenCalledTimes(2);
  });

  it('runs again on a fresh login (enabled false -> true) and unsubscribes on sign-out', async () => {
    const renderer = await render(true);
    await act(async () => renderer.update(<Probe enabled={false} />));
    expect(remove).toHaveBeenCalled();
    await act(async () => renderer.update(<Probe enabled={true} />));
    expect(mockRunDeviceAutoSync).toHaveBeenCalledTimes(2);
  });
});
