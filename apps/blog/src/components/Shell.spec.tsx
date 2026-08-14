import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { STORAGE_KEYS } from '@sfaizh/shared';
import { Shell } from './Shell';
import { TEST_POSTS } from '../lib/shell/test-state';

const push = jest.fn();
let pathname = '/';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => pathname,
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

// Captured after jest.setup.ts has installed its stub, so a test that swaps in
// its own media-query behaviour cannot leak into the next one.
const baseMatchMedia = window.matchMedia;

beforeEach(() => {
  push.mockClear();
  pathname = '/';
  Object.defineProperty(window, 'matchMedia', { writable: true, value: baseMatchMedia });
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

  it('renders a post image without touching its layout', async () => {
    const input = await renderShell();
    api.rendered.mockResolvedValue({
      ...TEST_POSTS[0],
      html: '<figure class="md-figure"><img src="https://example.test/photo.webp" alt="a photo" /></figure>',
      headings: [],
    });
    await run(input, 'open building-a-terminal-blog');

    const image = (await screen.findByAltText('a photo')) as HTMLImageElement;

    Object.defineProperty(image, 'naturalWidth', { value: 1200, configurable: true });
    Object.defineProperty(image, 'naturalHeight', { value: 1600, configurable: true });
    await act(async () => {
      image.dispatchEvent(new Event('load'));
    });

    // The reader no longer writes an inline aspect-ratio: the image is laid
    // out at its natural proportions and nothing intervenes.
    expect(image.style.aspectRatio).toBe('');
  });

  it('opens the reader directly when the page loads at /posts/<slug>', async () => {
    window.localStorage.setItem(STORAGE_KEYS.booted, '1');
    pathname = '/posts/building-a-terminal-blog';

    api.listPosts.mockResolvedValue(TEST_POSTS);
    api.stats.mockResolvedValue({ posts: 2, drafts: 0, tags: 3, words: 2600, storage: 'filesystem' });
    api.rendered.mockResolvedValue({
      ...TEST_POSTS[0],
      html: '<p>Body text.</p>',
      headings: [],
    });

    render(<Shell />);

    expect(await screen.findByRole('document')).toBeTruthy();
    expect(screen.queryByLabelText('Terminal input')).toBeNull();
  });

  /**
   * The reduced-motion query is not known on the first render — it resolves in
   * an effect, one commit late — and on iOS it resolves to `true` whenever Low
   * Power Mode is on. That late change used to re-run the bootstrap effect and
   * drop an already-open post back to the terminal, so a deep link opened the
   * shell instead of the post roughly every other time.
   */
  it('stays in the reader when the reduced-motion query resolves late', async () => {
    window.localStorage.setItem(STORAGE_KEYS.booted, '1');
    pathname = '/posts/building-a-terminal-blog';

    const listeners: (() => void)[] = [];
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addEventListener: (_: string, handler: () => void) => listeners.push(handler),
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });

    api.listPosts.mockResolvedValue(TEST_POSTS);
    api.stats.mockResolvedValue({ posts: 2, drafts: 0, tags: 3, words: 2600, storage: 'filesystem' });
    api.rendered.mockResolvedValue({
      ...TEST_POSTS[0],
      html: '<p>Body text.</p>',
      headings: [],
    });

    render(<Shell />);
    expect(await screen.findByRole('document')).toBeTruthy();

    // A second resolution of the query — a `change` event, an orientation
    // change — must not evict the post either.
    await act(async () => {
      for (const listener of listeners) listener();
    });

    expect(screen.getByRole('document')).toBeTruthy();
    expect(screen.queryByLabelText('Terminal input')).toBeNull();
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
