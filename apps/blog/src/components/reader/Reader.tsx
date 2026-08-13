'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RenderedPost } from '@sfaizh/shared';
import { api } from '../../lib/api-client';
import { usePrefersReducedMotion } from '../../lib/hooks';
import { clearMatches, findMatches, paintMatches, paintSelection } from '../../lib/reader/highlight-dom';
import {
  EMPTY_PENDING,
  READER_KEYS,
  READER_KEYS_ESSENTIAL,
  describePending,
  reduceKey,
  resolveScroll,
  type PendingState,
} from '../../lib/reader/motions';
import {
  caretIndexFromPoint,
  cursorBlock,
  hasVisibleRect,
  rectForIndex,
  scrollToReveal,
  viewportRectForIndex,
  type LineRect,
} from '../../lib/reader/cursor';
import {
  buildTextMap,
  clampToText,
  flatIndexOf,
  nextWordStart,
  prevWordStart,
  rangeBetween,
  wordEnd,
  type TextMap,
} from '../../lib/reader/text-map';
import { KeyLegend, StatusLine } from '../StatusLine';
import { SmearCursor } from './SmearCursor';
import { ReaderMobileBar } from '../terminal/MobileBar';

/**
 * The pager. Opening a post leaves the terminal metaphor behind — proportional
 * type, a 75-character measure, real headings — but keeps the modal grammar
 * and the statusline that explains it.
 */

interface Props {
  slug: string;
  onQuit: () => void;
  isTouch: boolean;
}

type Mode = 'normal' | 'search' | 'command';

const WHITESPACE = /\s/;

/**
 * Breathing room left above a `{`/`}`/heading jump target. The same value has
 * to be subtracted when scrolling and added back when working out where the
 * next jump starts from, or a jump lands short of its own target and the
 * following one re-matches it.
 */
const JUMP_PAD = 12;

