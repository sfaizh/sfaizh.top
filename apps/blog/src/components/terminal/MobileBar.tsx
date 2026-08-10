'use client';

import { MOBILE_COMMANDS } from '../../lib/shell/commands';

/**
 * There is no `j` key on a phone.
 *
 * Rather than degrade the desktop experience, touch devices get their own
 * complete one: the commands you would otherwise type, as a scrollable row of
 * chips directly above the prompt.
 */
export function MobileBar({ onRun }: { onRun: (command: string) => void }) {
  return (
    <nav
      aria-label="Quick commands"
      className="scroll-themed flex shrink-0 gap-1.5 overflow-x-auto border-t border-[color:var(--ctp-surface0)] bg-[color:var(--ctp-mantle)] px-2 py-2"
    >
      {MOBILE_COMMANDS.map((entry) => (
        <button
          key={entry.command}
          type="button"
          onClick={() => onRun(entry.command)}
          className="shrink-0 rounded-md border border-[color:var(--ctp-surface1)] bg-[color:var(--ctp-surface0)] px-3 py-1.5 text-[12.5px] text-[color:var(--ctp-text)] active:brightness-125"
        >
          {entry.label}
        </button>
      ))}
    </nav>
  );
}

/** The reader's touch controls: the motions that actually matter on a phone. */
export function ReaderMobileBar({
  onTop,
  onBottom,
  onPrevHeading,
  onNextHeading,
  onQuit,
}: {
  onTop: () => void;
  onBottom: () => void;
  onPrevHeading: () => void;
  onNextHeading: () => void;
  onQuit: () => void;
}) {
  const buttons: [string, () => void, string][] = [
    ['✕ close', onQuit, 'Back to the terminal'],
    ['↑ top', onTop, 'Jump to the top'],
    ['‹ prev', onPrevHeading, 'Previous heading'],
    ['next ›', onNextHeading, 'Next heading'],
    ['↓ end', onBottom, 'Jump to the end'],
  ];

  return (
    <nav
      aria-label="Reader controls"
      className="scroll-themed flex shrink-0 gap-1.5 overflow-x-auto border-t border-[color:var(--ctp-surface0)] bg-[color:var(--ctp-mantle)] px-2 py-2"
    >
      {buttons.map(([label, action, title]) => (
        <button
          key={label}
          type="button"
          title={title}
          aria-label={title}
          onClick={action}
          className="shrink-0 rounded-md border border-[color:var(--ctp-surface1)] bg-[color:var(--ctp-surface0)] px-3 py-1.5 text-[12.5px] text-[color:var(--ctp-text)] active:brightness-125"
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
