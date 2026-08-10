/**
 * A flat view of the article's text.
 *
 * The cursor was originally an index into line boxes, which is enough for `j`
 * and `k` but cannot express a column — and without a column there is no `h`,
 * no `w`, and nothing to yank. So the article is flattened into one string plus
 * a map back to the DOM, and the cursor becomes an index into that string.
 *
 * Vertical motions still need geometry (a proportional font has no fixed
 * columns), so those go through the browser's caret-from-point instead.
 */

export interface TextSpan {
  node: Text;
  /** Half-open range in the flat string. */
  start: number;
  end: number;
}

export interface TextMap {
  text: string;
  spans: TextSpan[];
}

export interface DomPoint {
  node: Text;
  offset: number;
}

/** Flatten every rendered text node, in document order. */
export function buildTextMap(root: HTMLElement): TextMap {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const value = node.nodeValue;
      if (!value) return NodeFilter.FILTER_REJECT;

      // Skip the whitespace the HTML serialiser leaves between block elements.
      // It renders to nothing, so a cursor sitting on it would be invisible and
      // `l` would appear to do nothing. Whitespace *inside* a paragraph is real
      // and stays: only source formatting carries a newline.
      if (/^\s+$/.test(value) && value.includes('\n')) return NodeFilter.FILTER_REJECT;

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const spans: TextSpan[] = [];
  let text = '';

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const value = node.nodeValue ?? '';
    spans.push({ node, start: text.length, end: text.length + value.length });
    text += value;
  }

  return { text, spans };
}

/** Flat index → the DOM position it came from. */
export function pointAt(map: TextMap, index: number): DomPoint | null {
  if (map.spans.length === 0) return null;
  const clamped = Math.max(0, Math.min(index, map.text.length));

  // Binary search: articles run to thousands of spans.
  let low = 0;
  let high = map.spans.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const span = map.spans[middle];
    if (clamped < span.start) high = middle - 1;
    else if (clamped >= span.end) low = middle + 1;
    else return { node: span.node, offset: clamped - span.start };
  }

  const last = map.spans[map.spans.length - 1];
  return { node: last.node, offset: last.node.nodeValue?.length ?? 0 };
}

/** The inverse: a DOM position → its flat index. */
export function flatIndexOf(map: TextMap, node: Node, offset: number): number | null {
  const span = map.spans.find((candidate) => candidate.node === node);
  return span ? span.start + Math.min(offset, span.end - span.start) : null;
}

/** A live range covering `[from, to)` of the flat text. */
export function rangeBetween(map: TextMap, from: number, to: number): Range | null {
  const start = pointAt(map, Math.min(from, to));
  const end = pointAt(map, Math.max(from, to));
  if (!start || !end) return null;

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

// ── word motions ─────────────────────────────────────────────────────────────

type CharClass = 'word' | 'space' | 'punct';

function classify(character: string | undefined): CharClass {
  if (character === undefined) return 'space';
  if (/\s/.test(character)) return 'space';
  return /[A-Za-z0-9_]/.test(character) ? 'word' : 'punct';
}

/**
 * `w` — the start of the next word. Vim treats a run of punctuation as its own
 * word, which is why this classifies rather than just splitting on spaces.
 */
export function nextWordStart(text: string, from: number, count = 1): number {
  let index = Math.max(0, Math.min(from, text.length));

  for (let step = 0; step < count; step++) {
    const startClass = classify(text[index]);
    if (startClass !== 'space') {
      while (index < text.length && classify(text[index]) === startClass) index++;
    }
    while (index < text.length && classify(text[index]) === 'space') index++;
  }

  return Math.min(index, Math.max(0, text.length - 1));
}

/** `b` — the start of the previous word. */
export function prevWordStart(text: string, from: number, count = 1): number {
  let index = Math.max(0, Math.min(from, text.length));

  for (let step = 0; step < count; step++) {
    index--;
    while (index > 0 && classify(text[index]) === 'space') index--;
    if (index <= 0) return 0;

    const runClass = classify(text[index]);
    while (index > 0 && classify(text[index - 1]) === runClass) index--;
  }

  return Math.max(0, index);
}

/** `e` — the end of the current or next word. */
export function wordEnd(text: string, from: number, count = 1): number {
  let index = Math.max(0, Math.min(from, text.length));

  for (let step = 0; step < count; step++) {
    index++;
    while (index < text.length && classify(text[index]) === 'space') index++;
    if (index >= text.length) return Math.max(0, text.length - 1);

    const runClass = classify(text[index]);
    while (index + 1 < text.length && classify(text[index + 1]) === runClass) index++;
  }

  return Math.min(index, Math.max(0, text.length - 1));
}

export function clampToText(text: string, index: number): number {
  return Math.max(0, Math.min(index, Math.max(0, text.length - 1)));
}
