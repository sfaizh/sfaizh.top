import { complete, inlineSuggestion, runCommand, tokenize } from './engine';
import { lineToString } from './output';
import type { ShellState } from './types';
import { buildFilesystem } from './vfs';
import { makeState } from './test-state';

describe('tokenize', () => {
  it('splits on whitespace', () => {
    expect(tokenize('open a-post')).toEqual(['open', 'a-post']);
  });

  it('keeps quoted arguments together', () => {
    expect(tokenize('search "vim motions"')).toEqual(['search', 'vim motions']);
    expect(tokenize("echo 'hello world'")).toEqual(['echo', 'hello world']);
  });

  it('collapses runs of whitespace', () => {
    expect(tokenize('  ls   -la  ')).toEqual(['ls', '-la']);
  });

  it('returns nothing for an empty line', () => {
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('runCommand', () => {
  let state: ShellState;

  beforeEach(() => {
    state = makeState();
  });

  it('does nothing for an empty line', async () => {
    const result = await runCommand('   ', state);
    expect(result.lines).toEqual([]);
  });

  it('reports an unknown command with exit code 127', async () => {
    const result = await runCommand('frobnicate', state);
    expect(result.exitCode).toBe(127);
    expect(lineToString(result.lines[0])).toContain('command not found: frobnicate');
  });

  it('suggests a near miss', async () => {
    const result = await runCommand('pots', state);
    expect(result.lines.map(lineToString).join(' ')).toContain('posts');
  });

  it('resolves aliases to the same command', async () => {
    const viaAlias = await runCommand('cls', state);
    expect(viaAlias.effects).toEqual([{ type: 'clear' }]);
  });

  it('turns a thrown error into a failed result rather than crashing', async () => {
    const broken = { ...state, posts: null as never };
    const result = await runCommand('posts', broken);
    expect(result.exitCode).toBe(1);
  });
});

describe('complete', () => {
  let state: ShellState;

  beforeEach(() => {
    state = makeState();
  });

  it('completes command names in the first position', () => {
    const completion = complete('the', state);
    expect(completion.candidates).toContain('theme');
    expect(completion.prefix).toBe('');
  });

  it('delegates argument completion to the command', () => {
    const completion = complete('open vim', state);
    expect(completion.candidates).toEqual(['vim-motions-as-a-design-language']);
    expect(completion.prefix).toBe('open ');
  });

  it('lists every candidate after a trailing space', () => {
    const completion = complete('theme ', state);
    expect(completion.candidates).toEqual(['frappe', 'latte', 'macchiato', 'mocha']);
    expect(completion.partial).toBe('');
  });

  it('computes the longest common prefix for the first Tab press', () => {
    const completion = complete('op', state);
    expect(completion.common.startsWith('op')).toBe(true);
  });

  it('returns nothing for a command with no argument completions', () => {
    expect(complete('pwd ', state).candidates).toEqual([]);
  });
});

describe('inlineSuggestion', () => {
  it('prefers a history entry over the command table', () => {
    const state = makeState({ history: ['theme latte'] });
    expect(inlineSuggestion('the', state)).toBe('theme latte');
  });

  it('falls back to a command name', () => {
    const state = makeState({ history: [] });
    expect(inlineSuggestion('neo', state)).toBe('neofetch');
  });

  it('returns null when there is nothing to suggest', () => {
    expect(inlineSuggestion('', makeState())).toBeNull();
    expect(inlineSuggestion('zzzz', makeState())).toBeNull();
  });

  it('never suggests exactly what is already typed', () => {
    const state = makeState({ history: ['posts'] });
    expect(inlineSuggestion('posts', state)).not.toBe('posts');
  });
});

describe('state fixture', () => {
  it('builds a filesystem from the post list', () => {
    const state = makeState();
    const filesystem = buildFilesystem(state.posts);
    expect(filesystem.entries.get('~/posts')?.length).toBe(state.posts.length);
  });
});
