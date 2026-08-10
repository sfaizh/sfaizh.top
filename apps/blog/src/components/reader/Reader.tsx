'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RenderedPost } from '@sfaizh/shared';
import { api } from '../../lib/api-client';
import { usePrefersReducedMotion } from '../../lib/hooks';
import { applyHighlights, clearHighlights, setActiveHighlight } from '../../lib/reader/highlight-dom';
import {
  EMPTY_PENDING,
  READER_KEYS,
  describePending,
  reduceKey,
  resolveScroll,
  type PendingState,
} from '../../lib/reader/motions';
import { KeyLegend, StatusLine } from '../StatusLine';
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

type Mode = 'normal' | 'search';

export function Reader({ slug, onQuit, isTouch }: Props) {
  const reducedMotion = usePrefersReducedMotion();

  const [post, setPost] = useState<RenderedPost | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('normal');
  const [pending, setPending] = useState<PendingState>(EMPTY_PENDING);
  const [query, setQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [percent, setPercent] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const marksRef = useRef<HTMLElement[]>([]);

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
    },
    [scrollTo]
  );

  // ── search ────────────────────────────────────────────────────────────────
  const runSearch = useCallback(
    (needle: string) => {
      const article = articleRef.current;
      if (!article) return;

      const marks = applyHighlights(article, needle);
      marksRef.current = marks;
      setMatchCount(marks.length);
      setMatchIndex(0);

      if (marks.length) {
        setActiveHighlight(marks, 0);
        const node = scrollRef.current;
        if (node) scrollTo(marks[0].offsetTop - node.clientHeight / 3, true);
      }
    },
    [scrollTo]
  );

  const stepMatch = useCallback(
    (direction: 1 | -1) => {
      const marks = marksRef.current;
      if (!marks.length) return;

      const next = (matchIndex + direction + marks.length) % marks.length;
      setMatchIndex(next);
      setActiveHighlight(marks, next);
      const node = scrollRef.current;
      if (node) scrollTo(marks[next].offsetTop - node.clientHeight / 3, true);
    },
    [matchIndex, scrollTo]
  );

  // Drop highlights when the post changes.
  useEffect(() => {
    return () => {
      const article = articleRef.current;
      if (article) clearHighlights(article);
      marksRef.current = [];
    };
  }, [slug]);

  // ── keyboard ──────────────────────────────────────────────────────────────
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
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
          setMode('search');
          setQuery('');
          return;
        case 'search-next':
          stepMatch(action.direction);
          return;
        case 'motion': {
          const node = scrollRef.current;
          if (!node) return;

          if (action.motion.kind === 'paragraph') {
            jumpToElement('p, pre, blockquote, ul, ol, figure, table', action.motion.direction, action.count);
            return;
          }
          if (action.motion.kind === 'heading') {
            jumpToElement('h1, h2, h3', action.motion.direction, action.count);
            return;
          }

          const target = resolveScroll(action.motion, action.count, {
            scrollTop: node.scrollTop,
            clientHeight: node.clientHeight,
            scrollHeight: node.scrollHeight,
            lineHeight: lineHeight(),
          });
          // Single-line moves stay instant; jumps get eased.
          scrollTo(target, action.motion.kind !== 'line');
          return;
        }
      }
    },
    [
      committedQuery,
      jumpToElement,
      lineHeight,
      mode,
      onQuit,
      pending,
      query,
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
        onScroll={updatePercent}
        className="scroll-themed relative min-h-0 flex-1 overflow-y-auto outline-none"
        style={{ scrollBehavior: reducedMotion ? 'auto' : undefined, WebkitOverflowScrolling: 'touch' }}
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

        {post && (
          <article ref={articleRef} className="prose-reader py-10">
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
        mode={{ label: mode === 'search' ? 'SEARCH' : 'NORMAL', tone: mode === 'search' ? 'peach' : 'mauve' }}
        left={[
          { label: post ? `${post.slug}.md` : `${slug}.md`, title: post?.title },
          { label: 'markdown', muted: true },
        ]}
        right={statusRight}
      >
        {mode === 'search' ? (
          <SearchPrompt value={query} onChange={setQuery} onKeyDown={onKeyDown} />
        ) : pendingLabel ? (
          <span className="font-bold text-[color:var(--ctp-yellow)]">{pendingLabel}</span>
        ) : isTouch ? (
          <span className="truncate">scroll · use the buttons above · ✕ closes</span>
        ) : (
          <KeyLegend keys={READER_KEYS} />
        )}
      </StatusLine>
    </div>
  );
}

function SearchPrompt({
  value,
  onChange,
  onKeyDown,
}: {
  value: string;
  onChange: (next: string) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);

  return (
    <div className="flex w-full items-center gap-1 text-[color:var(--ctp-text)]">
      <span className="text-[color:var(--ctp-peach)]">/</span>
      <input
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        className="w-full bg-transparent outline-none"
        style={{ caretColor: 'var(--ctp-rosewater)' }}
        aria-label="Search within the post"
        autoComplete="off"
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
