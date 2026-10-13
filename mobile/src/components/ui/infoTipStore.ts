import { useSyncExternalStore } from 'react';

import type { GlossaryKey } from '@/src/content/glossary';

/**
 * Which explanation popover is open, if any. One popover at a time and it is
 * drawn by `InfoTipHost` at the root of the app (above every screen), so no
 * card or scroll container can cover or clip it.
 */

/** Trigger rectangle in window coordinates. */
export interface TipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TipMode = 'hover' | 'pinned';

export interface OpenTip {
  /** Which InfoLabel opened it, so only that label's hover-out closes it. */
  owner: string;
  term: GlossaryKey;
  rect: TipRect;
  mode: TipMode;
}

let current: OpenTip | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function showTip(tip: OpenTip) {
  current = tip;
  emit();
}

/** Closes the popover; with `owner`, only if that label is the one that opened it. */
export function hideTip(owner?: string) {
  if (current === null) return;
  if (owner !== undefined && current.owner !== owner) return;
  current = null;
  emit();
}

export function getOpenTip(): OpenTip | null {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOpenTip(): OpenTip | null {
  return useSyncExternalStore(subscribe, getOpenTip, getOpenTip);
}
