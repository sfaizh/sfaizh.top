import { COMMANDS, findCommand } from './commands';
import { error, seg } from './output';
import type { CommandResult, ShellState } from './types';

/**
 * Split a command line into tokens, honouring single and double quotes so that
 * `search "vim motions"` behaves the way it looks like it should.
 */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < input.length; index++) {
    const character = input[index];

    if (quote) {
      if (character === quote) quote = null;
      else current += character;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  if (current) tokens.push(current);
  return tokens;
}

export async function runCommand(input: string, state: ShellState): Promise<CommandResult> {
  const tokens = tokenize(input.trim());
  if (!tokens.length) return { lines: [], exitCode: state.lastExit };

  const [name, ...args] = tokens;
  const command = findCommand(name);

  if (!command) {
    return {
      lines: [
        [seg('sfsh: ', { colour: 'red' }), seg(`command not found: ${name}`, { colour: 'red' })],
        [seg('did you mean ', { colour: 'overlay1' }), ...suggestSimilar(name), seg('?', { colour: 'overlay1' })],
      ].filter((row) => row.length > 0),
      exitCode: 127,
    };
  }

  try {
    return await command.run({ name: name.toLowerCase(), args, raw: input, state });
  } catch (cause) {
    return {
      lines: error(`${name}: ${(cause as Error).message ?? 'unexpected failure'}`),
      exitCode: 1,
    };
  }
}

/** Cheap edit-distance-ish nudge for typos, capped at two suggestions. */
function suggestSimilar(name: string) {
  const candidates = COMMANDS.filter((command) => !command.hidden)
    .map((command) => command.name)
    .filter((candidate) => distance(candidate, name.toLowerCase()) <= 2)
    .slice(0, 2);

  if (!candidates.length) return [seg('`help`', { colour: 'yellow', command: 'help' })];
  return candidates.flatMap((candidate, index) => [
    ...(index > 0 ? [seg(' or ', { colour: 'overlay1' })] : []),
    seg(candidate, { colour: 'yellow', command: candidate }),
  ]);
}

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [index, ...Array(b.length).fill(0)]);
  for (let column = 0; column <= b.length; column++) rows[0][column] = column;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return rows[a.length][b.length];
}

export interface Completion {
  /** Everything before the token being completed, kept verbatim. */
  prefix: string;
  /** Candidate replacements for the final token. */
  candidates: string[];
  /** The partial token the candidates were matched against. */
  partial: string;
  /** Longest shared prefix of the candidates — what Tab fills in. */
  common: string;
}

/**
 * `zsh-autocomplete` behaviour: complete command names in the first position
 * and delegate to the command for everything after it.
 */
export function complete(input: string, state: ShellState): Completion {
  const endsWithSpace = /\s$/.test(input);
  const tokens = tokenize(input);
  const completingNew = endsWithSpace || tokens.length === 0;
  const partial = completingNew ? '' : (tokens[tokens.length - 1] ?? '');
  const leading = completingNew ? tokens : tokens.slice(0, -1);

  let pool: string[];
  if (leading.length === 0) {
    pool = COMMANDS.filter((command) => !command.hidden).map((command) => command.name);
  } else {
    const command = findCommand(leading[0]);
    pool = command?.completions?.(state, [...leading.slice(1), partial]) ?? [];
  }

  const candidates = [...new Set(pool)].filter((candidate) => candidate.startsWith(partial)).sort();
  const prefix = input.slice(0, input.length - partial.length);

  return { prefix, candidates, partial, common: longestCommonPrefix(candidates) || partial };
}

function longestCommonPrefix(values: string[]): string {
  if (!values.length) return '';
  let result = values[0];
  for (const value of values.slice(1)) {
    let index = 0;
    while (index < result.length && index < value.length && result[index] === value[index]) index++;
    result = result.slice(0, index);
    if (!result) break;
  }
  return result;
}

/**
 * The dim ghost text ahead of the cursor. History wins over the command table,
 * because the thing you typed before is the thing you most likely want again.
 */
export function inlineSuggestion(input: string, state: ShellState): string | null {
  if (!input) return null;

  for (let index = state.history.length - 1; index >= 0; index--) {
    const entry = state.history[index];
    if (entry.startsWith(input) && entry !== input) return entry;
  }

  const { candidates, prefix } = complete(input, state);
  if (candidates.length === 0) return null;
  const full = `${prefix}${candidates[0]}`;
  return full !== input && full.startsWith(input) ? full : null;
}
