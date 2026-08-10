import { runCommand } from './engine';
import { lineToString } from './output';
import { HOME, POSTS_DIR } from './vfs';
import { makeState } from './test-state';

jest.mock('../api-client', () => ({
  api: {
    raw: jest.fn(async (slug: string) => `---\ntitle: ${slug}\n---\n\nBody of ${slug}.\n`),
    tags: jest.fn(async () => [
      { tag: 'design', count: 2 },
      { tag: 'vim', count: 1 },
    ]),
    search: jest.fn(async (query: string) =>
      query === 'nothing'
        ? []
        : [
            {
              post: { slug: 'building-a-terminal-blog', title: 'Building a terminal-shaped blog' },
              excerpt: `…matched ${query}…`,
              matches: 3,
            },
          ]
    ),
  },
}));

const textOf = (lines: { text: string }[][]) => lines.map(lineToString).join('\n');

describe('help', () => {
  it('lists every visible command grouped by purpose', async () => {
    const output = textOf((await runCommand('help', makeState())).lines);
    expect(output).toContain('NAVIGATION');
    expect(output).toContain('posts');
    expect(output).toContain('KEYS');
    // Hidden commands stay hidden.
    expect(output).not.toContain('there is no exit');
  });

  it('explains a single command', async () => {
    const output = textOf((await runCommand('help theme', makeState())).lines);
    expect(output).toContain('switch Catppuccin flavour');
    expect(output).toContain('usage:');
  });

  it('fails on an unknown command', async () => {
    const result = await runCommand('help frobnicate', makeState());
    expect(result.exitCode).toBe(127);
  });
});

describe('ls and cd', () => {
  it('lists the home directory', async () => {
    const output = textOf((await runCommand('ls', makeState())).lines);
    expect(output).toContain('posts/');
    expect(output).toContain('about.md');
  });

  it('hides dotfiles unless -a is given', async () => {
    expect(textOf((await runCommand('ls', makeState())).lines)).not.toContain('.zshrc');
    expect(textOf((await runCommand('ls -a', makeState())).lines)).toContain('.zshrc');
  });

  it('lists posts as markdown files', async () => {
    const state = makeState({ cwd: POSTS_DIR });
    const output = textOf((await runCommand('ls', state)).lines);
    expect(output).toContain('building-a-terminal-blog.md');
  });

  it('shows sizes and dates in long form', async () => {
    const output = textOf((await runCommand('ll', makeState())).lines);
    expect(output).toContain('drwxr-xr-x');
    expect(output).toContain('total');
  });

  it('fails on a missing directory', async () => {
    const result = await runCommand('ls nowhere', makeState());
    expect(result.exitCode).toBe(2);
    expect(textOf(result.lines)).toContain('No such file or directory');
  });

  it('changes directory via an effect', async () => {
    const result = await runCommand('cd posts', makeState());
    expect(result.effects).toEqual([{ type: 'cd', path: POSTS_DIR }]);
  });

  it('returns home from anywhere', async () => {
    const result = await runCommand('cd', makeState({ cwd: POSTS_DIR }));
    expect(result.effects).toEqual([{ type: 'cd', path: HOME }]);
  });

  it('refuses an unknown directory', async () => {
    expect((await runCommand('cd elsewhere', makeState())).exitCode).toBe(1);
  });
});

describe('cat', () => {
  it('prints a static file', async () => {
    const output = textOf((await runCommand('cat about.md', makeState())).lines);
    expect(output).toContain('whoami');
  });

  it('fetches and prints a post', async () => {
    const output = textOf((await runCommand('cat building-a-terminal-blog', makeState())).lines);
    expect(output).toContain('Body of building-a-terminal-blog.');
  });

  it('requires an argument', async () => {
    expect((await runCommand('cat', makeState())).exitCode).toBe(1);
  });

  it('fails on a missing file', async () => {
    expect((await runCommand('cat nope.txt', makeState())).exitCode).toBe(1);
  });
});

