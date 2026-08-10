import {
  EMPTY_PENDING,
  PREFIX_TIMEOUT_MS,
  describePending,
  reduceKey,
  resolveScroll,
  type PendingState,
} from './motions';

const NO_MODS = { ctrl: false, shift: false };
const CTRL = { ctrl: true, shift: false };

function press(keys: string[], modifiers = NO_MODS, now = 1000) {
  let pending: PendingState = EMPTY_PENDING;
  let action = reduceKey(keys[0], modifiers, pending, now);
  pending = action.pending;

  for (const key of keys.slice(1)) {
    action = reduceKey(key, modifiers, pending, now);
    pending = action.pending;
  }
  return action;
}

describe('reduceKey', () => {
  it('maps j and k to single lines', () => {
    expect(press(['j']).action).toEqual({ kind: 'motion', motion: { kind: 'line', direction: 1 }, count: 1 });
    expect(press(['k']).action).toEqual({ kind: 'motion', motion: { kind: 'line', direction: -1 }, count: 1 });
  });

  it('maps the arrow keys to the same motions', () => {
    expect(press(['ArrowDown']).action).toEqual(press(['j']).action);
    expect(press(['ArrowUp']).action).toEqual(press(['k']).action);
  });

  it('accumulates a count', () => {
    const { action } = press(['1', '0', 'j']);
    expect(action).toEqual({ kind: 'motion', motion: { kind: 'line', direction: 1 }, count: 10 });
  });

  it('shows the pending count in the statusline', () => {
    const first = reduceKey('1', NO_MODS, EMPTY_PENDING);
    expect(first.action.kind).toBe('none');
    expect(describePending(first.pending)).toBe('1');
  });

  it('treats a leading zero as a key rather than a count', () => {
    const { pending } = reduceKey('0', NO_MODS, EMPTY_PENDING);
    expect(pending.count).toBe('');
  });

  it('caps a runaway count', () => {
    const { action } = press(['9', '9', '9', '9', '9', 'j']);
    expect(action).toMatchObject({ count: 999 });
  });

  it('handles the gg prefix', () => {
    expect(press(['g', 'g']).action).toEqual({
      kind: 'motion',
      motion: { kind: 'edge', edge: 'top' },
      count: 1,
    });
  });

  it('expires a stale prefix rather than acting on it', () => {
    const first = reduceKey('g', NO_MODS, EMPTY_PENDING, 1000);
    const second = reduceKey('g', NO_MODS, first.pending, 1000 + PREFIX_TIMEOUT_MS + 1);

    expect(second.action.kind).toBe('none');
    expect(second.pending.prefix?.key).toBe('g');
  });

  it('handles heading prefixes in both directions', () => {
    expect(press([']', ']']).action).toEqual({
      kind: 'motion',
      motion: { kind: 'heading', direction: 1 },
      count: 1,
    });
    expect(press(['[', '[']).action).toEqual({
      kind: 'motion',
      motion: { kind: 'heading', direction: -1 },
      count: 1,
    });
  });

  it('combines a count with a heading jump', () => {
    expect(press(['3', ']', ']']).action).toMatchObject({ count: 3 });
  });

  it('maps the control pairs to half and full pages', () => {
    expect(press(['d'], CTRL).action).toMatchObject({ motion: { kind: 'half-page', direction: 1 } });
    expect(press(['u'], CTRL).action).toMatchObject({ motion: { kind: 'half-page', direction: -1 } });
    expect(press(['f'], CTRL).action).toMatchObject({ motion: { kind: 'page', direction: 1 } });
    expect(press(['b'], CTRL).action).toMatchObject({ motion: { kind: 'page', direction: -1 } });
  });

  it('ignores unrelated control combinations', () => {
    expect(press(['s'], CTRL).action.kind).toBe('none');
  });

  it('maps G and Home/End to the document edges', () => {
    expect(press(['G']).action).toMatchObject({ motion: { kind: 'edge', edge: 'bottom' } });
    expect(press(['Home']).action).toMatchObject({ motion: { kind: 'edge', edge: 'top' } });
  });

  it('maps braces to paragraphs', () => {
    expect(press(['}']).action).toMatchObject({ motion: { kind: 'paragraph', direction: 1 } });
    expect(press(['{']).action).toMatchObject({ motion: { kind: 'paragraph', direction: -1 } });
  });

  it('maps the horizontal motions', () => {
    expect(press(['h']).action).toEqual({ kind: 'motion', motion: { kind: 'char', direction: -1 }, count: 1 });
    expect(press(['l']).action).toEqual({ kind: 'motion', motion: { kind: 'char', direction: 1 }, count: 1 });
    expect(press(['3', 'l']).action).toMatchObject({ count: 3 });
  });

  it('maps the word motions', () => {
    expect(press(['w']).action).toEqual({ kind: 'motion', motion: { kind: 'word', direction: 1 }, count: 1 });
    expect(press(['b']).action).toEqual({ kind: 'motion', motion: { kind: 'word', direction: -1 }, count: 1 });
    expect(press(['e']).action).toEqual({ kind: 'motion', motion: { kind: 'word-end' }, count: 1 });
    expect(press(['2', 'w']).action).toMatchObject({ count: 2 });
  });

  it('maps the line edges', () => {
    expect(press(['0']).action).toMatchObject({ motion: { kind: 'line-edge', edge: 'start' } });
    expect(press(['^']).action).toMatchObject({ motion: { kind: 'line-edge', edge: 'first-word' } });
    expect(press(['$']).action).toMatchObject({ motion: { kind: 'line-edge', edge: 'end' } });
  });

  it('still treats a digit after a count as part of the count', () => {
    // `10` is a count; a bare `0` is the motion to the start of the line.
    expect(press(['1', '0', 'j']).action).toMatchObject({ count: 10 });
  });

  it('enters visual and visual-line mode', () => {
    expect(press(['v']).action).toEqual({ kind: 'visual', linewise: false });
    expect(press(['V']).action).toEqual({ kind: 'visual', linewise: true });
  });

  it('yanks on yy, and waits after a lone y', () => {
    const first = reduceKey('y', NO_MODS, EMPTY_PENDING);
    expect(first.action.kind).toBe('none');
    expect(first.pending.prefix?.key).toBe('y');
    expect(press(['y', 'y']).action).toEqual({ kind: 'yank' });
  });

  it('treats q and Escape as cancel, leaving the reader to decide what that means', () => {
    expect(press(['q']).action).toEqual({ kind: 'cancel' });
    expect(press(['Escape']).action).toEqual({ kind: 'cancel' });
  });

  it('opens the command line on :', () => {
    expect(press([':']).action).toEqual({ kind: 'command-open' });
  });

  it('maps search and help', () => {
    expect(press(['/']).action).toEqual({ kind: 'search-open' });
    expect(press(['n']).action).toEqual({ kind: 'search-next', direction: 1 });
    expect(press(['N']).action).toEqual({ kind: 'search-next', direction: -1 });
    expect(press(['?']).action).toEqual({ kind: 'help' });
  });

  it('clears a pending count when an unmapped key arrives', () => {
    const counted = reduceKey('5', NO_MODS, EMPTY_PENDING);
    const cleared = reduceKey('z', NO_MODS, counted.pending);
    expect(cleared.pending).toEqual(EMPTY_PENDING);
  });
});

