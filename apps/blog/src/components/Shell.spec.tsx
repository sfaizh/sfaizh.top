import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { STORAGE_KEYS } from '@sfaizh/shared';
import { Shell } from './Shell';
import { TEST_POSTS } from '../lib/shell/test-state';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/',
}));

jest.mock('../lib/api-client', () => ({
  invalidateCache: jest.fn(),
  api: {
    listPosts: jest.fn(),
    stats: jest.fn(),
    rendered: jest.fn(),
    tags: jest.fn(async () => [{ tag: 'design', count: 2 }]),
    raw: jest.fn(async () => '# raw'),
    search: jest.fn(async () => []),
  },
}));

const { api } = jest.requireMock('../lib/api-client') as {
  api: Record<string, jest.Mock>;
};

async function renderShell() {
  window.localStorage.setItem(STORAGE_KEYS.booted, '1');

  api.listPosts.mockResolvedValue(TEST_POSTS);
  api.stats.mockResolvedValue({ posts: 2, drafts: 0, tags: 3, words: 2600, storage: 'filesystem' });
  api.rendered.mockImplementation(async (slug: string) => ({
    ...(TEST_POSTS.find((post) => post.slug === slug) ?? TEST_POSTS[0]),
    html: '<h2 id="a-heading">A heading</h2><p>Body text.</p>',
    headings: [{ id: 'a-heading', text: 'A heading', depth: 2 }],
  }));

  render(<Shell />);
  // The banner is printed by an effect once the shell takes over.
  await screen.findByText(/· engineering blog/);
  return screen.getByLabelText('Terminal input') as HTMLInputElement;
}

async function run(input: HTMLInputElement, command: string) {
  await act(async () => {
    fireEvent.change(input, { target: { value: command } });
    fireEvent.keyDown(input, { key: 'Enter' });
  });
}

beforeEach(() => {
  push.mockClear();
  delete document.documentElement.dataset.flavour;
});

describe('Shell', () => {
  it('skips the boot sequence when it has already run', async () => {
    await renderShell();
    expect(screen.queryByText('Reading package lists... Done')).toBeNull();
  });

  it('plays the boot sequence on a first visit', async () => {
    api.listPosts.mockResolvedValue(TEST_POSTS);
    api.stats.mockResolvedValue({ posts: 2, drafts: 0, tags: 3, words: 2600, storage: 'filesystem' });

    render(<Shell />);
    expect(await screen.findByLabelText('Booting')).toBeTruthy();
  });

  it('runs a command and prints its output', async () => {
    const input = await renderShell();
    await run(input, 'posts');

    expect(await screen.findByText('building-a-terminal-blog')).toBeTruthy();
  });

  it('clears the scrollback without reprinting the banner', async () => {
    const input = await renderShell();
    await run(input, 'posts');
    await run(input, 'clear');

    await waitFor(() => expect(screen.queryByText(/· engineering blog/)).toBeNull());
    expect(screen.queryByText('building-a-terminal-blog')).toBeNull();
  });

  it('records history and persists it', async () => {
    const input = await renderShell();
    await run(input, 'whoami');

    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.history) ?? '[]')).toEqual(['whoami'])
    );
  });

  it('changes directory and shows it in the prompt', async () => {
    const input = await renderShell();
    await run(input, 'cd posts');

    expect(await screen.findAllByText('~/posts')).toBeTruthy();
  });

  it('switches flavour on the document element', async () => {
    const input = await renderShell();
    await run(input, 'theme latte');

    await waitFor(() => expect(document.documentElement.dataset.flavour).toBe('latte'));
    expect(window.localStorage.getItem(STORAGE_KEYS.flavour)).toBe('latte');
  });

  it('opens a post in the reader and comes back on q', async () => {
    const input = await renderShell();
    await run(input, 'open building-a-terminal-blog');

    const document_ = await screen.findByRole('document');
    expect(await screen.findByText('A heading')).toBeTruthy();
    expect(screen.getByText('building-a-terminal-blog.md')).toBeTruthy();

    await act(async () => {
      fireEvent.keyDown(document_, { key: 'q' });
    });
    expect(screen.getByLabelText('Terminal input')).toBeTruthy();
  });

  it('leaves the reader with the :q command, showing it as you type', async () => {
    const input = await renderShell();
    await run(input, 'open building-a-terminal-blog');

    const surface = await screen.findByRole('document');

    // ':' opens the command line and the prompt becomes visible.
    await act(async () => {
      fireEvent.keyDown(surface, { key: ':' });
    });
    const commandLine = (await screen.findByLabelText('Reader command')) as HTMLInputElement;
    expect(screen.getByText('COMMAND')).toBeTruthy();

    await act(async () => {
      fireEvent.change(commandLine, { target: { value: 'q' } });
    });
    expect(commandLine.value).toBe('q');

    await act(async () => {
      fireEvent.keyDown(commandLine, { key: 'Enter' });
    });
    expect(screen.getByLabelText('Terminal input')).toBeTruthy();
  });

  it('reports an unknown reader command instead of silently ignoring it', async () => {
    const input = await renderShell();
    await run(input, 'open building-a-terminal-blog');

    const surface = await screen.findByRole('document');
    await act(async () => {
      fireEvent.keyDown(surface, { key: ':' });
    });

    const commandLine = await screen.findByLabelText('Reader command');
    await act(async () => {
      fireEvent.change(commandLine, { target: { value: 'wat' } });
      fireEvent.keyDown(commandLine, { key: 'Enter' });
    });

    expect(await screen.findByText(/E492: Not an editor command: wat/)).toBeTruthy();
    // Still in the reader.
    expect(screen.getByRole('document')).toBeTruthy();
  });

  it('navigates to the admin console for sudo -i', async () => {
    const input = await renderShell();
    await run(input, 'sudo -i');

    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin'));
  });

  it('reports an API failure without breaking the shell', async () => {
    window.localStorage.setItem(STORAGE_KEYS.booted, '1');
    api.listPosts.mockRejectedValue(new Error('fetch failed'));
    api.stats.mockRejectedValue(new Error('fetch failed'));

    render(<Shell />);

    expect(await screen.findByText(/could not reach the API/)).toBeTruthy();
    expect(screen.getByLabelText('Terminal input')).toBeTruthy();
  });
});
