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
 */

const ALPHABET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-';
const PHRASES = ['SFAIZH.TOP', 'ENGINEERING BLOG'];

const STEP_MS = 46;
const HOLD_MS = 5200;

interface Props {
  className?: string;
}

export function SplitFlapHeader({ className }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const width = useMemo(() => Math.max(...PHRASES.map((phrase) => phrase.length)), []);

  const [phraseIndex, setPhraseIndex] = useState(0);
  const [display, setDisplay] = useState<string[]>(() => padTo(PHRASES[0], width).split(''));
  const [settling, setSettling] = useState<boolean[]>(() => Array(width).fill(false));

  const targetRef = useRef(padTo(PHRASES[0], width));
  const frameRef = useRef<number | null>(null);

  // Cycle the phrase on a timer; the animation effect reacts to the change.
  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => {
      setPhraseIndex((index) => (index + 1) % PHRASES.length);
    }, HOLD_MS);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  useEffect(() => {
    const target = padTo(PHRASES[phraseIndex], width);
    targetRef.current = target;

    if (reducedMotion) {
      setDisplay(target.split(''));
      return;
    }

    // Stagger: each column waits a few ticks longer than the one before it.
    const delays = Array.from({ length: width }, (_, index) => index * 2);
    let tick = 0;

    const advance = () => {
      let settled = true;
      const nextSettling: boolean[] = Array(width).fill(false);

      setDisplay((current) => {
        const next = current.slice();
        for (let column = 0; column < width; column++) {
          const wanted = targetRef.current[column] ?? ' ';
          if (next[column] === wanted) continue;
          if (tick < delays[column]) {
            settled = false;
            continue;
          }

          const position = ALPHABET.indexOf(next[column]?.toUpperCase() ?? ' ');
          const stepped = ALPHABET[(position + 1 + ALPHABET.length) % ALPHABET.length];
          next[column] = stepped;
          nextSettling[column] = true;
          if (stepped !== wanted) settled = false;
        }
        return next;
      });

      setSettling(nextSettling);
      tick += 1;

      if (!settled) {
        frameRef.current = window.setTimeout(advance, STEP_MS);
      } else {
        setSettling(Array(width).fill(false));
      }
    };

    frameRef.current = window.setTimeout(advance, STEP_MS);
    return () => {
      if (frameRef.current !== null) window.clearTimeout(frameRef.current);
    };
  }, [phraseIndex, reducedMotion, width]);

  return (
    <header
      className={`flex items-center justify-center select-none ${className ?? ''}`}
      style={{ perspective: '520px' }}
    >
      {/* The accessible name never flickers, whatever the flaps are doing. */}
      <h1 className="sr-only">sfaizh.top — engineering blog</h1>

      <div
        aria-hidden="true"
        className="flex gap-[3px] text-[clamp(18px,3.4vw,30px)] font-bold tracking-[0.04em]"
      >
        {display.map((character, index) => (
          <span
            key={index}
            className={`flap ${settling[index] ? 'flap-settling' : ''}`}
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
