import {
  buildTextMap,
  clampToText,
  flatIndexOf,
  nextWordStart,
  pointAt,
  prevWordStart,
  wordEnd,
} from './text-map';

function article(html: string): HTMLElement {
  const element = document.createElement('article');
  element.innerHTML = html;
  document.body.appendChild(element);
  return element;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('buildTextMap', () => {
  it('flattens text across elements in document order', () => {
    const map = buildTextMap(article('<p>one <strong>two</strong> three</p>'));
    expect(map.text).toBe('one two three');
  });

  it('records a span per text node', () => {
    const map = buildTextMap(article('<p>ab</p><p>cd</p>'));

    expect(map.spans).toHaveLength(2);
    expect(map.spans[0]).toMatchObject({ start: 0, end: 2 });
    expect(map.spans[1]).toMatchObject({ start: 2, end: 4 });
  });

  it('is empty for an empty article', () => {
    const map = buildTextMap(article(''));
    expect(map.text).toBe('');
    expect(map.spans).toEqual([]);
  });
});

describe('pointAt / flatIndexOf', () => {
  it('round-trips a position through the DOM and back', () => {
    const map = buildTextMap(article('<p>one <strong>two</strong> three</p>'));

    // index 5 is inside "two", which lives in its own text node
    const point = pointAt(map, 5);
    if (!point) throw new Error('expected a DOM point for index 5');

    expect(point.node.nodeValue).toBe('two');
    expect(point.offset).toBe(1);
    expect(flatIndexOf(map, point.node, point.offset)).toBe(5);
  });

  it('clamps out-of-range indices instead of failing', () => {
    const map = buildTextMap(article('<p>abc</p>'));
    expect(pointAt(map, -10)?.offset).toBe(0);
    expect(pointAt(map, 999)).not.toBeNull();
  });

  it('returns null for a node it does not know', () => {
    const map = buildTextMap(article('<p>abc</p>'));
    expect(flatIndexOf(map, document.createTextNode('elsewhere'), 0)).toBeNull();
  });
});

describe('word motions', () => {
  //            0123456789...
  const text = 'the quick brown fox';

  it('w moves to the start of the next word', () => {
    expect(nextWordStart(text, 0)).toBe(4);
    expect(nextWordStart(text, 4)).toBe(10);
  });

  it('w takes a count', () => {
    expect(nextWordStart(text, 0, 2)).toBe(10);
    expect(nextWordStart(text, 0, 3)).toBe(16);
  });

  it('b moves back to the start of the previous word', () => {
    expect(prevWordStart(text, 16)).toBe(10);
    expect(prevWordStart(text, 10, 2)).toBe(0);
  });

  it('e moves to the end of the current word', () => {
    expect(wordEnd(text, 0)).toBe(2);
    expect(wordEnd(text, 2)).toBe(8);
  });

  it('treats punctuation as its own word, as Vim does', () => {
    const punctuated = 'foo.bar baz';
    expect(nextWordStart(punctuated, 0)).toBe(3);
    expect(nextWordStart(punctuated, 3)).toBe(4);
  });

  it('stops at the ends rather than running off', () => {
    expect(nextWordStart(text, text.length - 1)).toBe(text.length - 1);
    expect(prevWordStart(text, 0)).toBe(0);
    expect(wordEnd(text, text.length - 1)).toBe(text.length - 1);
  });

  it('copes with leading and repeated whitespace', () => {
    const spaced = '   alpha    beta';
    expect(nextWordStart(spaced, 0)).toBe(3);
    expect(nextWordStart(spaced, 3)).toBe(12);
  });

  it('never returns an index outside the text', () => {
    for (const start of [0, 5, 12, 18]) {
      for (const motion of [nextWordStart, prevWordStart, wordEnd]) {
        const result = motion(text, start, 9);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(text.length);
      }
    }
  });
});

describe('clampToText', () => {
  it('keeps the cursor on a real character', () => {
    expect(clampToText('abc', -1)).toBe(0);
    expect(clampToText('abc', 99)).toBe(2);
  });

  it('is zero for empty text', () => {
    expect(clampToText('', 5)).toBe(0);
  });
});
