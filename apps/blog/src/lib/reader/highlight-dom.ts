/**
 * `/`-search highlighting, without touching the DOM.
 *
 * The obvious implementation wraps matches in `<mark>`. It does not survive
 * here: the article is rendered through `dangerouslySetInnerHTML`, so React
 * owns that subtree, and imperative edits to it are liable to be discarded on
 * the next commit — highlights would appear and then silently vanish. Wrapping
 * also reflows the text, which invalidates the line boxes the reader's cursor
 * is indexed against.
 *
 * The CSS Custom Highlight API solves both: matches are `Range` objects
 * registered with `CSS.highlights` and painted via `::highlight()`. No nodes
 * are created, nothing reflows, and React has nothing to overwrite.
 */

const ALL = 'reader-hit';
const ACTIVE = 'reader-hit-active';
const SELECTION = 'reader-visual';

/** Older browsers simply get no highlight painting; `n`/`N` still navigate. */
export function supportsHighlights(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
}

/**
 * Every case-insensitive occurrence of `query`, as ranges in document order.
 */
export function findMatches(root: HTMLElement, query: string): Range[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.nodeValue && node.nodeValue.trim().length > 0
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const ranges: Range[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const haystack = (node.nodeValue ?? '').toLowerCase();

    let from = haystack.indexOf(needle);
    while (from !== -1) {
      const range = document.createRange();
      range.setStart(node, from);
      range.setEnd(node, from + needle.length);
      ranges.push(range);
      from = haystack.indexOf(needle, from + needle.length);
    }
  }

  return ranges;
}

/** Paint every match, with the active one styled differently. */
export function paintMatches(ranges: Range[], activeIndex: number): void {
  if (!supportsHighlights()) return;

  const inactive = ranges.filter((_, index) => index !== activeIndex);
  CSS.highlights.set(ALL, new Highlight(...inactive));

  const active = ranges[activeIndex];
  if (active) CSS.highlights.set(ACTIVE, new Highlight(active));
  else CSS.highlights.delete(ACTIVE);
}

export function clearMatches(): void {
  if (!supportsHighlights()) return;
  CSS.highlights.delete(ALL);
  CSS.highlights.delete(ACTIVE);
}

/** Visual-mode selection. Passing null clears it. */
export function paintSelection(range: Range | null): void {
  if (!supportsHighlights()) return;
  if (range && !range.collapsed) CSS.highlights.set(SELECTION, new Highlight(range));
  else CSS.highlights.delete(SELECTION);
}

/** A match's offset inside the scroll container's content coordinates. */
export function rangeOffsetTop(range: Range, container: HTMLElement): number {
  const rect = range.getBoundingClientRect();
  const base = container.getBoundingClientRect();
  return rect.top - base.top + container.scrollTop;
}
