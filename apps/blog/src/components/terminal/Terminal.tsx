'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Line } from '../../lib/shell/output';
import { complete, inlineSuggestion } from '../../lib/shell/engine';
import type { ShellState } from '../../lib/shell/types';
import { OutputView, Prompt } from './OutputView';

/** Sentinel appended to the line when Ctrl-C is pressed. */
export const INTERRUPT = '\u0003';

export type Entry =
  | { id: number; kind: 'command'; cwd: string; text: string; exitCode: number }
  | { id: number; kind: 'output'; lines: Line[] };

interface Props {
  entries: Entry[];
  state: ShellState;
  busy: boolean;
  onRun: (input: string) => void;
  /** Focus is stolen back to the input unless the user is selecting text. */
  autoFocus?: boolean;
}

export function Terminal({ entries, state, busy, onRun, autoFocus = true }: Props) {
  const [value, setValue] = useState('');
  const [caret, setCaret] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef('');

  const suggestion = useMemo(() => inlineSuggestion(value, state), [value, state]);
  const completion = useMemo(() => complete(value, state), [value, state]);

  // Pin the scrollback to the bottom as output arrives.
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [entries, busy, menuOpen]);

  const syncCaret = useCallback(() => {
    const input = inputRef.current;
    if (input) setCaret(input.selectionStart ?? input.value.length);
  }, []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (autoFocus) focusInput();
  }, [autoFocus, focusInput, entries.length]);

  const submit = useCallback(
    (raw: string) => {
      setValue('');
      setCaret(0);
      setMenuOpen(false);
      setHistoryIndex(null);
      draftRef.current = '';
      onRun(raw);
    },
    [onRun]
  );

  const acceptSuggestion = useCallback(() => {
    if (!suggestion) return false;
    setValue(suggestion);
    setCaret(suggestion.length);
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(suggestion.length, suggestion.length));
    return true;
  }, [suggestion]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const input = event.currentTarget;

      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();

        // Ctrl-R is deliberately left to the browser so the page reloads.
        if (key === 'l') {
          event.preventDefault();
          submit('clear');
          return;
        }
        if (key === 'c') {
          // Preserve copy when there is a selection; otherwise behave like a shell.
          if (window.getSelection()?.toString()) return;
          event.preventDefault();
          submit(`${value}${INTERRUPT}`);
          return;
        }
        if (key === 'a') {
          event.preventDefault();
          input.setSelectionRange(0, 0);
          setCaret(0);
          return;
        }
        if (key === 'e') {
          event.preventDefault();
          input.setSelectionRange(value.length, value.length);
          setCaret(value.length);
          return;
        }
        if (key === 'u') {
          event.preventDefault();
          const rest = value.slice(input.selectionStart ?? 0);
          setValue(rest);
          setCaret(0);
          requestAnimationFrame(() => input.setSelectionRange(0, 0));
          return;
        }
        if (key === 'k') {
          event.preventDefault();
          const head = value.slice(0, input.selectionStart ?? 0);
          setValue(head);
          setCaret(head.length);
          return;
        }
        if (key === 'w') {
          event.preventDefault();
          const position = input.selectionStart ?? value.length;
          const head = value.slice(0, position).replace(/\S+\s*$/, '');
          const next = head + value.slice(position);
          setValue(next);
          setCaret(head.length);
          requestAnimationFrame(() => input.setSelectionRange(head.length, head.length));
          return;
        }
        return;
      }

      switch (event.key) {
        case 'Enter': {
          event.preventDefault();
          if (menuOpen && completion.candidates.length > 1) {
            applyCandidate(completion.candidates[menuIndex]);
            return;
          }
          submit(value);
          return;
        }

        case 'Tab': {
          event.preventDefault();
          if (completion.candidates.length === 0) {
            acceptSuggestion();
            return;
          }
          if (completion.candidates.length === 1) {
            applyCandidate(completion.candidates[0]);
            return;
          }
          if (!menuOpen) {
            // First Tab fills the shared prefix, exactly like zsh.
            const filled = `${completion.prefix}${completion.common}`;
            if (filled !== value) {
              setValue(filled);
              setCaret(filled.length);
              requestAnimationFrame(() => input.setSelectionRange(filled.length, filled.length));
            }
            setMenuOpen(true);
            setMenuIndex(0);
            return;
          }
          const next = (menuIndex + (event.shiftKey ? -1 : 1) + completion.candidates.length) % completion.candidates.length;
          setMenuIndex(next);
          return;
        }

        case 'Escape': {
          if (menuOpen) {
            event.preventDefault();
            setMenuOpen(false);
          }
          return;
        }

        case 'ArrowRight':
        case 'End': {
          if (caret >= value.length && suggestion) {
            event.preventDefault();
            acceptSuggestion();
          }
          return;
        }

        case 'ArrowUp': {
          event.preventDefault();
          if (menuOpen && completion.candidates.length > 1) {
            setMenuIndex((index) => (index - 1 + completion.candidates.length) % completion.candidates.length);
            return;
          }
          if (!state.history.length) return;
          const next = historyIndex === null ? state.history.length - 1 : Math.max(0, historyIndex - 1);
          if (historyIndex === null) draftRef.current = value;
          setHistoryIndex(next);
          setValueAndCaret(state.history[next]);
          return;
        }

        case 'ArrowDown': {
          event.preventDefault();
          if (menuOpen && completion.candidates.length > 1) {
            setMenuIndex((index) => (index + 1) % completion.candidates.length);
            return;
          }
          if (historyIndex === null) return;
          const next = historyIndex + 1;
          if (next >= state.history.length) {
            setHistoryIndex(null);
            setValueAndCaret(draftRef.current);
            return;
          }
          setHistoryIndex(next);
          setValueAndCaret(state.history[next]);
          return;
        }

        default:
          if (menuOpen) setMenuOpen(false);
      }

      function setValueAndCaret(next: string) {
        setValue(next);
        setCaret(next.length);
        requestAnimationFrame(() => input.setSelectionRange(next.length, next.length));
      }

      function applyCandidate(candidate: string) {
        const next = `${completion.prefix}${candidate} `;
        setValue(next);
        setCaret(next.length);
        setMenuOpen(false);
        requestAnimationFrame(() => input.setSelectionRange(next.length, next.length));
      }
    },
    [
      acceptSuggestion,
      caret,
      completion,
      historyIndex,
      menuIndex,
      menuOpen,
      onRun,
      state.history,
      submit,
      suggestion,
      value,
    ]
  );

  // The block caret sits *on* a character, terminal-style, rather than between
  // two of them. When the line ends, it borrows the first ghost character.
  const ghost = suggestion && suggestion.startsWith(value) ? suggestion.slice(value.length) : '';
  const atEnd = caret >= value.length;
  const underCaret = atEnd ? ghost.slice(0, 1) : value[caret];
  const trailingGhost = atEnd ? ghost.slice(1) : ghost;

  return (
    <div
      ref={scrollRef}
      className="scroll-themed h-full w-full overflow-y-auto px-1 pb-3 pt-2 text-[13.5px] leading-[1.62] sm:text-[14.5px]"
      onMouseUp={() => {
        // Clicking into the scrollback should not steal a text selection.
        if (!window.getSelection()?.toString()) focusInput();
      }}
    >
      {entries.map((entry) =>
        entry.kind === 'command' ? (
          <div key={entry.id} className="mt-2 flex flex-wrap items-center gap-x-2">
            <Prompt cwd={entry.cwd} exitCode={entry.exitCode} />
            <span className="text-[color:var(--ctp-text)]">{entry.text}</span>
          </div>
        ) : (
          <div key={entry.id} className="line-enter">
            <OutputView lines={entry.lines} onRun={onRun} />
          </div>
        )
      )}

      {busy && (
        <div className="mt-1 text-[color:var(--ctp-overlay1)]">
          <Spinner /> working…
        </div>
      )}

      {/* ── the live prompt ────────────────────────────────────────────── */}
      <div className="mt-2">
          <div className="flex flex-wrap items-center gap-x-2">
          <Prompt cwd={state.cwd} exitCode={state.lastExit} />

          <div className="relative min-w-0 flex-1">
            {/* The rendered line: real text, a block caret, then ghost text. */}
            <div aria-hidden="true" className="pointer-events-none whitespace-pre-wrap break-words">
              <span className="text-[color:var(--ctp-text)]">{value.slice(0, caret)}</span>
              <span className="terminal-caret">{underCaret || ' '}</span>
              <span className="text-[color:var(--ctp-text)]">{value.slice(caret + 1)}</span>
              <span className="text-[color:var(--ctp-overlay0)]">{trailingGhost}</span>
            </div>

            <input
              ref={inputRef}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setHistoryIndex(null);
                setCaret(event.target.selectionStart ?? event.target.value.length);
              }}
              onKeyDown={onKeyDown}
              onKeyUp={syncCaret}
              onClick={syncCaret}
              onSelect={syncCaret}
              onFocus={syncCaret}
              className="focus-silent absolute inset-0 h-full w-full bg-transparent text-transparent outline-none"
              style={{ caretColor: 'transparent' }}
              aria-label="Terminal input"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="go"
            />
          </div>
        </div>

        {menuOpen && completion.candidates.length > 1 && (
          <CompletionMenu candidates={completion.candidates} activeIndex={menuIndex} />
        )}
      </div>
    </div>
  );
}

function CompletionMenu({ candidates, activeIndex }: { candidates: string[]; activeIndex: number }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1 rounded-md border border-[color:var(--ctp-surface1)] bg-[color:var(--ctp-mantle)] p-1.5">
      {candidates.map((candidate, index) => (
        <span
          key={candidate}
          className="rounded px-1.5 py-0.5"
          style={{
            background: index === activeIndex ? 'var(--ctp-surface2)' : 'transparent',
            color: index === activeIndex ? 'var(--ctp-text)' : 'var(--ctp-subtext0)',
          }}
        >
          {candidate}
        </span>
      ))}
      <span className="px-1.5 py-0.5 text-[color:var(--ctp-overlay0)]">
        {candidates.length} matches · Tab cycles · Enter accepts
      </span>
    </div>
  );
}

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function Spinner() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setFrame((current) => (current + 1) % FRAMES.length), 80);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="text-[color:var(--ctp-mauve)]">{FRAMES[frame]} </span>;
}
