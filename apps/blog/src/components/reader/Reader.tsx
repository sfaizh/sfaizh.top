'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RenderedPost } from '@sfaizh/shared';
import { api } from '../../lib/api-client';
import { usePrefersReducedMotion } from '../../lib/hooks';
import { clearMatches, findMatches, paintMatches, rangeOffsetTop } from '../../lib/reader/highlight-dom';
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
  clampIndex,
  collectLineRects,
  cursorBlock,
  nearestLineIndex,
  scrollToReveal,
  type LineRect,
} from '../../lib/reader/cursor';
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

  const [lines, setLines] = useState<LineRect[]>([]);
  const [cursorIndex, setCursorIndex] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const matchesRef = useRef<Range[]>([]);
  const linesRef = useRef<LineRect[]>([]);

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
   * The cursor indexes into the article's line boxes, so they have to be
   * re-measured whenever the text could have reflowed: a new post, a resize, a
   * late-loading font or image.
   */
  const measureLines = useCallback(() => {
    const article = articleRef.current;
    const container = scrollRef.current;
    if (!article || !container) return;

    const measured = collectLineRects(article, container);
    linesRef.current = measured;
    setLines(measured);
    setCursorIndex((index) => clampIndex(index, measured.length));
  }, []);

  useEffect(() => {
    if (!post) return;

    measureLines();
    const container = scrollRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => measureLines());
    observer.observe(container);
    if (articleRef.current) observer.observe(articleRef.current);

    return () => observer.disconnect();
  }, [post, measureLines]);

  /** Put the cursor on a line and scroll only as far as needed to see it. */
  const moveCursorTo = useCallback(
    (index: number, smooth: boolean) => {
      const container = scrollRef.current;
      if (!container || lines.length === 0) return;

      const next = clampIndex(index, lines.length);
      setCursorIndex(next);

      const target = scrollToReveal(lines[next], {
        scrollTop: container.scrollTop,
        clientHeight: container.clientHeight,
      });
      if (Math.abs(target - container.scrollTop) > 1) scrollTo(target, smooth);
    },
    [lines, scrollTo]
  );


  /** Put the cursor on the line holding a search match, and show it. */
  const revealMatch = useCallback(
    (range: Range) => {
      const container = scrollRef.current;
      if (!container) return;

      const top = rangeOffsetTop(range, container);
      if (lines.length === 0) {
        scrollTo(top - container.clientHeight / 3, true);
        return;
      }
      moveCursorTo(nearestLineIndex(lines, top), true);
    },
    [lines, moveCursorTo, scrollTo]
  );

  /** Scroll so that the nth element matching `selector` sits near the top. */
  const jumpToElement = useCallback(
    (selector: string, direction: 1 | -1, count: number) => {
      const node = scrollRef.current;
      const article = articleRef.current;
      if (!node || !article) return;

      const targets = [...article.querySelectorAll<HTMLElement>(selector)];
      if (!targets.length) return;

      const anchor = node.scrollTop + 4;
      const offsets = targets.map((element) => element.offsetTop);

      let index: number;
      if (direction === 1) {
        index = offsets.findIndex((offset) => offset > anchor);
        if (index === -1) index = offsets.length - 1;
        index = Math.min(offsets.length - 1, index + (count - 1));
      } else {
        const previous = offsets.filter((offset) => offset < anchor - 4);
        index = Math.max(0, previous.length - count);
      }

      scrollTo(offsets[index] - 12, true);
      setCursorIndex((current) =>
        linesRef.current.length ? nearestLineIndex(linesRef.current, offsets[index] + 8) : current
      );
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
        case 'quit':
          onQuit();
          return;
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

          // Before the line boxes have been measured there is no cursor to
          // move, so fall back to scrolling the view outright.
          if (lines.length === 0) {
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

          if (motion.kind === 'edge') {
            moveCursorTo(motion.edge === 'top' ? 0 : lines.length - 1, true);
            return;
          }

          const perScreen = Math.max(1, Math.round(node.clientHeight / Math.max(1, lineHeight())));
          const step =
            motion.kind === 'line'
              ? 1
              : motion.kind === 'half-page'
                ? Math.max(1, Math.floor(perScreen / 2))
                : Math.max(1, perScreen - 2);

          // Single-line moves stay instant; jumps get eased.
          moveCursorTo(cursorIndex + motion.direction * step * action.count, motion.kind !== 'line');
          return;
        }
      }
    },
    [
      command,
      committedQuery,
      cursorIndex,
      jumpToElement,
      lineHeight,
      lines,
      moveCursorTo,
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
            block={lines.length ? cursorBlock(lines[clampIndex(cursorIndex, lines.length)]) : null}
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

            {/* Rendered and sanitised on the server; see libs/shared/markdown.ts */}
            <div dangerouslySetInnerHTML={{ __html: post.html }} />

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
          label: mode === 'search' ? 'SEARCH' : mode === 'command' ? 'COMMAND' : 'NORMAL',
          tone: mode === 'normal' ? 'mauve' : 'peach',
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
