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

  const [mode, setMode] = useState<Mode>('boot');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [cwd, setCwd] = useState(HOME);
  const [lastExit, setLastExit] = useState(0);
  const [busy, setBusy] = useState(false);
  const [readerSlug, setReaderSlug] = useState<string | null>(null);
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

    const alreadyBooted = readLocal(STORAGE_KEYS.booted) === '1';
    if (alreadyBooted || reducedMotion) setMode('shell');
  }, [reducedMotion]);

  // The index is fetched once, during the boot animation, and then cached.
  useEffect(() => {
    Promise.all([api.listPosts(), api.stats()])
      .then(([loadedPosts, loadedStats]) => {
        setPosts(loadedPosts);
        setStats(loadedStats);
      })
      .catch((cause: Error) => setLoadError(cause.message));
  }, []);

  // Deep-link: if the page loaded at /posts/<slug>, open that post once and
  // skip the boot animation. The ref prevents re-opening if posts re-fetches.
  const deepLinkConsumed = useRef(false);
  useEffect(() => {
    if (deepLinkConsumed.current || !pathname) return;
    const match = pathname.match(/^\/posts\/([^/]+)$/);
    if (!match) return;
    const slug = match[1];
    deepLinkConsumed.current = true;
    writeLocal(STORAGE_KEYS.booted, '1');
    setMode('reader');
    setReaderSlug(slug);
  }, [pathname]);

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
