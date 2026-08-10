'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_FLAVOUR, STORAGE_KEYS, isFlavour, type CatppuccinFlavour } from '@sfaizh/shared';
import { readLocal, writeLocal } from './storage';

/**
 * Matches a media query and stays in sync with it.
 *
 * The `change` event alone is not enough. Rendering starts with `false` for
 * SSR, and the state can move without an event ever firing — a browser
 * applying device characteristics slightly after first paint, a "request
 * desktop site" toggle, device emulation. Missing that transition is not
 * cosmetic here: it decides whether a phone gets the touch UI at all. So the
 * value is also re-read on the next frame and whenever the viewport changes.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    const sync = () => setMatches(list.matches);

    sync();
    const frame = window.requestAnimationFrame(sync);

    list.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);

    return () => {
      window.cancelAnimationFrame(frame);
      list.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
    };
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
