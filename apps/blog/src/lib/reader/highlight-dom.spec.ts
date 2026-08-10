import { applyHighlights, clearHighlights, setActiveHighlight } from './highlight-dom';

function article(html: string): HTMLElement {
  const element = document.createElement('article');
  element.innerHTML = html;
  document.body.appendChild(element);
  return element;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('applyHighlights', () => {
  it('wraps every occurrence across elements', () => {
    const root = article('<p>the motion grammar</p><p>another motion here</p>');
    const marks = applyHighlights(root, 'motion');

    expect(marks).toHaveLength(2);
    expect(root.querySelectorAll('mark.reader-hit')).toHaveLength(2);
    expect(marks[0].textContent).toBe('motion');
  });

  it('matches case-insensitively but preserves the original casing', () => {
    const root = article('<p>Motion and motion</p>');
    const marks = applyHighlights(root, 'MOTION');

    expect(marks).toHaveLength(2);
    expect(marks[0].textContent).toBe('Motion');
    expect(marks[1].textContent).toBe('motion');
  });

  it('finds several matches inside one text node', () => {
    const root = article('<p>aa aa aa</p>');
    expect(applyHighlights(root, 'aa')).toHaveLength(3);
  });

  it('leaves the readable text unchanged', () => {
    const root = article('<p>the motion grammar</p>');
    applyHighlights(root, 'motion');

    expect(root.textContent).toBe('the motion grammar');
  });

  it('returns nothing for an empty query and clears any existing marks', () => {
    const root = article('<p>the motion grammar</p>');
    applyHighlights(root, 'motion');

    expect(applyHighlights(root, '   ')).toEqual([]);
    expect(root.querySelectorAll('mark')).toHaveLength(0);
  });

  it('returns nothing when there is no match', () => {
    const root = article('<p>the motion grammar</p>');
    expect(applyHighlights(root, 'zzzz')).toEqual([]);
  });

  it('replaces the previous highlights rather than nesting them', () => {
    const root = article('<p>the motion grammar of motion</p>');
    applyHighlights(root, 'motion');
    const second = applyHighlights(root, 'grammar');

    expect(second).toHaveLength(1);
    expect(root.querySelectorAll('mark')).toHaveLength(1);
    expect(root.textContent).toBe('the motion grammar of motion');
  });

  it('searches inside nested markup', () => {
    const root = article('<p>a <strong>bold motion</strong> here</p>');
    expect(applyHighlights(root, 'motion')).toHaveLength(1);
  });
});

describe('clearHighlights', () => {
  it('restores the document to plain text nodes', () => {
    const root = article('<p>the motion grammar</p>');
    applyHighlights(root, 'motion');
    clearHighlights(root);

    expect(root.innerHTML).toBe('<p>the motion grammar</p>');
    expect(root.querySelector('p')?.childNodes).toHaveLength(1);
  });

  it('is safe to call when nothing is highlighted', () => {
    const root = article('<p>text</p>');
    expect(() => clearHighlights(root)).not.toThrow();
  });
});

describe('setActiveHighlight', () => {
  it('marks exactly one hit as active', () => {
    const root = article('<p>motion motion motion</p>');
    const marks = applyHighlights(root, 'motion');

    setActiveHighlight(marks, 1);

    expect(marks[0].classList.contains('reader-hit-active')).toBe(false);
    expect(marks[1].classList.contains('reader-hit-active')).toBe(true);
    expect(root.querySelectorAll('.reader-hit-active')).toHaveLength(1);
  });

  it('moves the active class when the index changes', () => {
    const root = article('<p>motion motion</p>');
    const marks = applyHighlights(root, 'motion');

    setActiveHighlight(marks, 0);
    setActiveHighlight(marks, 1);

    expect(marks[0].classList.contains('reader-hit-active')).toBe(false);
    expect(marks[1].classList.contains('reader-hit-active')).toBe(true);
  });
});
