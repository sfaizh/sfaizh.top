import {
  SMEAR_FASTER,
  advance,
  clampIndex,
  cursorBlock,
  scrollToReveal,
  settled,
  type LineRect,
} from './cursor';

const line = (y: number, height = 20): LineRect => ({ x: 10, y, width: 300, height });

describe('advance', () => {
  it('moves a fraction of the remaining distance', () => {
    expect(advance(0, 100, 0.5)).toBe(50);
    expect(advance(50, 100, 0.5)).toBe(75);
  });

  it('converges rather than overshooting', () => {
    let position = 0;
    for (let frame = 0; frame < 40; frame++) {
      position = advance(position, 100, SMEAR_FASTER.stiffness);
    }
    expect(position).toBeCloseTo(100, 5);
    expect(position).toBeLessThanOrEqual(100);
  });

  it('makes the tail lag behind the head, which is what draws the smear', () => {
    let head = 0;
    let tail = 0;
    for (let frame = 0; frame < 3; frame++) {
      head = advance(head, 500, SMEAR_FASTER.stiffness);
      tail = advance(tail, 500, SMEAR_FASTER.trailingStiffness);
    }
    expect(head).toBeGreaterThan(tail);
  });
});

describe('settled', () => {
  const target = { x: 100, y: 200 };

  it('is true once both points have arrived', () => {
    expect(settled({ x: 100, y: 200 }, { x: 100, y: 200 }, target, 0.5)).toBe(true);
  });

  it('is false while the tail is still catching up', () => {
    expect(settled({ x: 100, y: 200 }, { x: 100, y: 180 }, target, 0.5)).toBe(false);
  });
});

describe('clampIndex', () => {
  it('keeps the cursor inside the document', () => {
    expect(clampIndex(-3, 5)).toBe(0);
    expect(clampIndex(99, 5)).toBe(4);
    expect(clampIndex(2, 5)).toBe(2);
  });

  it('is zero when there is nothing to point at', () => {
    expect(clampIndex(4, 0)).toBe(0);
  });
});

describe('scrollToReveal', () => {
  const view = { scrollTop: 1000, clientHeight: 500 };

  it('does not move when the line is already comfortably visible', () => {
    expect(scrollToReveal(line(1200), view)).toBe(1000);
  });

  it('scrolls up for a line above the viewport', () => {
    expect(scrollToReveal(line(900), view)).toBe(900 - 64);
  });

  it('scrolls down for a line below the viewport', () => {
    // bottom edge + margin, minus the viewport height
    expect(scrollToReveal(line(1480), view)).toBe(1480 + 20 + 64 - 500);
  });

  it('never scrolls above the top of the document', () => {
    expect(scrollToReveal(line(10), { scrollTop: 100, clientHeight: 500 })).toBe(0);
  });

  it('respects the margin so the cursor is never flush to an edge', () => {
    const target = scrollToReveal(line(900), view, 120);
    expect(target).toBe(900 - 120);
  });
});

describe('cursorBlock', () => {
  it('sits at the start of its line and matches its height', () => {
    const block = cursorBlock(line(120, 24));

    expect(block.x).toBe(10);
    expect(block.y).toBe(120);
    expect(block.height).toBe(24);
  });

  it('stays wide enough to see on small text', () => {
    expect(cursorBlock(line(0, 8)).width).toBeGreaterThanOrEqual(7);
  });
});
