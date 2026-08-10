import { clampToText, flatIndexOf, rangeBetween, type TextMap } from './text-map';

/**
 * A cursor for prose.
 *
 * The cursor is an index into the article's flattened text (see `text-map`),
 * which is what makes `h`, `w` and yanking expressible. This module turns that
 * index into pixels — and pixels back into an index for vertical motions — and
 * holds the smear physics.
 *
 * The view only scrolls when the cursor would leave it, which is how Vim
 * actually behaves.
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

/** The cursor block: covers the character it sits on, as Vim's does. */
export function cursorBlock(rect: LineRect): LineRect {
  return {
    x: rect.x,
    y: rect.y,
    width: Math.max(7, Math.round(rect.width)),
    height: rect.height,
  };
}

/**
 * The rectangle of the character at `index`, in the container's content
 * coordinates. Returns null where the position cannot be measured — at a node
 * boundary, or in an environment without layout.
 */
export function rectForIndex(map: TextMap, index: number, container: HTMLElement): LineRect | null {
  const clamped = clampToText(map.text, index);
  let range = rangeBetween(map, clamped, clamped + 1);
  if (!range || typeof range.getBoundingClientRect !== 'function') return null;

  let rect = range.getBoundingClientRect();
  if (rect.height === 0 && clamped > 0) {
    // Zero-height happens between nodes; the preceding character still tells
    // us which line we are on.
    range = rangeBetween(map, clamped - 1, clamped);
    if (range) rect = range.getBoundingClientRect();
  }
  if (rect.height === 0) return null;

  const base = container.getBoundingClientRect();
  return {
    x: rect.left - base.left + container.scrollLeft,
    y: rect.top - base.top + container.scrollTop,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Whether the character at `index` renders a box of its own.
 *
 * A newline inside a paragraph is drawn as a space, except at a line wrap where
 * it collapses to nothing. A cursor there would be invisible and the motion
 * that put it there would look like it did nothing, so motions skip over these.
 */
export function hasVisibleRect(map: TextMap, index: number): boolean {
  const range = rangeBetween(map, index, index + 1);
  if (!range || typeof range.getBoundingClientRect !== 'function') return true;

  const rect = range.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** The same rectangle, left in viewport coordinates for hit-testing. */
export function viewportRectForIndex(map: TextMap, index: number): DOMRect | null {
  const clamped = clampToText(map.text, index);
  const range = rangeBetween(map, clamped, clamped + 1);
  if (!range || typeof range.getBoundingClientRect !== 'function') return null;

  const rect = range.getBoundingClientRect();
  return rect.height === 0 ? null : rect;
}

/**
 * Which text position sits under a point. Vertical motions go through this
 * rather than arithmetic: proportional text has no columns, so "the character
 * below this one" is a question only layout can answer.
 */
export function caretIndexFromPoint(map: TextMap, x: number, y: number): number | null {
  const owner = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  let node: Node | null = null;
  let offset = 0;

  if (typeof owner.caretPositionFromPoint === 'function') {
    const position = owner.caretPositionFromPoint(x, y);
    if (position) {
      node = position.offsetNode;
      offset = position.offset;
    }
  } else if (typeof owner.caretRangeFromPoint === 'function') {
    const range = owner.caretRangeFromPoint(x, y);
    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }

  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  return flatIndexOf(map, node, offset);
}
