import { defaultValueLabel, durationAxisMax, durationLabel, placeTooltip } from '../chartFormat';

describe('durationLabel', () => {
  it('shows hours and minutes', () => {
    expect(durationLabel(450)).toBe('7h 30m');
    expect(durationLabel(480)).toBe('8h');
    expect(durationLabel(45)).toBe('45m');
    expect(durationLabel(61)).toBe('1h 1m');
    expect(durationLabel(0)).toBe('0');
  });
  it('rounds fractional minutes', () => {
    expect(durationLabel(419.6)).toBe('7h');
  });
});

describe('durationAxisMax', () => {
  it('rounds up to whole 2-hour steps so the grid lands on 30-minute multiples', () => {
    expect(durationAxisMax([400, null, 455])).toBe(480);
    expect(durationAxisMax([500])).toBe(600);
    expect(durationAxisMax([600])).toBe(600);
    expect(durationAxisMax([480, 481])).toBe(600);
  });
  it('has a floor for empty or tiny data', () => {
    expect(durationAxisMax([])).toBe(120);
    expect(durationAxisMax([null, 10])).toBe(120);
  });
  it('gives quarter steps that are whole 30-minute multiples', () => {
    for (const v of [90, 333, 477, 512, 700]) {
      expect((durationAxisMax([v]) / 4) % 30).toBe(0);
    }
  });
});

describe('defaultValueLabel', () => {
  it('formats integers with separators and decimals to one place', () => {
    expect(defaultValueLabel(12345)).toBe('12,345');
    expect(defaultValueLabel(48.26)).toBe('48.3');
    expect(defaultValueLabel(82)).toBe('82');
  });
});

describe('placeTooltip', () => {
  const size = { width: 100, height: 40 };
  const bounds = { width: 300, height: 180 };
  it('centres the tooltip above the point', () => {
    expect(placeTooltip({ x: 150, y: 100 }, size, bounds)).toEqual({ left: 100, top: 50 });
  });
  it('clamps at the left and right edges', () => {
    expect(placeTooltip({ x: 5, y: 100 }, size, bounds).left).toBe(0);
    expect(placeTooltip({ x: 295, y: 100 }, size, bounds).left).toBe(200);
  });
  it('flips below the point when there is no room above', () => {
    expect(placeTooltip({ x: 150, y: 20 }, size, bounds).top).toBe(30);
  });
});
