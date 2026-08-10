/**
 * Terminal output is a typed structure, never an HTML string.
 *
 * A command returns lines of coloured segments; the renderer turns them into
 * spans. That keeps commands pure and unit-testable — a test can assert on the
 * text of a line without going near the DOM — and makes it impossible for a
 * post title to inject markup into the shell.
 */

export type Colour =
  | 'text'
  | 'subtext0'
  | 'subtext1'
  | 'overlay0'
  | 'overlay1'
  | 'overlay2'
  | 'red'
  | 'peach'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'sky'
  | 'sapphire'
  | 'blue'
  | 'lavender'
  | 'mauve'
  | 'pink'
  | 'rosewater'
  | 'flamingo'
  | 'maroon';

export interface Segment {
  text: string;
  colour?: Colour;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Renders as a clickable span that runs the given command. */
  command?: string;
}

export type Line = Segment[];

export const seg = (text: string, options: Omit<Segment, 'text'> = {}): Segment => ({ text, ...options });

export const line = (...segments: (Segment | string)[]): Line =>
  segments.map((item) => (typeof item === 'string' ? seg(item) : item));

export const blank = (): Line => [];

/**
 * These return a *block* of lines rather than a single line, because that is
 * what a command result is made of — it keeps `success(text(...))` and
 * `[...error(a), ...dim(b)]` reading the same way everywhere.
 */
export const text = (value: string, colour: Colour = 'text'): Line[] => [[seg(value, { colour })]];

export const dim = (value: string): Line[] => [[seg(value, { colour: 'overlay1' })]];

export const error = (value: string): Line[] => [[seg(value, { colour: 'red' })]];

export const ok = (value: string): Line[] => [[seg(value, { colour: 'green' })]];

/** Pad to a column width, accounting for nothing clever — output is monospace. */
export function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

export function padStart(value: string, width: number): string {
  return value.length >= width ? value : ' '.repeat(width - value.length) + value;
}

/**
 * Lay out rows into aligned columns, the way `ls -l` or `column -t` would.
 * Each cell keeps its own colouring.
 */
export function table(rows: Segment[][], options: { gap?: number } = {}): Line[] {
  const gap = options.gap ?? 2;
  const widths: number[] = [];

  for (const row of rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, cell.text.length);
    });
  }

  return rows.map((row) =>
    row.map((cell, index) => ({
      ...cell,
      text: index === row.length - 1 ? cell.text : pad(cell.text, widths[index] + gap),
    }))
  );
}

/** Wrap plain text to a column count, preserving word boundaries. */
export function wrap(value: string, width = 76): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current === '') current = word;
    else if (current.length + 1 + word.length <= width) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

export function paragraph(value: string, colour: Colour = 'subtext1', width = 76): Line[] {
  return wrap(value, width).map((row) => [seg(row, { colour })]);
}

/** Flatten a line back to plain text — used by tests and by `history`. */
export function lineToString(value: Line): string {
  return value.map((segment) => segment.text).join('');
}
