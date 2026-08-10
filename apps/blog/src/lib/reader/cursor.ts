/**
 * A cursor for prose.
 *
 * Vim has a cursor because it has lines. A rendered article has *line boxes* —
 * the rectangles the browser lays text out into — so the cursor here is an
 * index into those. `j` and `k` move between them, and the view only scrolls
 * when the cursor would leave it, which is how Vim actually behaves.
 *
 * Kept free of React and of the DOM where possible so the geometry and the
 * smear physics can be unit-tested.
 */

export interface LineRect {
  /** Offsets are in the scroll container's content coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * The `smear-cursor.nvim` "faster animation" preset.
 *
 * The head chases the target hard; the tail chases it more slowly, and the gap
 * between them is what you see as the smear. Adapted rather than ported: the
 * plugin works in terminal cells over a fixed redraw, this works in pixels on
 * whatever frame rate the browser gives us.
 *
 * @see https://github.com/sphamba/smear-cursor.nvim
 */
export const SMEAR_FASTER = {
  stiffness: 0.8,
  trailingStiffness: 0.5,
  damping: 0.8,
  /** Below this distance (px) the animation stops and snaps. */
  distanceStopAnimating: 0.5,
} as const;

/** One frame of the chase. Returns the new position. */
export function advance(current: number, target: number, stiffness: number): number {
  return current + (target - current) * stiffness;
}

/** True once head and tail have both effectively arrived. */
export function settled(head: Point, tail: Point, target: Point, threshold: number): boolean {
  return (
    Math.abs(head.x - target.x) < threshold &&
    Math.abs(head.y - target.y) < threshold &&
    Math.abs(tail.x - target.x) < threshold &&
    Math.abs(tail.y - target.y) < threshold
  );
}

/**
 * Every line box in the article, in reading order, in the scroll container's
 * content coordinates so they survive scrolling.
 */
export function collectLineRects(article: HTMLElement, container: HTMLElement): LineRect[] {
  const base = container.getBoundingClientRect();
  const offsetY = container.scrollTop - base.top;
  const offsetX = container.scrollLeft - base.left;

  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.nodeValue && node.nodeValue.trim().length > 0
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const range = document.createRange();
  const rects: LineRect[] = [];

  // Environments without layout (jsdom, and any server-side pass) cannot
  // measure line boxes. Returning nothing is correct: the reader falls back to
  // scrolling the view rather than moving a cursor it cannot place.
  if (typeof range.getClientRects !== 'function') return [];

  while (walker.nextNode()) {
    range.selectNodeContents(walker.currentNode);
    for (const rect of Array.from(range.getClientRects())) {
      // Zero-area rects come from collapsed whitespace and empty inlines.
      if (rect.width < 1 || rect.height < 1) continue;
      rects.push({
        x: rect.left + offsetX,
        y: rect.top + offsetY,
        width: rect.width,
        height: rect.height,
      });
    }
  }

  return dedupeLines(rects);
}

/**
 * Text nodes are split by inline markup, so a single visual line can produce
 * several rects. Merge the ones that sit on the same baseline.
 */
function dedupeLines(rects: LineRect[]): LineRect[] {
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const merged: LineRect[] = [];

  for (const rect of sorted) {
    const previous = merged[merged.length - 1];
    const sameLine = previous && Math.abs(rect.y - previous.y) < Math.min(rect.height, previous.height) * 0.6;

    if (!sameLine) {
      merged.push({ ...rect });
      continue;
    }
    // Extend the existing line to cover this fragment.
    const right = Math.max(previous.x + previous.width, rect.x + rect.width);
    previous.x = Math.min(previous.x, rect.x);
    previous.width = right - previous.x;
    previous.height = Math.max(previous.height, rect.height);
    previous.y = Math.min(previous.y, rect.y);
  }

  return merged;
}

/** The line closest to a content-space y offset. */
export function nearestLineIndex(rects: LineRect[], y: number): number {
  if (rects.length === 0) return 0;

  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < rects.length; index++) {
    const centre = rects[index].y + rects[index].height / 2;
    const distance = Math.abs(centre - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }

  return best;
}

export function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.max(0, Math.min(length - 1, index));
}

/**
 * How far the container must scroll to bring a line into view, keeping a
 * margin so the cursor is never flush against an edge. Returns the current
 * scroll position when no movement is needed.
 */
export function scrollToReveal(
  rect: LineRect,
  view: { scrollTop: number; clientHeight: number },
  margin = 64
): number {
  const top = rect.y - margin;
  const bottom = rect.y + rect.height + margin;

  if (top < view.scrollTop) return Math.max(0, top);
  if (bottom > view.scrollTop + view.clientHeight) return bottom - view.clientHeight;
  return view.scrollTop;
}

/** The cursor block: a slab at the start of the line, like Vim's on column 0. */
export function cursorBlock(rect: LineRect): LineRect {
  return {
    x: rect.x,
    y: rect.y,
    width: Math.max(7, Math.round(rect.height * 0.45)),
    height: rect.height,
  };
}
