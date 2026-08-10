'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../lib/hooks';

/**
 * The one-time boot animation.
 *
 * It runs exactly once per browser (the caller owns the `localStorage` flag)
 * and covers the initial API fetch, so it is buying something real rather than
 * being pure theatre. Any keypress, tap or click skips straight to the end,
 * and `prefers-reduced-motion` skips it entirely.
 */

type Step =
  | { kind: 'line'; text: string; tone: Tone; after: number }
  | { kind: 'progress'; label: string; after: number; duration: number };

type Tone = 'ok' | 'info' | 'dim' | 'accent' | 'warn';

const TONE_CLASS: Record<Tone, string> = {
  ok: 'text-[color:var(--ctp-green)]',
  info: 'text-[color:var(--ctp-subtext1)]',
  dim: 'text-[color:var(--ctp-overlay1)]',
  accent: 'text-[color:var(--ctp-mauve)]',
  warn: 'text-[color:var(--ctp-yellow)]',
};

const SEQUENCE: Step[] = [
  { kind: 'line', text: '[  OK  ] Reached target sfaizh.top', tone: 'ok', after: 90 },
  { kind: 'line', text: '[  OK  ] Mounted /home/faiz', tone: 'ok', after: 70 },
  { kind: 'line', text: '[  OK  ] Started Terminal Session Manager', tone: 'ok', after: 70 },
  { kind: 'line', text: '', tone: 'dim', after: 40 },
  { kind: 'line', text: 'Reading package lists... Done', tone: 'info', after: 120 },
  { kind: 'line', text: 'Building dependency tree... Done', tone: 'info', after: 110 },
  { kind: 'line', text: 'The following NEW packages will be installed:', tone: 'info', after: 90 },
  {
    kind: 'line',
    text: '  catppuccin-mocha  nerd-fonts  sfsh  split-flap  vim-motions',
    tone: 'accent',
    after: 130,
  },
  { kind: 'line', text: '', tone: 'dim', after: 40 },
  { kind: 'progress', label: 'unpacking', after: 40, duration: 620 },
  { kind: 'line', text: 'Setting up sfsh (1.0.0) ...', tone: 'info', after: 90 },
  { kind: 'line', text: 'Setting up catppuccin-mocha (1.7.1) ...', tone: 'info', after: 80 },
  { kind: 'line', text: 'Processing triggers for fontconfig ...', tone: 'dim', after: 80 },
  { kind: 'line', text: '', tone: 'dim', after: 40 },
  { kind: 'line', text: '[  OK  ] sfsh 1.0 ready. Welcome back.', tone: 'ok', after: 140 },
];

const PACKAGES = ['sfsh', 'catppuccin-mocha', 'nerd-fonts', 'split-flap', 'vim-motions'];
const BAR_WIDTH = 28;

interface Props {
  onDone: () => void;
}

export function BootSequence({ onDone }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState<{ text: string; tone: Tone }[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const finished = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Both the timeline and the skip handler call this; only the first one wins.
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onDoneRef.current();
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      finish();
      return;
    }

    const timers: number[] = [];
    let elapsed = 0;

    for (const step of SEQUENCE) {
      elapsed += step.after;

      if (step.kind === 'line') {
        const at = elapsed;
        timers.push(
          window.setTimeout(() => setVisible((lines) => [...lines, { text: step.text, tone: step.tone }]), at)
        );
        continue;
      }

      const start = elapsed;
      const ticks = 24;
      for (let tick = 0; tick <= ticks; tick++) {
        timers.push(
          window.setTimeout(() => setProgress(tick / ticks), start + (step.duration * tick) / ticks)
        );
      }
      timers.push(window.setTimeout(() => setProgress(null), start + step.duration + 60));
      elapsed += step.duration + 60;
    }

    timers.push(window.setTimeout(finish, elapsed + 220));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [reducedMotion, finish]);

  // Any input at all means "I have seen this, get on with it".
  useEffect(() => {
    const skip = () => finish();
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [finish]);

  const filled = progress === null ? 0 : Math.round(progress * BAR_WIDTH);
  const packageName = progress === null ? '' : PACKAGES[Math.min(PACKAGES.length - 1, Math.floor(progress * PACKAGES.length))];

  return (
    <div
      className="h-full w-full overflow-hidden px-1 py-2 text-[13.5px] leading-[1.6] sm:text-[14.5px]"
      role="status"
      aria-live="polite"
      aria-label="Booting"
    >
      {visible.map((entry, index) => (
        <div key={index} className={`line-enter whitespace-pre ${TONE_CLASS[entry.tone]}`}>
          {entry.text || ' '}
        </div>
      ))}

      {progress !== null && (
        <div className="whitespace-pre text-[color:var(--ctp-subtext1)]">
          <span className="text-[color:var(--ctp-overlay0)]">[</span>
          <span className="text-[color:var(--ctp-green)]">{'█'.repeat(filled)}</span>
          <span className="text-[color:var(--ctp-surface1)]">{'░'.repeat(BAR_WIDTH - filled)}</span>
          <span className="text-[color:var(--ctp-overlay0)]">]</span>
          <span className="text-[color:var(--ctp-yellow)]">
            {` ${String(Math.round(progress * 100)).padStart(3, ' ')}%`}
          </span>
          <span className="text-[color:var(--ctp-overlay1)]">{`  ${packageName}`}</span>
        </div>
      )}

      <div className="mt-3 text-[color:var(--ctp-overlay0)]">press any key to skip</div>
    </div>
  );
}
