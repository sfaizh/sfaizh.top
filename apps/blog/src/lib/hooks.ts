'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
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

export type MotionPreference = 'auto' | 'full' | 'reduced';

const MOTION_PREFERENCES: MotionPreference[] = ['auto', 'full', 'reduced'];

/**
 * One preference, shared by every component that animates.
 *
 * A plain `useState` per hook call would give each component its own copy, so
 * changing it in the terminal would not reach the header until a reload — an
 * external store keeps them in step. `useSyncExternalStore` also gives a
 * stable server snapshot, so hydration does not flicker.
 */
let motionPreference: MotionPreference = 'auto';
let motionHydrated = false;
const motionListeners = new Set<() => void>();

function emitMotionChange() {
  for (const listener of motionListeners) listener();
}

function subscribeMotion(listener: () => void): () => void {
  motionListeners.add(listener);
  return () => motionListeners.delete(listener);
}

function hydrateMotion() {
  if (motionHydrated || typeof window === 'undefined') return;
  motionHydrated = true;

  const stored = readLocal(STORAGE_KEYS.motion) as MotionPreference | null;
  if (stored && MOTION_PREFERENCES.includes(stored) && stored !== motionPreference) {
    motionPreference = stored;
    emitMotionChange();
  }
}

/**
 * Whether to animate, and why.
 *
 * `auto` follows the operating system, which is the right default. It is not
 * always the right *answer*, though: iOS reports `prefers-reduced-motion` while
 * Low Power Mode is on, so a phone conserving battery is indistinguishable from
 * a reader who asked for stillness. Rather than guess, the choice is surfaced
 * as a command (`motion full`) and remembered — an explicit user control, which
 * is what the accessibility guidance asks for anyway.
 */
export function useMotion(): {
  reduced: boolean;
  preference: MotionPreference;
  setPreference: (next: MotionPreference) => void;
} {
  const system = useMediaQuery('(prefers-reduced-motion: reduce)');
  const preference = useSyncExternalStore(
    subscribeMotion,
    () => motionPreference,
    () => 'auto' as MotionPreference
  );

  useEffect(hydrateMotion, []);

  const setPreference = useCallback((next: MotionPreference) => {
    motionPreference = next;
    writeLocal(STORAGE_KEYS.motion, next);
    emitMotionChange();
  }, []);

  const reduced = preference === 'auto' ? system : preference === 'reduced';
  return { reduced, preference, setPreference };
}

/** True on touch-first devices, where the keyboard grammar does not apply. */
export function useIsTouch(): boolean {
  return useMediaQuery('(hover: none) and (pointer: coarse)');
}

/**
 * The effective answer for "should this animate?" — the device preference,
 * unless the reader has overridden it with the `motion` command.
 */
export function usePrefersReducedMotion(): boolean {
  return useMotion().reduced;
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