describe('open', () => {
  it('emits an open effect for an exact slug', async () => {
    const result = await runCommand('open building-a-terminal-blog', makeState());
    expect(result.effects).toEqual([{ type: 'open', slug: 'building-a-terminal-blog' }]);
  });

  it('resolves a unique prefix', async () => {
    const result = await runCommand('open vim', makeState());
    expect(result.effects).toEqual([{ type: 'open', slug: 'vim-motions-as-a-design-language' }]);
  });

  it('accepts a filename with the extension', async () => {
    const result = await runCommand('open building-a-terminal-blog.md', makeState());
    expect(result.effects?.[0]).toMatchObject({ type: 'open' });
  });

  it('opens the newest post for `open latest`', async () => {
    const result = await runCommand('open latest', makeState());
    expect(result.effects).toEqual([{ type: 'open', slug: 'vim-motions-as-a-design-language' }]);
  });

  it('fails helpfully on an unknown slug', async () => {
    const result = await runCommand('open nonsense-slug', makeState());
    expect(result.exitCode).toBe(1);
    expect(textOf(result.lines)).toContain('no such post');
  });

  it('is reachable through its vim aliases', async () => {
    for (const alias of ['vim', 'nvim', 'less', 'man']) {
      const result = await runCommand(`${alias} building-a-terminal-blog`, makeState());
      expect(result.effects).toEqual([{ type: 'open', slug: 'building-a-terminal-blog' }]);
    }
  });
});

describe('posts', () => {
  it('tabulates the archive', async () => {
    const output = textOf((await runCommand('posts', makeState())).lines);
    expect(output).toContain('DATE');
    expect(output).toContain('building-a-terminal-blog');
    expect(output).toContain('2 posts');
  });

  it('filters by tag', async () => {
    const output = textOf((await runCommand('posts --tag vim', makeState())).lines);
    expect(output).toContain('vim-motions');
    expect(output).not.toContain('building-a-terminal-blog');
  });

  it('fails when a tag matches nothing', async () => {
    expect((await runCommand('posts --tag nope', makeState())).exitCode).toBe(1);
  });
});

describe('search', () => {
  it('shows matches with an excerpt', async () => {
    const output = textOf((await runCommand('search terminal', makeState())).lines);
    expect(output).toContain('building-a-terminal-blog');
    expect(output).toContain('matched terminal');
  });

  it('rejects a one-character query', async () => {
    expect((await runCommand('search a', makeState())).exitCode).toBe(2);
  });

  it('reports no matches', async () => {
    const result = await runCommand('search nothing', makeState());
    expect(result.exitCode).toBe(1);
    expect(textOf(result.lines)).toContain('no matches');
  });

  it('accepts a quoted multi-word query', async () => {
    const output = textOf((await runCommand('search "vim motions"', makeState())).lines);
    expect(output).toContain('matched vim motions');
  });
});

describe('theme', () => {
  it('shows the current flavour and the alternatives', async () => {
    const output = textOf((await runCommand('theme', makeState())).lines);
    expect(output).toContain('catppuccin-mocha');
    expect(output).toContain('latte');
  });

  it('switches flavour via an effect', async () => {
    const result = await runCommand('theme latte', makeState());
    expect(result.effects).toEqual([{ type: 'flavour', flavour: 'latte' }]);
  });

  it('rejects an unknown flavour', async () => {
    expect((await runCommand('theme solarized', makeState())).exitCode).toBe(1);
  });
});

describe('sudo', () => {
  it('opens the admin console for `sudo -i`', async () => {
    const result = await runCommand('sudo -i', makeState());
    expect(result.effects).toEqual([{ type: 'navigate', href: '/admin' }]);
  });

  it('also accepts `sudo su -`', async () => {
    const result = await runCommand('sudo su -', makeState());
    expect(result.effects).toEqual([{ type: 'navigate', href: '/admin' }]);
  });

  it('refuses anything else', async () => {
    const result = await runCommand('sudo rm -rf /', makeState());
    expect(result.exitCode).toBe(1);
    expect(textOf(result.lines)).toContain('not in the sudoers file');
  });
});

describe('miscellany', () => {
  it('prints the working directory', async () => {
    expect(textOf((await runCommand('pwd', makeState())).lines)).toBe('/home/faiz');
  });

  it('renders neofetch with the live stats', async () => {
    const output = textOf((await runCommand('neofetch', makeState())).lines);
    expect(output).toContain('faiz');
    expect(output).toContain('catppuccin-mocha');
  });

  it('shows history, most recent last', async () => {
    const output = textOf((await runCommand('history', makeState({ history: ['ls', 'posts'] }))).lines);
    expect(output).toContain('ls');
    expect(output).toContain('posts');
  });

  it('says something when history is empty', async () => {
    expect(textOf((await runCommand('history', makeState())).lines)).toContain('no history');
  });

  it('asks for a reboot', async () => {
    expect((await runCommand('reboot', makeState())).effects).toEqual([{ type: 'reboot' }]);
  });

  it('lists tags with counts', async () => {
    const output = textOf((await runCommand('tags', makeState())).lines);
    expect(output).toContain('design');
    expect(output).toContain('2');
  });

  it('describes the site', async () => {
    const output = textOf((await runCommand('about', makeState())).lines);
    expect(output).toContain('terminal for a front door');
    expect(output).toContain('filesystem');
  });
});