/** Value equality, so an unchanged measurement keeps its object identity. */
function sameRect(a: LineRect | null, b: LineRect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/** Two positions share a visual line when their rectangles share a baseline. */
function onSameLine(map: TextMap, a: number, b: number): boolean {
  const first = viewportRectForIndex(map, a);
  const second = viewportRectForIndex(map, b);
  if (!first || !second) return false;
  return Math.abs(first.top - second.top) < Math.min(first.height, second.height) * 0.6;
}

/**
 * Hit-test one line away, widening the reach if the first attempt lands in the
 * margin between two blocks rather than on text.
 */
function probeLine(map: TextMap, rect: DOMRect, direction: 1 | -1, step: number): number | null {
  const middle = rect.top + rect.height / 2;
  for (const distance of [step, step * 1.6, step * 2.4, step * 3.5]) {
    const hit = caretIndexFromPoint(map, rect.left + 1, middle + direction * distance);
    if (hit !== null) return hit;
  }
  return null;
}

/**
 * Fallback for when hit-testing cannot reach the next line — across the margin
 * below a heading, or past a figure. Walks the text until the baseline changes.
 * Slower and it loses the column, but it works off-screen and over any gap,
 * so `j` never simply stops.
 */
function scanToAdjacentLine(map: TextMap, index: number, direction: 1 | -1): number {
  const from = viewportRectForIndex(map, index);
  if (!from) return index;

  const threshold = from.height * 0.6;
  for (let step = 1; step <= 800; step++) {
    const candidate = index + direction * step;
    if (candidate < 0 || candidate >= map.text.length) break;

    const rect = viewportRectForIndex(map, candidate);
    if (!rect) continue;

    const moved = direction === 1 ? rect.top - from.top : from.top - rect.top;
    if (moved > threshold) return candidate;
  }
  return index;
}

export function Reader({ slug, onQuit, isTouch }: Props) {
  const reducedMotion = usePrefersReducedMotion();

  const [post, setPost] = useState<RenderedPost | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('normal');
  const [pending, setPending] = useState<PendingState>(EMPTY_PENDING);
  const [query, setQuery] = useState('');
  const [command, setCommand] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [committedQuery, setCommittedQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [percent, setPercent] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  const [cursor, setCursor] = useState(0);
  const [cursorRect, setCursorRect] = useState<LineRect | null>(null);
  const [visual, setVisual] = useState<{ anchor: number; linewise: boolean } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const matchesRef = useRef<Range[]>([]);
  const mapRef = useRef<TextMap | null>(null);

  // ── load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setPost(null);
    setFailure(null);

    api
      .rendered(slug)
      .then((value) => {
        if (!cancelled) setPost(value);
      })
      .catch((error: Error) => {
        if (!cancelled) setFailure(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Focus the scroll container so the motions have somewhere to land.
  useEffect(() => {
    if (post) scrollRef.current?.focus({ preventScroll: true });
  }, [post]);

  const updatePercent = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const travel = node.scrollHeight - node.clientHeight;
    setPercent(travel <= 0 ? 100 : Math.round((node.scrollTop / travel) * 100));
  }, []);

  useEffect(() => {
    updatePercent();
  }, [post, updatePercent]);

  /**
   * Momentum scrolling on a phone fires scroll events far faster than the
   * screen refreshes. Re-rendering the whole reader on each one is wasted work
   * on exactly the device that can least afford it, so the percentage is
   * recomputed at most once per frame.
   */
  const percentFrame = useRef(0);
  const onScroll = useCallback(() => {
    if (percentFrame.current) return;
    percentFrame.current = window.requestAnimationFrame(() => {
      percentFrame.current = 0;
      updatePercent();
    });
  }, [updatePercent]);

  useEffect(
    () => () => {
      if (percentFrame.current) window.cancelAnimationFrame(percentFrame.current);
    },
    []
  );

  // ── scrolling primitives ──────────────────────────────────────────────────
  const scrollTo = useCallback(
    (top: number, smooth: boolean) => {
      const node = scrollRef.current;
      if (!node) return;
      node.scrollTo({
        top: Math.max(0, Math.min(top, node.scrollHeight)),
        behavior: smooth && !reducedMotion ? 'smooth' : 'auto',
      });
    },
    [reducedMotion]
  );

  const lineHeight = useCallback(() => {
    const article = articleRef.current;
    if (!article) return 28;
    const computed = Number.parseFloat(window.getComputedStyle(article).lineHeight);
    return Number.isFinite(computed) && computed > 0 ? computed : 28;
  }, []);

  /**
   * The flat text map, rebuilt on every read.
   *
   * Caching it needs a staleness test, and there is no cheap one that is
   * correct: React re-renders the body through `dangerouslySetInnerHTML`,
   * replacing those text nodes, while the header and footer around it are
   * ordinary JSX and stay put. Probing the first or last node therefore reports
   * a healthy map whose entire middle is detached — motions past the header
   * just stop. Walking ~200 text nodes costs microseconds, so it is rebuilt
   * instead of second-guessed.
   */
  const textMap = useCallback((): TextMap | null => {
    const article = articleRef.current;
    if (!article) return null;

    const fresh = buildTextMap(article);
    mapRef.current = fresh;
    return fresh;
  }, []);

  /**
   * Put the cursor at a text position and scroll only as far as needed.
   *
   * `bias` is the direction the motion was travelling, used to step over
   * positions that render nothing — otherwise `l` at the end of a wrapped line
   * lands on a collapsed newline and appears to do nothing at all.
   */
  const moveCursorTo = useCallback(
    (index: number, smooth: boolean, bias: 1 | -1 = 1) => {
      const map = textMap();
      const container = scrollRef.current;
      if (!map || !container) return;

      let next = clampToText(map.text, index);
      for (let guard = 0; guard < 12 && !hasVisibleRect(map, next); guard++) {
        const candidate = clampToText(map.text, next + bias);
        if (candidate === next) break;
        next = candidate;
      }
      setCursor(next);

      const rect = rectForIndex(map, next, container);
      setCursorRect((prev) => (sameRect(prev, rect) ? prev : rect));
      if (!rect) return;

      const target = scrollToReveal(rect, {
        scrollTop: container.scrollTop,
        clientHeight: container.clientHeight,
      });
      if (Math.abs(target - container.scrollTop) > 1) scrollTo(target, smooth);
    },
    [scrollTo, textMap]
  );

  /** Re-measure the cursor when the text reflows underneath it. */
  const remeasure = useCallback(() => {
    const map = textMap();
    const container = scrollRef.current;
    if (!map || !container) return;
    const rect = rectForIndex(map, cursor, container);
    setCursorRect((prev) => (sameRect(prev, rect) ? prev : rect));
  }, [cursor, textMap]);

  /**
   * Keep the cursor block pinned to its character as the text reflows.
   *
   * Only on a pointer device. There is no cursor to keep pinned on a phone —
   * `SmearCursor` is not even rendered — and the observer is watching the one
   * element guaranteed to resize repeatedly while you read: the article, which
   * grows every time a lazily-loaded photograph arrives and claims its real
   * height. Each of those rebuilt the entire flat text map and re-rendered the
   * reader, mid-scroll, on the device least able to absorb it.
   */
  useEffect(() => {
    if (!post || isTouch) return;

    remeasure();
    const container = scrollRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => remeasure());
    observer.observe(container);
    if (articleRef.current) observer.observe(articleRef.current);

    return () => observer.disconnect();
  }, [isTouch, post, remeasure]);

  /**
   * "The character one line down" is a question only layout can answer in
   * proportional text, so vertical motions hit-test rather than count. When the
   * destination is off-screen there is nothing to hit, so the view is nudged
   * first and the probe retried.
   */
  const stepVertical = useCallback(
    (from: number, direction: 1 | -1, count: number): number => {
      const map = textMap();
      const container = scrollRef.current;
      if (!map || !container) return from;

      const step = lineHeight();
      let index = from;

      for (let taken = 0; taken < count; taken++) {
        let rect = viewportRectForIndex(map, index);
        if (!rect) break;

        let probe = probeLine(map, rect, direction, step);

        if (probe === null || probe === index) {
          // Either the destination is outside the viewport, or the probe landed
          // in the margin between two blocks. Nudge the view and try again.
          container.scrollTop = Math.max(0, container.scrollTop + direction * step);
          rect = viewportRectForIndex(map, index);
          if (!rect) break;
          probe = probeLine(map, rect, direction, step);
        }

        if (probe === null || probe === index) probe = scanToAdjacentLine(map, index, direction);
        if (probe === index) break;
        index = probe;
      }

      return index;
    },
    [lineHeight, textMap]
  );

  /** `0`, `^` and `$` — the ends of the *visual* line, wrapping included. */
  const lineEdgeFrom = useCallback(
    (from: number, edge: 'start' | 'first-word' | 'end'): number => {
      const map = textMap();
      const article = articleRef.current;
      if (!map || !article) return from;

      const rect = viewportRectForIndex(map, from);
      if (!rect) return from;

      const bounds = article.getBoundingClientRect();
      const middle = rect.top + rect.height / 2;
      const probe =
        edge === 'end'
          ? caretIndexFromPoint(map, bounds.right - 2, middle)
          : caretIndexFromPoint(map, bounds.left + 2, middle);

      if (probe === null) return from;

      if (edge === 'end') {
        // Hit-testing past the last glyph resolves to the *next* line's first
        // character, so walk back until we are on the line we started on.
        let index = probe;
        while (index > from && !onSameLine(map, from, index)) index--;
        return index;
      }

      if (edge !== 'first-word') return probe;

      let index = probe;
      while (index < map.text.length - 1 && WHITESPACE.test(map.text[index])) index++;
      return index;
    },
    [textMap]
  );


  /** Put the cursor on a search match and bring it into view. */
  const revealMatch = useCallback(
    (range: Range) => {
      const map = textMap();
      if (!map) return;

      const index = flatIndexOf(map, range.startContainer, range.startOffset);
      if (index === null) return;
      moveCursorTo(index, true);
    },
    [moveCursorTo, textMap]
  );

  /** Scroll so that the nth element matching `selector` sits near the top. */
  const jumpToElement = useCallback(
    (selector: string, direction: 1 | -1, count: number) => {
      const node = scrollRef.current;
      const article = articleRef.current;
      if (!node || !article) return;

      const targets = [...article.querySelectorAll<HTMLElement>(selector)];
      if (!targets.length) return;

      const offsets = targets.map((element) => element.offsetTop);

      // A jump parks its target `JUMP_PAD` below the top edge, so the search
      // for the next one has to start from where that target actually sits.
      // The extra pixel absorbs sub-pixel scroll positions.
      const anchor = node.scrollTop + JUMP_PAD;

      let index: number;
      if (direction === 1) {
        const next = offsets.findIndex((offset) => offset > anchor + 1);
        // Already past the last one: carry on to the end of the post rather
        // than jumping backwards into it.
        if (next === -1) {
          scrollTo(node.scrollHeight, true);
          return;
        }
        index = Math.min(offsets.length - 1, next + (count - 1));
      } else {
        const previous = offsets.filter((offset) => offset < anchor - 1);
        // Nothing above: the header and title are up there, so go to the top.
        if (!previous.length) {
          scrollTo(0, true);
          return;
        }
        index = Math.max(0, previous.length - count);
      }

      scrollTo(offsets[index] - JUMP_PAD, true);

      const map = mapRef.current;
      const first = targets[index].firstChild;
      const at = map && first ? flatIndexOf(map, first, 0) : null;
      if (at !== null) setCursor(at);
    },
    [scrollTo]
  );

  // ── search ────────────────────────────────────────────────────────────────
  const runSearch = useCallback(
    (needle: string) => {
      const article = articleRef.current;
      if (!article) return;

      const matches = findMatches(article, needle);
      matchesRef.current = matches;
      setMatchCount(matches.length);
      setMatchIndex(0);
      paintMatches(matches, 0);

      if (matches.length) revealMatch(matches[0]);
    },
    [revealMatch]
  );

  /**
   * Re-derive and re-paint the highlights after every commit.
   *
   * React owns the article's markup — it is rendered through
   * `dangerouslySetInnerHTML` — and re-setting that HTML replaces the text
   * nodes underneath us. A `Range` whose boundary node is removed does not
   * throw: per the DOM spec its boundary moves to the parent and the range
   * collapses, so held ranges quietly become empty and nothing paints. Ranges
   * are therefore treated as disposable and rebuilt from whatever is currently
   * in the document.
   */
  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;

    if (!committedQuery) {
      clearMatches();
      matchesRef.current = [];
      return;
    }

    const matches = findMatches(article, committedQuery);
    matchesRef.current = matches;
    paintMatches(matches, matchIndex);

    if (matches.length !== matchCount) setMatchCount(matches.length);
  });

  const stepMatch = useCallback(
    (direction: 1 | -1) => {
      const matches = matchesRef.current;
      if (!matches.length) return;

      // Derive from the previous value rather than a captured one, so `n`
      // pressed in quick succession does not repeatedly read a stale index.
      setMatchIndex((current) => {
        const next = (current + direction + matches.length) % matches.length;
        paintMatches(matches, next);
        revealMatch(matches[next]);
        return next;
      });
    },
    [revealMatch]
  );

  // Highlights are global to the document, so they must be dropped when this
  // reader goes away or moves to another post.
  useEffect(() => {
    return () => {
      clearMatches();
      paintSelection(null);
      matchesRef.current = [];
    };
  }, [slug]);

  /**
   * Vim's command line. The post footer advertises `:q`, so typing it has to
   * do something — and has to be visible while you type it.
   */
  const runCommand = useCallback(
    (entered: string) => {
      const name = entered.trim().replace(/^:/, '').toLowerCase();

      if (['q', 'q!', 'quit', 'x', 'wq', 'exit'].includes(name)) {
        onQuit();
        return;
      }
      if (['h', 'help', '?'].includes(name)) {
        setShowHelp(true);
        return;
      }
      if (name === '') return;

      setNotice(`E492: Not an editor command: ${name}`);
    },
    [onQuit]
  );

  // A message stays until it is read: the next keypress dismisses it, and it
  // times out on its own if nothing else happens.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /**
   * The selected text, expanded to whole visual lines in linewise mode. In
   * normal mode `yy` yanks the line the cursor is on.
   */
  const selectionRange = useCallback((): Range | null => {
    const map = textMap();
    if (!map) return null;

    const anchor = visual ? visual.anchor : cursor;
    const linewise = visual ? visual.linewise : true;

    let from = Math.min(anchor, cursor);
    let to = Math.max(anchor, cursor);

    if (linewise) {
      from = lineEdgeFrom(from, 'start');
      to = lineEdgeFrom(to, 'end');
    }

    return rangeBetween(map, from, Math.min(to + 1, map.text.length));
  }, [cursor, lineEdgeFrom, textMap, visual]);

  /** Copy the selection and report what happened, the way Vim does. */
  const yankSelection = useCallback(async () => {
    const range = selectionRange();
    const text = range?.toString() ?? '';

    if (!text) {
      setNotice('Nothing to yank');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      setNotice(`Yanked ${text.length} characters (${words} words)`);
    } catch {
      // Clipboard access needs a secure context and, in some browsers, a
      // gesture. Say so rather than failing silently.
      setNotice('Could not reach the clipboard');
    }
    setVisual(null);
  }, [selectionRange]);

  // Repaint the selection after every commit, for the same reason the search
  // highlights are: a Range held across a React re-render of the article
  // collapses silently, so it is rebuilt rather than remembered.
  useEffect(() => {
    paintSelection(visual ? selectionRange() : null);
  });

  // ── keyboard ──────────────────────────────────────────────────────────────
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (mode === 'command') {
        if (event.key === 'Enter') {
          event.preventDefault();
          const entered = command;
          setMode('normal');
          setCommand('');
          runCommand(entered);
          scrollRef.current?.focus({ preventScroll: true });
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setMode('normal');
          setCommand('');
          scrollRef.current?.focus({ preventScroll: true });
          return;
        }
        return;
      }

      if (mode === 'search') {
        if (event.key === 'Enter') {
          event.preventDefault();
          setMode('normal');
          setCommittedQuery(query);
          runSearch(query);
          scrollRef.current?.focus({ preventScroll: true });
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setMode('normal');
          setQuery(committedQuery);
          scrollRef.current?.focus({ preventScroll: true });
          return;
        }
        return;
      }

      if (showHelp) {
        // Any key dismisses the help overlay, matching `man`'s behaviour.
        event.preventDefault();
        setShowHelp(false);
        if (event.key === 'q' || event.key === 'Escape') return;
        return;
      }

      // Any key in normal mode dismisses a pending message, as in Vim.
      if (notice) setNotice(null);

      // Let the browser keep its own shortcuts.
      if (event.metaKey || event.altKey) return;
      if (event.ctrlKey && !['d', 'u', 'f', 'b'].includes(event.key.toLowerCase())) return;

      // In visual mode a single `y` yanks the selection; the reducer only knows
      // about `yy`, which is the normal-mode form.
      if (visual && event.key === 'y') {
        event.preventDefault();
        void yankSelection();
        return;
      }

      const { action, pending: nextPending } = reduceKey(
        event.key,
        { ctrl: event.ctrlKey, shift: event.shiftKey },
        pending
      );
      setPending(nextPending);

      if (action.kind === 'none') {
        if (nextPending.count || nextPending.prefix) event.preventDefault();
        return;
      }
      event.preventDefault();

      switch (action.kind) {
        case 'cancel': {
          // Contextual, innermost first: drop a selection, then a search, and
          // only leave the post when there is nothing left to cancel.
          if (visual) {
            setVisual(null);
            return;
          }
          if (committedQuery) {
            setCommittedQuery('');
            setQuery('');
            setMatchCount(0);
            setMatchIndex(0);
            clearMatches();
            return;
          }
          onQuit();
          return;
        }
        case 'visual': {
          setVisual((current) =>
            current && current.linewise === action.linewise ? null : { anchor: cursor, linewise: action.linewise }
          );
          return;
        }
        case 'yank': {
          void yankSelection();
          return;
        }
        case 'help':
          setShowHelp(true);
          return;
        case 'search-open':
          setNotice(null);
          setMode('search');
          setQuery('');
          return;
        case 'command-open':
          setNotice(null);
          setMode('command');
          setCommand('');
          return;
        case 'search-next':
          stepMatch(action.direction);
          return;
        case 'motion': {
          const node = scrollRef.current;
          const map = textMap();
          if (!node) return;
          const motion = action.motion;

          if (motion.kind === 'paragraph') {
            jumpToElement('p, pre, blockquote, ul, ol, figure, table', motion.direction, action.count);
            return;
          }
          if (motion.kind === 'heading') {
            jumpToElement('h1, h2, h3', motion.direction, action.count);
            return;
          }

          // Without a measurable text map there is no cursor to move, so fall
          // back to scrolling the view outright.
          if (!map || map.text.length === 0) {
            scrollTo(
              resolveScroll(motion, action.count, {
                scrollTop: node.scrollTop,
                clientHeight: node.clientHeight,
                scrollHeight: node.scrollHeight,
                lineHeight: lineHeight(),
              }),
              motion.kind !== 'line'
            );
            return;
          }

          switch (motion.kind) {
            case 'char':
              moveCursorTo(cursor + motion.direction * action.count, false, motion.direction);
              return;
            case 'word':
              moveCursorTo(
                motion.direction === 1
                  ? nextWordStart(map.text, cursor, action.count)
                  : prevWordStart(map.text, cursor, action.count),
                false,
                motion.direction
              );
              return;
            case 'word-end':
              moveCursorTo(wordEnd(map.text, cursor, action.count), false);
              return;
            case 'line-edge':
              moveCursorTo(lineEdgeFrom(cursor, motion.edge), false);
              return;
            case 'edge':
              moveCursorTo(motion.edge === 'top' ? 0 : map.text.length - 1, true);
              return;
            case 'line':
              moveCursorTo(stepVertical(cursor, motion.direction, action.count), false);
              return;
            default: {
              // Half and full pages, measured in lines of the current view.
              const perScreen = Math.max(1, Math.round(node.clientHeight / Math.max(1, lineHeight())));
              const rows =
                motion.kind === 'half-page' ? Math.max(1, Math.floor(perScreen / 2)) : Math.max(1, perScreen - 2);
              moveCursorTo(stepVertical(cursor, motion.direction, rows * action.count), true);
              return;
            }
          }
        }
      }
    },
    [
      command,
      committedQuery,
      cursor,
      jumpToElement,
      lineEdgeFrom,
      lineHeight,
      moveCursorTo,
      stepVertical,
      textMap,
      visual,
      yankSelection,
      mode,
      notice,
      onQuit,
      pending,
      query,
      runCommand,
      runSearch,
      scrollTo,
      showHelp,
      stepMatch,
    ]
  );

  const statusRight = useMemo(
    () => [
      ...(matchCount > 0
        ? [{ label: `${matchIndex + 1}/${matchCount}`, tone: 'yellow' as const }]
        : []),
      { label: `${percent}%`, tone: 'green' as const },
    ],
    [matchCount, matchIndex, percent]
  );

  const pendingLabel = describePending(pending);

  // Memoised so the smear's effect is not re-triggered by a fresh object on
  // every render — that turns each animation frame into another render, and
  // React eventually gives up with "Maximum update depth exceeded".
  const cursorBlockValue = useMemo(() => (cursorRect ? cursorBlock(cursorRect) : null), [cursorRect]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div
        ref={scrollRef}
        tabIndex={0}
        role="document"
        aria-label={post ? `${post.title} — reader` : 'Loading post'}
        onKeyDown={onKeyDown}
        onScroll={onScroll}
        className="focus-silent scroll-themed relative min-h-0 flex-1 overflow-y-auto outline-none"
        style={{ scrollBehavior: reducedMotion ? 'auto' : undefined }}
      >
        {failure && (
          <div className="mx-auto max-w-prose px-6 py-10 text-[color:var(--ctp-red)]">
            E212: Can&apos;t open file for reading — {failure}
            <div className="mt-3 text-[color:var(--ctp-overlay1)]">Press q to go back.</div>
          </div>
        )}

        {!post && !failure && (
          <div className="mx-auto max-w-prose px-6 py-10 text-[color:var(--ctp-overlay1)]">
            &quot;{slug}.md&quot; [readonly] loading…
          </div>
        )}

        {post && !isTouch && (
          <SmearCursor
            block={cursorBlockValue}
            animated={!reducedMotion}
          />
        )}

        {post && (
          <article ref={articleRef} className="prose-reader relative z-10 py-10">
            <header className="mb-10">
              <h1 className="!mt-0 text-[color:var(--ctp-text)]">{post.title}</h1>
              <p className="!mt-3 font-mono text-[0.8em] text-[color:var(--ctp-overlay1)]">
                {new Date(post.date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                {' · '}
                {post.readingMinutes} min read
                {' · '}
                {post.words.toLocaleString('en-GB')} words
                {post.tags.length ? ` · ${post.tags.join(' · ')}` : ''}
              </p>
              {post.draft && (
                <p className="!mt-2 font-mono text-[0.8em] text-[color:var(--ctp-yellow)]">
                  [draft — visible because you are signed in]
                </p>
              )}
            </header>

            {/* Rendered and sanitised on the server; see libs/shared/markdown.ts.
                The class matters: the body is a wrapper, so the article's own
                spacing rules cannot reach the paragraphs inside it. */}
            <div className="prose-body" dangerouslySetInnerHTML={{ __html: post.html }} />

            <footer className="mt-16 border-t border-[color:var(--ctp-surface0)] pt-6 font-mono text-[0.8em] text-[color:var(--ctp-overlay1)]">
              <button
                type="button"
                onClick={onQuit}
                className="text-[color:var(--ctp-yellow)] underline decoration-dotted underline-offset-4"
              >
                :q
              </button>
              <span> — back to the terminal</span>
            </footer>
          </article>
        )}

        {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
      </div>

      {isTouch && (
        <ReaderMobileBar
          onQuit={onQuit}
          onTop={() => scrollTo(0, true)}
          onBottom={() => scrollTo(scrollRef.current?.scrollHeight ?? 0, true)}
          onPrevHeading={() => jumpToElement('h1, h2, h3', -1, 1)}
          onNextHeading={() => jumpToElement('h1, h2, h3', 1, 1)}
        />
      )}

      <StatusLine
        mode={{
          label:
            mode === 'search'
              ? 'SEARCH'
              : mode === 'command'
                ? 'COMMAND'
                : visual
                  ? visual.linewise
                    ? 'V-LINE'
                    : 'VISUAL'
                  : 'NORMAL',
          tone: mode === 'normal' ? (visual ? 'blue' : 'mauve') : 'peach',
        }}
        left={[
          { label: post ? `${post.slug}.md` : `${slug}.md`, title: post?.title },
          { label: 'markdown', muted: true },
        ]}
        right={statusRight}
      >
        {mode === 'search' ? (
          <LinePrompt sigil="/" value={query} onChange={setQuery} onKeyDown={onKeyDown} label="Search within the post" />
        ) : mode === 'command' ? (
          <LinePrompt sigil=":" value={command} onChange={setCommand} onKeyDown={onKeyDown} label="Reader command" />
        ) : notice ? (
          <span className="truncate font-bold text-[color:var(--ctp-red)]">{notice}</span>
        ) : pendingLabel ? (
          <span className="font-bold text-[color:var(--ctp-yellow)]">{pendingLabel}</span>
        ) : isTouch ? (
          <span className="truncate">scroll · use the buttons above · ✕ closes</span>
        ) : (
          <KeyLegend keys={READER_KEYS_ESSENTIAL} />
        )}
      </StatusLine>
    </div>
  );
}

/** The `/` and `:` prompts — same widget, different sigil. */
function LinePrompt({
  sigil,
  value,
  onChange,
  onKeyDown,
  label,
}: {
  sigil: string;
  value: string;
  onChange: (next: string) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);

  return (
    <div className="flex w-full min-w-0 items-center gap-1 text-[color:var(--ctp-text)]">
      <span className="text-[color:var(--ctp-peach)]">{sigil}</span>
      <input
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        className="w-full min-w-0 bg-transparent outline-none"
        style={{ caretColor: 'var(--ctp-rosewater)' }}
        aria-label={label}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  );
}

function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="sticky bottom-0 left-0 right-0 z-40 mx-auto mb-4 w-[min(560px,92%)] rounded-lg border border-[color:var(--ctp-surface1)] bg-[color:var(--ctp-mantle)] p-4 font-mono text-[13px] shadow-2xl"
      role="dialog"
      aria-label="Reader keys"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-bold text-[color:var(--ctp-mauve)]">MOTIONS</span>
        <button type="button" onClick={onClose} className="text-[color:var(--ctp-overlay1)]">
          esc
        </button>
      </div>
      <dl className="grid grid-cols-[7.5rem_1fr] gap-y-1.5">
        {READER_KEYS.map(([key, label]) => (
          <div key={key} className="contents">
            <dt className="text-[color:var(--ctp-yellow)]">{key}</dt>
            <dd className="text-[color:var(--ctp-subtext1)]">{label}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[color:var(--ctp-overlay0)]">
        Counts work: 10j, 3&#125;. Any key closes this.
      </p>
    </div>
  );
}
