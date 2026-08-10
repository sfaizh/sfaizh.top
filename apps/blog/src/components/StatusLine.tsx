'use client';

import type { ReactNode } from 'react';

/**
 * The tmux / Neovim status bar.
 *
 * Powerline separators are `clip-path` cuts rather than Nerd Font glyphs, so
 * the bar looks identical on a machine that has never installed a patched
 * font. The mode block is always leftmost and always coloured by mode, which
 * is the one piece of state a modal interface owes its user.
 */

export type Tone = 'green' | 'mauve' | 'blue' | 'peach' | 'yellow' | 'red' | 'teal' | 'surface1';

const TONE_BG: Record<Tone, string> = {
  green: 'var(--ctp-green)',
  mauve: 'var(--ctp-mauve)',
  blue: 'var(--ctp-blue)',
  peach: 'var(--ctp-peach)',
  yellow: 'var(--ctp-yellow)',
  red: 'var(--ctp-red)',
  teal: 'var(--ctp-teal)',
  surface1: 'var(--ctp-surface1)',
};

export interface StatusSegment {
  label: string;
  tone?: Tone;
  /** Muted segments sit on surface colours and use normal text weight. */
  muted?: boolean;
  title?: string;
}

interface Props {
  mode: StatusSegment;
  left?: StatusSegment[];
  right?: StatusSegment[];
  children?: ReactNode;
}

export function StatusLine({ mode, left = [], right = [], children }: Props) {
  return (
    <div
      className="no-print flex h-[var(--statusline-height)] w-full items-stretch overflow-hidden bg-[color:var(--ctp-mantle)] text-[11.5px] font-medium sm:text-[12.5px]"
      role="status"
    >
      <span
        className="pl-seg pl-arrow-right shrink-0 font-bold uppercase tracking-[0.09em]"
        style={{ background: TONE_BG[mode.tone ?? 'green'], color: 'var(--ctp-crust)' }}
      >
        {mode.label}
      </span>

      {left.map((segment, index) => (
        <span
          key={`${segment.label}-${index}`}
          title={segment.title}
          className="pl-seg pl-arrow-right shrink-0 max-w-[42vw] truncate"
          style={{
            background: segment.muted ? 'var(--ctp-surface0)' : 'var(--ctp-surface1)',
            color: 'var(--ctp-subtext1)',
          }}
        >
          {segment.label}
        </span>
      ))}

      {/* The flexible middle: legends, pending keys, search prompts. */}
      <div className="flex min-w-0 flex-1 items-center overflow-hidden pl-3 pr-2 text-[color:var(--ctp-overlay1)]">
        {children}
      </div>

      {right.map((segment, index) => (
        <span
          key={`${segment.label}-${index}`}
          title={segment.title}
          className="pl-seg pl-arrow-left shrink-0"
          style={{
            background: segment.tone ? TONE_BG[segment.tone] : 'var(--ctp-surface1)',
            color: segment.tone ? 'var(--ctp-crust)' : 'var(--ctp-subtext1)',
            fontWeight: segment.tone ? 700 : 500,
          }}
        >
          {segment.label}
        </span>
      ))}
    </div>
  );
}

/**
 * A `man`-page style key legend: `q` quit · `/` search · …
 *
 * It clips rather than scrolls. A status bar that grows its own horizontal
 * scrollbar is worse than one that shows fewer keys, so entries past the
 * available width are simply hidden — the full map lives behind `?`.
 */
export function KeyLegend({ keys }: { keys: readonly (readonly [string, string])[] }) {
  return (
    <div className="flex min-w-0 items-center gap-3 overflow-hidden whitespace-nowrap">
      {keys.map(([key, label]) => (
        <span key={key} className="flex shrink-0 items-center gap-1">
          <kbd className="rounded-[3px] bg-[color:var(--ctp-surface1)] px-1.5 py-[1px] text-[color:var(--ctp-text)]">
            {key}
          </kbd>
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}
