'use client';

import type { Line, Segment } from '../../lib/shell/output';

/**
 * Renders the structured output a command returned. Commands never produce
 * markup, so there is nothing here that can inject into the page — a post
 * title containing `<script>` is just text with a colour.
 */

function segmentStyle(segment: Segment): React.CSSProperties {
  return {
    color: `var(--ctp-${segment.colour ?? 'text'})`,
    fontWeight: segment.bold ? 700 : undefined,
    fontStyle: segment.italic ? 'italic' : undefined,
    opacity: segment.dim ? 0.7 : undefined,
    textDecoration: segment.underline ? 'underline' : undefined,
  };
}

interface Props {
  lines: Line[];
  onRun?: (command: string) => void;
}

export function OutputView({ lines, onRun }: Props) {
  return (
    <>
      {lines.map((line, lineIndex) => (
        <div key={lineIndex} className="whitespace-pre-wrap break-words">
          {line.length === 0 ? (
            ' '
          ) : (
            line.map((segment, index) =>
              segment.command && onRun ? (
                <button
                  key={index}
                  type="button"
                  onClick={() => onRun(segment.command as string)}
                  className="cursor-pointer underline decoration-dotted underline-offset-2 hover:brightness-125"
                  style={segmentStyle(segment)}
                >
                  {segment.text}
                </button>
              ) : (
                <span key={index} style={segmentStyle(segment)}>
                  {segment.text}
                </span>
              )
            )
          )}
        </div>
      ))}
    </>
  );
}

/** The powerline prompt, drawn with CSS arrows rather than font glyphs. */
export function Prompt({ cwd, exitCode }: { cwd: string; exitCode: number }) {
  const failed = exitCode !== 0;
  return (
    <span className="inline-flex h-[1.55em] select-none items-stretch align-middle text-[0.94em]">
      <span
        className="pl-seg pl-arrow-right font-bold"
        style={{ background: 'var(--ctp-blue)', color: 'var(--ctp-crust)' }}
      >
        {cwd}
      </span>
      <span
        className="pl-seg pl-arrow-right"
        style={{ background: 'var(--ctp-surface1)', color: 'var(--ctp-subtext1)' }}
      >
        {'⎇'} main
      </span>
      <span
        className="pl-seg"
        style={{ color: failed ? 'var(--ctp-red)' : 'var(--ctp-green)', fontWeight: 700 }}
      >
        {failed ? `✘ ${exitCode} ❯` : '❯'}
      </span>
    </span>
  );
}
