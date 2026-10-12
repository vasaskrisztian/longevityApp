/** Pure helpers for the charts (kept apart from the SVG component so they can be unit-tested). */

/** Minutes as hours and minutes: 450 -> "7h 30m", 480 -> "8h", 45 -> "45m", 0 -> "0". */
export function durationLabel(minutes: number): string {
  const total = Math.round(minutes);
  if (total <= 0) return '0';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Top of a duration axis: the data maximum rounded up to a whole multiple of 2 hours, so that the
 * four grid steps land on 30-minute multiples ("2h 30m", "5h", ...) instead of odd minute values.
 */
export function durationAxisMax(values: Array<number | null>): number {
  const max = values.reduce<number>((acc, v) => (v !== null && v > acc ? v : acc), 0);
  return Math.max(120, Math.ceil(max / 120) * 120);
}

/** A value as shown in a tooltip: whole numbers as-is (with thousands separators), others to one decimal. */
export function defaultValueLabel(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString('en-US') : value.toFixed(1);
}

export interface TooltipBox {
  left: number;
  top: number;
}

/**
 * Where to put a tooltip of the given size for a point at (x, y): centred above it, clamped into the
 * chart; flipped below the point when there is no room above.
 */
export function placeTooltip(
  point: { x: number; y: number },
  size: { width: number; height: number },
  bounds: { width: number; height: number },
  gap = 10,
): TooltipBox {
  const left = Math.min(Math.max(point.x - size.width / 2, 0), Math.max(bounds.width - size.width, 0));
  const above = point.y - gap - size.height;
  const top = above >= 0 ? above : Math.min(point.y + gap, Math.max(bounds.height - size.height, 0));
  return { left, top };
}
