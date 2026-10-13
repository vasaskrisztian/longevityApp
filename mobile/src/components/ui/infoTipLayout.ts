import type { TipRect } from '@/src/components/ui/infoTipStore';

/** Popover width: comfortable reading column, never wider than the window minus margins. */
export const TIP_MAX_WIDTH = 280;
export const TIP_MARGIN = 8;
const TIP_GAP = 4;

export function tipWidth(windowWidth: number): number {
  return Math.max(160, Math.min(TIP_MAX_WIDTH, windowWidth - TIP_MARGIN * 2));
}

/**
 * Left edge (window coordinates) of a popover of `width`: starts at the
 * trigger's left edge, nudged sideways to stay inside the window.
 */
export function tipLeft(triggerX: number, width: number, windowWidth: number): number {
  const mostRight = windowWidth - TIP_MARGIN - width;
  return Math.max(TIP_MARGIN, Math.min(triggerX, mostRight));
}

/**
 * Top edge: under the trigger; above it when the popover (once its height is
 * known) would run off the bottom and there is room above. Before the height
 * is measured the popover is simply placed below (and drawn transparent).
 */
export function tipTop(rect: TipRect, popoverHeight: number | null, windowHeight: number): number {
  const below = rect.y + rect.height + TIP_GAP;
  if (popoverHeight === null) return below;
  if (below + popoverHeight <= windowHeight - TIP_MARGIN) return below;
  const above = rect.y - popoverHeight - TIP_GAP;
  return above >= TIP_MARGIN ? above : Math.max(TIP_MARGIN, windowHeight - TIP_MARGIN - popoverHeight);
}
