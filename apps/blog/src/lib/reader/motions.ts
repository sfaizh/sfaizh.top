/**
 * The motion half of a Vim grammar, expressed against a scroll container.
 *
 * Kept out of the component so the state machine — counts, the `g` prefix and
 * its timeout — can be unit-tested without a DOM.
 */

export const PREFIX_TIMEOUT_MS = 1000;

export type Motion =
  | { kind: 'line'; direction: 1 | -1 }
  | { kind: 'half-page'; direction: 1 | -1 }
  | { kind: 'page'; direction: 1 | -1 }
  | { kind: 'edge'; edge: 'top' | 'bottom' }
  | { kind: 'paragraph'; direction: 1 | -1 }
  | { kind: 'heading'; direction: 1 | -1 };

export type Action =
  | { kind: 'motion'; motion: Motion; count: number }
  | { kind: 'search-open' }
  | { kind: 'command-open' }
  | { kind: 'search-next'; direction: 1 | -1 }
  | { kind: 'help' }
  | { kind: 'quit' }
  | { kind: 'none' };

export interface PendingState {
  /** The digits typed so far — Vim's count register. */
  count: string;
  /** A multi-key prefix such as `g`, `]` or `[`, with the time it was pressed. */
  prefix: { key: string; at: number } | null;
}

export const EMPTY_PENDING: PendingState = { count: '', prefix: null };

const PREFIX_KEYS = new Set(['g', ']', '[']);

/**
 * Feed one keypress to the machine. Returns the action to perform and the new
 * pending state; the caller renders `pending` in the statusline so a
 * half-typed `10g` is never invisible.
 */
export function reduceKey(
  key: string,
  modifiers: { ctrl: boolean; shift: boolean },
  pending: PendingState,
  now = Date.now()
): { action: Action; pending: PendingState } {
  // A stale prefix is worse than no prefix: pressing `g`, walking away and
  // coming back should not teleport the reader to the top of the document.
  const prefix =
    pending.prefix && now - pending.prefix.at > PREFIX_TIMEOUT_MS ? null : pending.prefix;
  const count = pending.count === '' ? 1 : Math.min(999, Number(pending.count));

  if (modifiers.ctrl) {
    switch (key.toLowerCase()) {
      case 'd':
        return motion({ kind: 'half-page', direction: 1 }, count);
      case 'u':
        return motion({ kind: 'half-page', direction: -1 }, count);
      case 'f':
        return motion({ kind: 'page', direction: 1 }, count);
      case 'b':
        return motion({ kind: 'page', direction: -1 }, count);
      default:
        return { action: { kind: 'none' }, pending: { count: pending.count, prefix } };
    }
  }

  // Digits accumulate into the count, except a leading 0 which means "column 0".
  if (/^[0-9]$/.test(key) && !(key === '0' && pending.count === '')) {
    return { action: { kind: 'none' }, pending: { count: pending.count + key, prefix } };
  }

  if (prefix?.key === 'g' && key === 'g') return motion({ kind: 'edge', edge: 'top' }, 1);
  if (prefix?.key === ']' && key === ']') return motion({ kind: 'heading', direction: 1 }, count);
  if (prefix?.key === '[' && key === '[') return motion({ kind: 'heading', direction: -1 }, count);

  if (PREFIX_KEYS.has(key)) {
    return { action: { kind: 'none' }, pending: { count: pending.count, prefix: { key, at: now } } };
  }

  switch (key) {
    case 'j':
    case 'ArrowDown':
      return motion({ kind: 'line', direction: 1 }, count);
    case 'k':
    case 'ArrowUp':
      return motion({ kind: 'line', direction: -1 }, count);
    case 'PageDown':
    case ' ':
      return motion({ kind: 'page', direction: 1 }, count);
    case 'PageUp':
      return motion({ kind: 'page', direction: -1 }, count);
    case 'G':
    case 'End':
      return motion({ kind: 'edge', edge: 'bottom' }, 1);
    case 'Home':
      return motion({ kind: 'edge', edge: 'top' }, 1);
    case '}':
      return motion({ kind: 'paragraph', direction: 1 }, count);
    case '{':
      return motion({ kind: 'paragraph', direction: -1 }, count);
    case '/':
      return { action: { kind: 'search-open' }, pending: EMPTY_PENDING };
    case ':':
      return { action: { kind: 'command-open' }, pending: EMPTY_PENDING };
    case 'n':
      return { action: { kind: 'search-next', direction: 1 }, pending: EMPTY_PENDING };
    case 'N':
      return { action: { kind: 'search-next', direction: -1 }, pending: EMPTY_PENDING };
    case '?':
      return { action: { kind: 'help' }, pending: EMPTY_PENDING };
    case 'q':
    case 'Escape':
      return { action: { kind: 'quit' }, pending: EMPTY_PENDING };
    default:
      return { action: { kind: 'none' }, pending: EMPTY_PENDING };
  }
}

function motion(value: Motion, count: number): { action: Action; pending: PendingState } {
  return { action: { kind: 'motion', motion: value, count }, pending: EMPTY_PENDING };
}

/** How the pending state renders in the statusline: `10g`, `3`, `]`. */
export function describePending(pending: PendingState): string {
  return `${pending.count}${pending.prefix?.key ?? ''}`;
}

/** Convert a motion into a scroll delta, or an absolute target. */
export function resolveScroll(
  motion: Motion,
  count: number,
  metrics: { scrollTop: number; clientHeight: number; scrollHeight: number; lineHeight: number }
): number {
  const { scrollTop, clientHeight, scrollHeight, lineHeight } = metrics;

  switch (motion.kind) {
    case 'line':
      return scrollTop + motion.direction * lineHeight * count;
    case 'half-page':
      return scrollTop + motion.direction * (clientHeight / 2) * count;
    case 'page':
      // Vim keeps two lines of overlap so you never lose your place.
      return scrollTop + motion.direction * (clientHeight - lineHeight * 2) * count;
    case 'edge':
      return motion.edge === 'top' ? 0 : scrollHeight;
    default:
      return scrollTop;
  }
}

/**
 * What the statusline shows. `man` does not print its whole key map along the
 * bottom either — it prints the way out and the way to find everything else.
 * The full map lives behind `?`, and the short list cannot overflow into a
 * horizontal scrollbar on a narrow window.
 */
export const READER_KEYS_ESSENTIAL = [
  ['j / k', 'scroll'],
  ['/', 'search'],
  ['?', 'keys'],
  [':q', 'back'],
] as const;

/** The full map, shown in the `?` overlay. */
export const READER_KEYS = [
  ['j / k', 'line'],
  ['^D / ^U', 'half page'],
  ['^F / ^B', 'page'],
  ['gg / G', 'top / end'],
  ['{ / }', 'paragraph'],
  ['[[ / ]]', 'heading'],
  ['/', 'search'],
  ['n / N', 'next / prev match'],
  ['?', 'keys'],
  [':q', 'back to shell'],
  ['q / Esc', 'back to shell'],
] as const;
