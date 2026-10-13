import { tipLeft, tipTop, tipWidth } from '@/src/components/ui/infoTipLayout';

describe('tipWidth', () => {
  it('caps at 280 and shrinks on narrow windows', () => {
    expect(tipWidth(1200)).toBe(280);
    expect(tipWidth(360)).toBe(280);
    expect(tipWidth(280)).toBe(264);
    expect(tipWidth(100)).toBe(160);
  });
});

describe('tipLeft', () => {
  it('starts at the trigger when it fits', () => {
    expect(tipLeft(40, 280, 800)).toBe(40);
  });
  it('shifts left near the right edge', () => {
    expect(tipLeft(300, 280, 390)).toBe(390 - 8 - 280);
  });
  it('keeps the left margin', () => {
    expect(tipLeft(2, 280, 390)).toBe(8);
  });
});

describe('tipTop', () => {
  const rect = { x: 0, y: 100, width: 80, height: 18 };
  it('goes below the trigger, and before it is measured', () => {
    expect(tipTop(rect, null, 800)).toBe(122);
    expect(tipTop(rect, 150, 800)).toBe(122);
  });
  it('flips above when it would run off the bottom and there is room', () => {
    expect(tipTop({ ...rect, y: 700 }, 150, 800)).toBe(700 - 150 - 4);
  });
  it('is pinned inside the window when neither side has room', () => {
    expect(tipTop({ ...rect, y: 100 }, 780, 800)).toBe(12);
  });
});
