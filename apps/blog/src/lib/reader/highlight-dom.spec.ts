import { clearMatches, findMatches, paintMatches, supportsHighlights } from './highlight-dom';

/**
 * `findMatches` is the part that has to be right — the painting is delegated
 * to the browser's highlight registry, which jsdom does not implement, so the
 * tests here assert on the ranges and that painting degrades quietly.
 */

function article(html: string): HTMLElement {
  const element = document.createElement('article');
  element.innerHTML = html;
  document.body.appendChild(element);
  return element;
}

const texts = (ranges: Range[]) => ranges.map((range) => range.toString());

afterEach(() => {
  document.body.innerHTML = '';
});

describe('findMatches', () => {
  it('finds every occurrence across elements, in document order', () => {
    const root = article('<p>the motion grammar</p><p>another motion here</p>');
    const ranges = findMatches(root, 'motion');

    expect(ranges).toHaveLength(2);
    expect(texts(ranges)).toEqual(['motion', 'motion']);
  });

  it('matches case-insensitively but selects the original text', () => {
    const root = article('<p>Motion and motion</p>');
    expect(texts(findMatches(root, 'MOTION'))).toEqual(['Motion', 'motion']);
  });

  it('finds several matches inside one text node without overlapping', () => {
    const root = article('<p>aaaa</p>');
    const ranges = findMatches(root, 'aa');

    expect(ranges).toHaveLength(2);
    expect(ranges[0].startOffset).toBe(0);
    expect(ranges[1].startOffset).toBe(2);
  });

  it('searches inside nested markup', () => {
    const root = article('<p>a <strong>bold motion</strong> here</p>');
    expect(findMatches(root, 'motion')).toHaveLength(1);
  });

  it('returns nothing for an empty or whitespace query', () => {
    const root = article('<p>the motion grammar</p>');
    expect(findMatches(root, '')).toEqual([]);
    expect(findMatches(root, '   ')).toEqual([]);
  });

  it('returns nothing when there is no match', () => {
    expect(findMatches(article('<p>the motion grammar</p>'), 'zzzz')).toEqual([]);
  });

  it('leaves the document completely untouched', () => {
    const root = article('<p>the motion grammar</p>');
    const before = root.innerHTML;

    findMatches(root, 'motion');

    // The whole point of the range-based approach: nothing is inserted.
    expect(root.innerHTML).toBe(before);
    expect(root.querySelectorAll('mark')).toHaveLength(0);
  });

  it('produces ranges that survive being re-read', () => {
    const root = article('<p>the motion grammar</p>');
    const [range] = findMatches(root, 'motion');

    expect(range.toString()).toBe('motion');
    expect(range.toString()).toBe('motion');
  });
});

describe('painting', () => {
  it('degrades quietly where the highlight registry is unavailable', () => {
    const root = article('<p>motion</p>');
    const ranges = findMatches(root, 'motion');

    // jsdom implements neither `CSS.highlights` nor `Highlight`.
    expect(supportsHighlights()).toBe(false);
    expect(() => paintMatches(ranges, 0)).not.toThrow();
    expect(() => clearMatches()).not.toThrow();
  });
});
