'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../lib/hooks';

/**
 * An airport departure board.
 *
 * Each character position steps through an alphabet until it reaches its
 * target, so letters visibly "roll" the way a real flap unit does rather than
 * cross-fading. Positions start at staggered offsets so the board ripples from
 * left to right instead of resolving in lockstep.
 *
 * The animation state lives in a ref, not in React state. The frame loop has
 * to know synchronously whether every column has landed in order to decide
 * whether to schedule another frame, and a state updater cannot answer that —
 * React runs it later, during render.
 */

const ALPHABET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-';
const PHRASES = ['SFAIZH.TOP', 'ENGINEERING BLOG'];

const STEP_MS = 46;
const HOLD_MS = 5200;
/** Reduced motion still alternates, just more calmly and without the roll. */
const HOLD_MS_REDUCED = 9000;

interface Props {
  className?: string;
}

export function SplitFlapHeader({ className }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const width = useMemo(() => Math.max(...PHRASES.map((phrase) => phrase.length)), []);

  const [phraseIndex, setPhraseIndex] = useState(0);
  // Starts blank so the board flaps in on first paint.
  const [display, setDisplay] = useState<string[]>(() => Array(width).fill(' '));
  const [landed, setLanded] = useState<boolean[]>(() => Array(width).fill(false));

  const displayRef = useRef(display);

  /**
   * The phrase alternates even when motion is reduced.
   *
   * Gating this on `prefers-reduced-motion` froze the board on a single phrase
   * — and phones report that setting far more often than desktops do (iOS Low
   * Power Mode and Android's "remove animations" both set it), so the second
   * phrase was simply invisible to most mobile visitors. Swapping the text is
   * not the kind of movement the setting is there to prevent; the *rolling*
   * is, and that stays disabled below.
   */
  useEffect(() => {
    const timer = window.setInterval(
      () => setPhraseIndex((index) => (index + 1) % PHRASES.length),
      reducedMotion ? HOLD_MS_REDUCED : HOLD_MS
    );
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  useEffect(() => {
    const target = padTo(PHRASES[phraseIndex], width);

    if (reducedMotion) {
      const settled = target.split('');
      displayRef.current = settled;
      setDisplay(settled);
      return;
    }

    // Stagger: each column waits a few ticks longer than the one before it.
    const delays = Array.from({ length: width }, (_, index) => index * 2);
    let tick = 0;
    let timer = 0;

    const advance = () => {
      const next = displayRef.current.slice();
      const justLanded = Array<boolean>(width).fill(false);
      let moving = false;

      for (let column = 0; column < width; column++) {
        const wanted = target[column] ?? ' ';
        if (next[column] === wanted) continue;

        // Something still differs from the target, so keep the loop alive
        // even for columns that are only waiting their turn.
        moving = true;
        if (tick < delays[column]) continue;

        const position = ALPHABET.indexOf((next[column] ?? ' ').toUpperCase());
        next[column] = ALPHABET[(position + 1 + ALPHABET.length) % ALPHABET.length];
        // The flap "clunks" on the tick it arrives, not on every tick.
        if (next[column] === wanted) justLanded[column] = true;
      }

      displayRef.current = next;
      setDisplay(next);
      setLanded(justLanded);
      tick += 1;

      if (moving) timer = window.setTimeout(advance, STEP_MS);
    };

    timer = window.setTimeout(advance, STEP_MS);
    return () => window.clearTimeout(timer);
  }, [phraseIndex, reducedMotion, width]);

  return (
    <header
      className={`flex items-center justify-center select-none ${className ?? ''}`}
      style={{ perspective: '520px' }}
    >
      {/* The accessible name never flickers, whatever the flaps are doing. */}
      <h1 className="sr-only">sfaizh.top engineering blog</h1>

      <div
        aria-hidden="true"
        className="flex gap-[3px] text-[clamp(18px,3.4vw,30px)] font-bold tracking-[0.04em]"
      >
        {display.map((character, index) => (
          <span
            key={index}
            className={`flap ${landed[index] ? 'flap-settling' : ''}`}
            style={{ transformOrigin: 'center center' }}
          >
            {character === ' ' ? ' ' : character}
          </span>
        ))}
      </div>
    </header>
  );
}

function padTo(value: string, width: number): string {
  const padding = width - value.length;
  const left = Math.floor(padding / 2);
  return ' '.repeat(left) + value + ' '.repeat(padding - left);
}
