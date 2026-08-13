'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { STORAGE_KEYS, type PostMeta, type SiteStats } from '@sfaizh/shared';
import { api } from '../lib/api-client';
import { useClock, useFlavour, useIsTouch, useMotion } from '../lib/hooks';
import { readJson, readLocal, writeJson, writeLocal } from '../lib/storage';
import { ADMIN_COMMAND, bannerLines } from '../lib/shell/commands';
import { runCommand } from '../lib/shell/engine';
import { dim, error, type Line } from '../lib/shell/output';
import type { Effect, ShellState } from '../lib/shell/types';
import { HOME, buildFilesystem } from '../lib/shell/vfs';
import { BootSequence } from './BootSequence';
import { Reader } from './reader/Reader';
import { SplitFlapHeader } from './SplitFlapHeader';
import { KeyLegend, StatusLine } from './StatusLine';
import { INTERRUPT, Terminal, type Entry } from './terminal/Terminal';
import { MobileBar } from './terminal/MobileBar';

type Mode = 'boot' | 'shell' | 'reader';

const MAX_HISTORY = 200;

const SHELL_KEYS = [
  ['help', 'commands'],
  ['posts', 'the archive'],
  ['open <slug>', 'read'],
  ['theme', 'colours'],
  [ADMIN_COMMAND, 'admin'],
] as const;

/**
 * The whole site, in one client component.
 *
 * It owns the three things that outlive any single command — the mode, the
 * scrollback and the post index — and hands them down. Commands themselves are
 * pure functions in `lib/shell`; everything they want to change about the world
 * comes back as an `Effect` that is applied here.
 */