describe('resolveScroll', () => {
  const metrics = { scrollTop: 500, clientHeight: 800, scrollHeight: 5000, lineHeight: 25 };

  it('moves by whole lines', () => {
    expect(resolveScroll({ kind: 'line', direction: 1 }, 4, metrics)).toBe(600);
    expect(resolveScroll({ kind: 'line', direction: -1 }, 4, metrics)).toBe(400);
  });

  it('moves by half a viewport', () => {
    expect(resolveScroll({ kind: 'half-page', direction: 1 }, 1, metrics)).toBe(900);
  });

  it('keeps two lines of overlap when paging', () => {
    expect(resolveScroll({ kind: 'page', direction: 1 }, 1, metrics)).toBe(500 + 800 - 50);
  });

  it('jumps to the document edges', () => {
    expect(resolveScroll({ kind: 'edge', edge: 'top' }, 1, metrics)).toBe(0);
    expect(resolveScroll({ kind: 'edge', edge: 'bottom' }, 1, metrics)).toBe(5000);
  });

  it('leaves element-relative motions to the caller', () => {
    expect(resolveScroll({ kind: 'heading', direction: 1 }, 1, metrics)).toBe(500);
  });
});

describe('describePending', () => {
  it('renders count and prefix together', () => {
    expect(describePending({ count: '10', prefix: { key: 'g', at: 0 } })).toBe('10g');
    expect(describePending(EMPTY_PENDING)).toBe('');
  });
});
