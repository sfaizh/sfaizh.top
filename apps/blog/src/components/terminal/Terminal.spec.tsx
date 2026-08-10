import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { INTERRUPT, Terminal, type Entry } from './Terminal';
import { makeState } from '../../lib/shell/test-state';
import { seg } from '../../lib/shell/output';

function setup(overrides: { entries?: Entry[]; history?: string[] } = {}) {
  const onRun = jest.fn();
  const state = makeState({ history: overrides.history ?? [] });

  render(
    <Terminal
      entries={overrides.entries ?? []}
      state={state}
      busy={false}
      onRun={onRun}
      autoFocus={false}
    />
  );

  return { onRun, input: screen.getByLabelText('Terminal input') as HTMLInputElement };
}

describe('Terminal', () => {
  it('renders the scrollback', () => {
    setup({
      entries: [
        { id: 1, kind: 'command', cwd: '~', text: 'posts', exitCode: 0 },
        { id: 2, kind: 'output', lines: [[seg('vim-motions-as-a-design-language', { colour: 'blue' })]] },
      ],
    });

    expect(screen.getByText('posts')).toBeTruthy();
    expect(screen.getByText('vim-motions-as-a-design-language')).toBeTruthy();
  });

  it('runs the typed command on Enter and clears the line', () => {
    const { onRun, input } = setup();

    fireEvent.change(input, { target: { value: 'posts' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRun).toHaveBeenCalledWith('posts');
    expect(input.value).toBe('');
  });

  it('completes a unique command on Tab', () => {
    const { input } = setup();

    fireEvent.change(input, { target: { value: 'neo' } });
    fireEvent.keyDown(input, { key: 'Tab' });

    expect(input.value).toBe('neofetch ');
  });

  it('opens a completion menu when several commands match', () => {
    const { input } = setup();

    fireEvent.change(input, { target: { value: 'c' } });
    fireEvent.keyDown(input, { key: 'Tab' });

    expect(screen.getByText(/matches · Tab cycles/)).toBeTruthy();
    expect(screen.getByText('cat')).toBeTruthy();
    expect(screen.getByText('clear')).toBeTruthy();
  });

  it('dismisses the completion menu on Escape', () => {
    const { input } = setup();

    fireEvent.change(input, { target: { value: 'c' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByText(/matches · Tab cycles/)).toBeNull();
  });

  it('shows a ghost suggestion drawn from history', () => {
    const { input } = setup({ history: ['theme latte'] });
    fireEvent.change(input, { target: { value: 'the' } });

    // The block caret sits on the first ghost character, so the dim remainder
    // starts one character in — 'theme latte' renders as the|m|'e latte'.
    expect(screen.getByText('m').className).toContain('terminal-caret');
    expect(screen.getByText('e latte')).toBeTruthy();
  });

  it('accepts the ghost suggestion with ArrowRight at the end of the line', () => {
    const { input } = setup({ history: ['theme latte'] });

    fireEvent.change(input, { target: { value: 'the' } });
    fireEvent.keyDown(input, { key: 'ArrowRight' });

    expect(input.value).toBe('theme latte');
  });

  it('walks history with the arrow keys', () => {
    const { input } = setup({ history: ['ls', 'posts'] });

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('posts');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('ls');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('posts');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('');
  });

  it('clears the screen with Ctrl-L', () => {
    const { onRun, input } = setup();
    fireEvent.keyDown(input, { key: 'l', ctrlKey: true });

    expect(onRun).toHaveBeenCalledWith('clear');
  });

  it('abandons the line with Ctrl-C', () => {
    const { onRun, input } = setup();

    fireEvent.change(input, { target: { value: 'half a command' } });
    fireEvent.keyDown(input, { key: 'c', ctrlKey: true });

    expect(onRun).toHaveBeenCalledWith(`half a command${INTERRUPT}`);
    expect(input.value).toBe('');
  });

  it('kills the previous word with Ctrl-W', () => {
    const { input } = setup();

    fireEvent.change(input, { target: { value: 'open some-slug' } });
    input.setSelectionRange(14, 14);
    fireEvent.keyDown(input, { key: 'w', ctrlKey: true });

    expect(input.value).toBe('open ');
  });

  it('kills to the start of the line with Ctrl-U', () => {
    const { input } = setup();

    fireEvent.change(input, { target: { value: 'open some-slug' } });
    input.setSelectionRange(5, 5);
    fireEvent.keyDown(input, { key: 'u', ctrlKey: true });

    expect(input.value).toBe('some-slug');
  });

  it('leaves Ctrl-R to the browser so the page can reload', () => {
    const { onRun, input } = setup({ history: ['open a-post'] });

    const event = createEvent.keyDown(input, { key: 'r', ctrlKey: true });
    fireEvent(input, event);

    // Not intercepted: no command runs, and the default action stands.
    expect(onRun).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByText(/reverse-i-search/)).toBeNull();
  });

  it('runs a clicked output segment', () => {
    const onRun = jest.fn();
    render(
      <Terminal
        entries={[{ id: 1, kind: 'output', lines: [[seg('open me', { command: 'open a-post' })]] }]}
        state={makeState()}
        busy={false}
        onRun={onRun}
        autoFocus={false}
      />
    );

    fireEvent.click(screen.getByText('open me'));
    expect(onRun).toHaveBeenCalledWith('open a-post');
  });

  it('shows a spinner while a command is in flight', () => {
    render(
      <Terminal entries={[]} state={makeState()} busy onRun={jest.fn()} autoFocus={false} />
    );
    expect(screen.getByText(/working…/)).toBeTruthy();
  });
});