export function Shell() {
  const router = useRouter();
  const pathname = usePathname();
  const isTouch = useIsTouch();
  const { reduced: reducedMotion, preference: motion, setPreference: setMotion } = useMotion();
  const clock = useClock();
  const [flavour, setFlavour] = useFlavour();

  // `open` navigates to /posts/<slug>, and that is a different route segment —
  // React unmounts this component and mounts a fresh one. The deep link is
  // therefore read during render rather than in an effect, so the new instance
  // starts *in* the reader instead of starting in the terminal and being moved
  // there afterwards by an effect that another effect can still overrule.
  const deepLinkSlug = pathname?.match(/^\/posts\/([^/]+)$/)?.[1] ?? null;

  const [mode, setMode] = useState<Mode>(deepLinkSlug ? 'reader' : 'boot');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [cwd, setCwd] = useState(HOME);
  const [lastExit, setLastExit] = useState(0);
  const [busy, setBusy] = useState(false);
  const [readerSlug, setReaderSlug] = useState<string | null>(deepLinkSlug);
  const [loadError, setLoadError] = useState<string | null>(null);

  const nextId = useRef(0);
  const takeId = () => ++nextId.current;

  // The banner is printed once per boot, not every time the scrollback empties
  // — otherwise `clear` would immediately paint it back.
  const bannerPrinted = useRef(false);
  const errorReported = useRef(false);

  // ── bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setHistory(readJson<string[]>(STORAGE_KEYS.history, []));
    // Arriving straight at a post counts as having booted, so quitting back to
    // the terminal does not replay the animation.
    if (deepLinkSlug) writeLocal(STORAGE_KEYS.booted, '1');
  }, [deepLinkSlug]);

  /**
   * Skip the boot animation when it has already been seen, or when the reader
   * has asked for stillness.
   *
   * `reducedMotion` is a dependency because it is not known on the first
   * render: `useMediaQuery` starts at `false` for SSR and syncs in an effect.
   * That makes this effect run a second time the moment the query resolves —
   * which on a phone is routine, since iOS reports `prefers-reduced-motion`
   * whenever Low Power Mode is on. The `mode === 'boot'` guard is what keeps
   * that second run from throwing an open post back to the terminal.
   */
  useEffect(() => {
    if (mode !== 'boot') return;
    if (readLocal(STORAGE_KEYS.booted) === '1' || reducedMotion) setMode('shell');
  }, [mode, reducedMotion]);

  // The index is fetched once, during the boot animation, and then cached.
  useEffect(() => {
    Promise.all([api.listPosts(), api.stats()])
      .then(([loadedPosts, loadedStats]) => {
        setPosts(loadedPosts);
        setStats(loadedStats);
      })
      .catch((cause: Error) => setLoadError(cause.message));
  }, []);

  /**
   * Follow the URL when it moves under us — history navigation, or one post
   * linking to another. The initial value is already in state, so this only has
   * to react to *changes*, and `consumedSlug` is what makes that distinction:
   * without it, quitting would re-open the post it just closed, because
   * `readerSlug` is cleared a beat before the pathname catches up.
   */
  const consumedSlug = useRef(deepLinkSlug);
  useEffect(() => {
    if (!deepLinkSlug || deepLinkSlug === consumedSlug.current) return;
    consumedSlug.current = deepLinkSlug;
    setMode('reader');
    setReaderSlug(deepLinkSlug);
  }, [deepLinkSlug]);

  // The terminal/reader content sits in a centered column narrower than the
  // viewport (`--terminal-width`), but `body` has `overflow: hidden` so
  // nothing under the cursor scrolls out in the side gutters. Forward wheel
  // input from anywhere on the page to whichever `.scroll-themed` pane is
  // actually mounted, so scrolling works no matter where the cursor is.
  useEffect(() => {
    function handleWheel(event: WheelEvent) {
      if (event.ctrlKey) return; // pinch-to-zoom gesture — leave it alone
      const scrollEl = document.querySelector<HTMLElement>('#terminal-surface .scroll-themed');
      if (!scrollEl || scrollEl.contains(event.target as Node)) return;
      scrollEl.scrollTop += event.deltaY;
      event.preventDefault();
    }
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  const fs = useMemo(() => buildFilesystem(posts), [posts]);

  const state: ShellState = useMemo(
    () => ({ cwd, posts, fs, history, flavour, stats, lastExit, reducedMotion, motion }),
    [cwd, posts, fs, history, flavour, stats, lastExit, reducedMotion, motion]
  );

  const push = useCallback((lines: Line[]) => {
    if (!lines.length) return;
    setEntries((current) => [...current, { id: takeId(), kind: 'output', lines }]);
  }, []);

  // Print the welcome banner once the shell takes over from the boot sequence.
  const bootDone = useCallback(() => {
    writeLocal(STORAGE_KEYS.booted, '1');
    setMode('shell');
  }, []);

  useEffect(() => {
    if (mode !== 'shell' || bannerPrinted.current) return;
    bannerPrinted.current = true;
    push(bannerLines());
  }, [mode, push]);

  // Reported separately: the index request can fail after the banner is drawn,
  // and a failure that arrives late still deserves to be visible.
  useEffect(() => {
    if (mode !== 'shell' || !loadError || errorReported.current) return;
    errorReported.current = true;
    push([
      ...error(`sfsh: could not reach the API — ${loadError}`),
      ...dim('the shell still works; `posts` will be empty until it recovers'),
    ]);
  }, [mode, push, loadError]);

  // ── effects ───────────────────────────────────────────────────────────────
  const applyEffects = useCallback(
    (effects: Effect[]) => {
      for (const effect of effects) {
        switch (effect.type) {
          case 'clear':
            setEntries([]);
            break;
          case 'cd':
            setCwd(effect.path);
            break;
          case 'flavour':
            setFlavour(effect.flavour);
            break;
          case 'motion':
            setMotion(effect.preference);
            break;
          case 'open':
            consumedSlug.current = effect.slug;
            setReaderSlug(effect.slug);
            setMode('reader');
            router.replace(`/posts/${effect.slug}`);
            break;
          case 'navigate':
            router.push(effect.href);
            break;
          case 'reboot':
            setEntries([]);
            bannerPrinted.current = false;
            setMode('boot');
            break;
          default:
            break;
        }
      }
    },
    [router, setFlavour, setMotion]
  );

  // ── the run loop ──────────────────────────────────────────────────────────
  const run = useCallback(
    async (input: string) => {
      const interrupted = input.endsWith(INTERRUPT);
      const text = interrupted ? input.slice(0, -INTERRUPT.length) : input;

      setEntries((current) => [
        ...current,
        {
          id: takeId(),
          kind: 'command',
          cwd,
          text: interrupted ? `${text}^C` : text,
          exitCode: lastExit,
        },
      ]);

      if (interrupted) {
        setLastExit(130);
        return;
      }
      if (!text.trim()) return;

      setHistory((current) => {
        // Consecutive duplicates are noise; zsh's HIST_IGNORE_DUPS agrees.
        const next = current[current.length - 1] === text ? current : [...current, text];
        const trimmed = next.slice(-MAX_HISTORY);
        writeJson(STORAGE_KEYS.history, trimmed);
        return trimmed;
      });

      setBusy(true);
      try {
        const result = await runCommand(text, { ...state, history: [...history, text] });
        push(result.lines);
        setLastExit(result.exitCode);
        if (result.effects?.length) applyEffects(result.effects);
      } finally {
        setBusy(false);
      }
    },
    [applyEffects, cwd, history, lastExit, push, state]
  );

  const quitReader = useCallback(() => {
    consumedSlug.current = null;
    setMode('shell');
    setReaderSlug(null);
    router.replace('/');
  }, [router]);

  // ── render ────────────────────────────────────────────────────────────────
  const promptPath = cwd.replace(HOME, '~');

  return (
    <div className={`flex h-[100dvh] w-full flex-col overflow-hidden ${reducedMotion || isTouch ? '' : 'crt'}`}>
      <a href="#terminal-surface" className="skip-link">
        Skip to the terminal
      </a>

      <div className="shrink-0 border-b border-[color:var(--ctp-surface0)] bg-[color:var(--ctp-mantle)] py-3">
        <SplitFlapHeader />
      </div>

      <main
        id="terminal-surface"
        className="mx-auto flex min-h-0 w-[var(--terminal-width)] flex-1 flex-col overflow-hidden"
      >
        {mode === 'boot' && <BootSequence onDone={bootDone} />}

        {mode === 'shell' && (
          <Terminal entries={entries} state={state} busy={busy} onRun={run} autoFocus={!isTouch} />
        )}

        {mode === 'reader' && readerSlug && (
          <Reader slug={readerSlug} onQuit={quitReader} isTouch={isTouch} />
        )}
      </main>

      {mode !== 'reader' && (
        <>
          {isTouch && mode === 'shell' && <MobileBar onRun={run} />}
          <StatusLine
            mode={{ label: mode === 'boot' ? 'BOOT' : 'SHELL', tone: mode === 'boot' ? 'peach' : 'green' }}
            left={[
              { label: `0:sfsh${mode === 'shell' ? '*' : ''}` },
              { label: promptPath, muted: true },
            ]}
            right={[
              { label: `catppuccin-${flavour}`, muted: true },
              { label: clock, tone: 'mauve' },
            ]}
          >
            {isTouch ? (
              <span className="truncate">tap a command above, or type below</span>
            ) : (
              <KeyLegend keys={SHELL_KEYS} />
            )}
          </StatusLine>
        </>
      )}
    </div>
  );
}
