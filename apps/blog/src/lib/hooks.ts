'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_FLAVOUR, STORAGE_KEYS, isFlavour, type CatppuccinFlavour } from '@sfaizh/shared';
import { readLocal, writeLocal } from './storage';

/** Matches a media query and stays in sync with it. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** True on touch-first devices, where the keyboard grammar does not apply. */
export function useIsTouch(): boolean {
  return useMediaQuery('(hover: none) and (pointer: coarse)');
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * The flavour is written to `document.documentElement` rather than held in
 * React state alone, so the CSS variables swap without re-rendering the tree.
 */
export function useFlavour(): [CatppuccinFlavour, (next: CatppuccinFlavour) => void] {
  const [flavour, setFlavour] = useState<CatppuccinFlavour>(DEFAULT_FLAVOUR);

  useEffect(() => {
    const stored = readLocal(STORAGE_KEYS.flavour);
    if (isFlavour(stored)) {
      setFlavour(stored);
      document.documentElement.dataset.flavour = stored;
    } else {
      document.documentElement.dataset.flavour = DEFAULT_FLAVOUR;
    }
  }, []);

  const update = useCallback((next: CatppuccinFlavour) => {
    setFlavour(next);
    document.documentElement.dataset.flavour = next;
    writeLocal(STORAGE_KEYS.flavour, next);
  }, []);

  return [flavour, update];
}

/**
 * A ticking clock for the statusline. It starts blank rather than reading the
 * clock during render — the server's minute and the browser's minute disagree
 * often enough to trip hydration.
 */
export function useClock(): string {
  const [now, setNow] = useState('--:--');

  useEffect(() => {
    const tick = () => setNow(formatClock(new Date()));
    tick();
    const timer = window.setInterval(tick, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
