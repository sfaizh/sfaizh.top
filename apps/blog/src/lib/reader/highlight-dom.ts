/**
 * `/`-search highlighting for the reader.
 *
 * The rendered post is real DOM — real headings, real landmarks — so search
 * works by wrapping matched text nodes in `<mark>` rather than by re-rendering
 * HTML with markers baked in. That keeps the document accessible and means a
 * search never invalidates the reader's scroll position.
 */

const MARK_ATTRIBUTE = 'data-reader-hit';

export function clearHighlights(root: HTMLElement): void {
  const marks = root.querySelectorAll(`mark[${MARK_ATTRIBUTE}]`);
  marks.forEach((mark) => {
    mark.replaceWith(document.createTextNode(mark.textContent ?? ''));
  });
  // Re-join the text nodes the unwrapping left behind.
  root.normalize();
}

/**
 * Wrap every case-insensitive occurrence of `query`. Returns the marks in
 * document order so `n` / `N` can step through them.
 */
export function applyHighlights(root: HTMLElement, query: string): HTMLElement[] {
  clearHighlights(root);
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      // Never search inside code we are about to re-colour, or inside marks.
      if (parent.closest('mark')) return NodeFilter.FILTER_REJECT;
      return node.nodeValue && node.nodeValue.trim().length > 0
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const targets: Text[] = [];
  while (walker.nextNode()) targets.push(walker.currentNode as Text);

  const marks: HTMLElement[] = [];
  for (const node of targets) {
    let current: Text | null = node;

    while (current) {
      const value = current.nodeValue ?? '';
      const index = value.toLowerCase().indexOf(needle);
      if (index === -1) break;

      const matched = current.splitText(index);
      const rest = matched.splitText(needle.length);

      const mark = document.createElement('mark');
      mark.setAttribute(MARK_ATTRIBUTE, '');
      mark.className = 'reader-hit';
      matched.replaceWith(mark);
      mark.appendChild(matched);
      marks.push(mark);

      current = rest;
    }
  }

  return marks;
}

export function setActiveHighlight(marks: HTMLElement[], activeIndex: number): void {
  marks.forEach((mark, index) => {
    mark.classList.toggle('reader-hit-active', index === activeIndex);
  });
}
