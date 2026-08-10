import { CATPPUCCIN_FLAVOURS, isFlavour, type PostMeta } from '@sfaizh/shared';
import { api } from '../api-client';
import { blank, dim, error, line, paragraph, seg, table, text, type Line, type Segment } from './output';
import { failure, success, type Command, type CommandContext, type ShellState } from './types';
import { HOME, POSTS_DIR, humanSize, isDirectory, resolvePath, shortDate, type VFile } from './vfs';

/** Where the admin console lives. Documented in the README. */
export const ADMIN_COMMAND = 'sudo -i';

const ROOT_PROMPT_HINT = 'run `help` for the full command list';

// ── helpers ──────────────────────────────────────────────────────────────────

function findPost(state: ShellState, needle: string): PostMeta | undefined {
  const slug = needle.replace(/\.mdx?$/i, '').replace(/^~?\/?posts\//, '');
  const exact = state.posts.find((post) => post.slug === slug);
  if (exact) return exact;

  const prefixed = state.posts.filter((post) => post.slug.startsWith(slug));
  if (prefixed.length === 1) return prefixed[0];

  const lower = needle.toLowerCase();
  return state.posts.find((post) => post.title.toLowerCase().includes(lower));
}

function postSlugs(state: ShellState): string[] {
  return state.posts.map((post) => post.slug);
}

function postRow(post: PostMeta): Segment[] {
  return [
    seg(shortDate(post.date), { colour: 'overlay1' }),
    seg(post.slug, { colour: 'blue', command: `open ${post.slug}` }),
    seg(`${post.readingMinutes}m`, { colour: 'overlay0' }),
    seg(post.tags.length ? post.tags.join(',') : '—', { colour: 'teal' }),
    seg(post.title, { colour: 'text' }),
  ];
}

// ── commands ─────────────────────────────────────────────────────────────────

const help: Command = {
  name: 'help',
  aliases: ['?', 'commands'],
  summary: 'list every command, or explain one',
  usage: 'help [command]',
  group: 'system',
  completions: (_state, args) =>
    args.length <= 1 ? COMMANDS.filter((command) => !command.hidden).map((command) => command.name) : [],
  run({ args }) {
    if (args[0]) {
      const command = findCommand(args[0]);
      if (!command) return failure(error(`help: no such command: ${args[0]}`), 127);
      return success([
        [seg(command.name, { colour: 'green', bold: true }), seg(` — ${command.summary}`)],
        ...(command.usage ? [line(seg('  usage: ', { colour: 'overlay1' }), seg(command.usage, { colour: 'yellow' }))] : []),
        ...(command.aliases?.length
          ? [line(seg('  alias: ', { colour: 'overlay1' }), seg(command.aliases.join(', '), { colour: 'teal' }))]
          : []),
      ]);
    }

    const groups: { key: Command['group']; label: string }[] = [
      { key: 'navigation', label: 'navigation' },
      { key: 'content', label: 'content' },
      { key: 'appearance', label: 'appearance' },
      { key: 'system', label: 'system' },
    ];

    const lines: Line[] = [];
    for (const group of groups) {
      const members = COMMANDS.filter((command) => command.group === group.key && !command.hidden);
      if (!members.length) continue;
      lines.push([seg(group.label.toUpperCase(), { colour: 'mauve', bold: true })]);
      lines.push(
        ...table(
          members.map((command) => [
            seg(`  ${command.name}`, { colour: 'green' }),
            seg(command.summary, { colour: 'subtext1' }),
          ])
        )
      );
      lines.push(blank());
    }

    lines.push([seg('KEYS', { colour: 'mauve', bold: true })]);
    lines.push(
      ...table([
        [seg('  Tab', { colour: 'yellow' }), seg('accept the inline suggestion', { colour: 'subtext1' })],
        [seg('  ↑ ↓', { colour: 'yellow' }), seg('walk command history', { colour: 'subtext1' })],
        [seg('  Ctrl-R', { colour: 'yellow' }), seg('search history', { colour: 'subtext1' })],
        [seg('  Ctrl-L', { colour: 'yellow' }), seg('clear the screen', { colour: 'subtext1' })],
        [seg('  Ctrl-A / Ctrl-E', { colour: 'yellow' }), seg('start / end of line', { colour: 'subtext1' })],
        [seg('  Ctrl-W / Ctrl-U', { colour: 'yellow' }), seg('kill word / line', { colour: 'subtext1' })],
      ])
    );
    lines.push(blank());
    lines.push(...dim('Inside a post: j k · ^D ^U · gg G · / n N · ? for the full map · q to come back.'));

    return success(lines);
  },
};

const ls: Command = {
  name: 'ls',
  aliases: ['ll', 'dir'],
  summary: 'list the current directory',
  usage: 'ls [-a] [-l] [path]',
  group: 'navigation',
  completions: (state) => (state.cwd === HOME ? ['posts', 'about.md', 'now.txt', 'contact.txt'] : postSlugs(state).map((slug) => `${slug}.md`)),
  run({ name, args, state }) {
    const flags = args.filter((arg) => arg.startsWith('-'));
    const rest = args.filter((arg) => !arg.startsWith('-'));
    const showHidden = flags.some((flag) => flag.includes('a'));
    const long = name === 'll' || flags.some((flag) => flag.includes('l'));

    const path = resolvePath(state.cwd, rest[0]);
    if (!path || !isDirectory(path)) {
      return failure(error(`ls: cannot access '${rest[0]}': No such file or directory`), 2);
    }

    const nodes = (state.fs.entries.get(path) ?? []).filter((node) => showHidden || !node.hidden);
    if (!nodes.length) return success(dim('(empty)'));

    if (!long) {
      const cells = nodes.map((node) =>
        node.kind === 'dir'
          ? seg(`${node.name}/`, { colour: 'blue', bold: true, command: `cd ${node.name}` })
          : seg(node.name, {
              colour: node.hidden ? 'overlay0' : 'text',
              command: (node as VFile).slug ? `open ${(node as VFile).slug}` : `cat ${node.name}`,
            })
      );
      // Four to a row keeps the listing compact without wrapping on mobile.
      const rows: Segment[][] = [];
      for (let index = 0; index < cells.length; index += 4) rows.push(cells.slice(index, index + 4));
      return success(table(rows, { gap: 3 }));
    }

    const rows = nodes.map((node) => [
      seg(node.kind === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--', { colour: 'overlay0' }),
      seg(node.kind === 'dir' ? '-' : humanSize((node as VFile).size), { colour: 'peach' }),
      seg(shortDate(node.modified), { colour: 'overlay1' }),
      node.kind === 'dir'
        ? seg(`${node.name}/`, { colour: 'blue', bold: true, command: `cd ${node.name}` })
        : seg(node.name, {
            colour: node.hidden ? 'overlay0' : 'text',
            command: (node as VFile).slug ? `open ${(node as VFile).slug}` : `cat ${node.name}`,
          }),
    ]);

    return success([...table(rows), blank(), ...dim(`total ${nodes.length}`)]);
  },
};

const cd: Command = {
  name: 'cd',
  summary: 'change directory',
  usage: 'cd [posts|~]',
  group: 'navigation',
  completions: (state) => (state.cwd === HOME ? ['posts', '~'] : ['~', '..']),
  run({ args, state }) {
    const path = resolvePath(state.cwd, args[0] ?? HOME);
    if (!path || !isDirectory(path)) {
      return failure(error(`cd: no such file or directory: ${args[0]}`), 1);
    }
    return success([], [{ type: 'cd', path }]);
  },
};

const pwd: Command = {
  name: 'pwd',
  summary: 'print the working directory',
  group: 'navigation',
  run({ state }) {
    return success(text(state.cwd.replace(HOME, '/home/faiz'), 'blue'));
  },
};

const cat: Command = {
  name: 'cat',
  aliases: ['bat', 'more'],
  summary: 'print a file to the terminal',
  usage: 'cat <file>',
  group: 'content',
  completions: (state) =>
    state.cwd === POSTS_DIR
      ? postSlugs(state).map((slug) => `${slug}.md`)
      : ['about.md', 'now.txt', 'contact.txt'],
  async run({ args, state }) {
    const target = args[0];
    if (!target) return failure(error('cat: missing file operand'), 1);

    const local = state.fs.fileAt(state.cwd, target) ?? state.fs.fileAt(HOME, target);
    if (local?.body) {
      return success(local.body.trimEnd().split('\n').map((row) => [seg(row, { colour: 'subtext1' })]));
    }

    const post = findPost(state, target);
    if (!post) return failure(error(`cat: ${target}: No such file or directory`), 1);

    try {
      const raw = await api.raw(post.slug);
      return success([
        ...raw.trimEnd().split('\n').map((row) => [seg(row, { colour: 'subtext1' })]),
        blank(),
        line(
          seg('── ', { colour: 'overlay0' }),
          seg(`open ${post.slug}`, { colour: 'yellow', command: `open ${post.slug}` }),
          seg(' to read it properly', { colour: 'overlay1' })
        ),
      ]);
    } catch (cause) {
      return failure(error(`cat: ${post.slug}: ${(cause as Error).message}`), 1);
    }
  },
};

const open: Command = {
  name: 'open',
  aliases: ['vim', 'nvim', 'vi', 'less', 'man', 'read', 'view'],
  summary: 'read a post (opens the pager)',
  usage: 'open <slug>',
  group: 'content',
  completions: (state) => postSlugs(state),
  run({ args, state }) {
    const target = args[0];
    if (!target) {
      const latest = state.posts[0];
      if (!latest) return failure(error('open: no posts available'), 1);
      return success(
        [line(seg('opening ', { colour: 'overlay1' }), seg(latest.slug, { colour: 'blue' }))],
        [{ type: 'open', slug: latest.slug }]
      );
    }

    if (target === 'latest' || target === 'last') {
      const latest = state.posts[0];
      if (!latest) return failure(error('open: no posts available'), 1);
      return success([], [{ type: 'open', slug: latest.slug }]);
    }

    const post = findPost(state, target);
    if (!post) {
      return failure(
        [
          ...error(`open: ${target}: no such post`),
          ...dim(`try \`posts\` for the list, or \`search ${target}\``),
        ],
        1
      );
    }
    return success([], [{ type: 'open', slug: post.slug }]);
  },
};

const posts: Command = {
  name: 'posts',
  aliases: ['blog', 'archive'],
  summary: 'list every published post',
  usage: 'posts [--tag <tag>]',
  group: 'content',
  completions: (state) => ['--tag', ...new Set(state.posts.flatMap((post) => post.tags))],
  run({ args, state }) {
    const tagIndex = args.findIndex((arg) => arg === '--tag' || arg === '-t');
    const tag = tagIndex >= 0 ? args[tagIndex + 1]?.toLowerCase() : undefined;

    const visible = tag ? state.posts.filter((post) => post.tags.includes(tag)) : state.posts;
    if (!visible.length) {
      return failure(error(tag ? `posts: nothing tagged '${tag}'` : 'posts: nothing published yet'), 1);
    }

    return success([
      ...table([
        [
          seg('DATE', { colour: 'overlay0', bold: true }),
          seg('SLUG', { colour: 'overlay0', bold: true }),
          seg('READ', { colour: 'overlay0', bold: true }),
          seg('TAGS', { colour: 'overlay0', bold: true }),
          seg('TITLE', { colour: 'overlay0', bold: true }),
        ],
        ...visible.map(postRow),
      ]),
      blank(),
      ...dim(`${visible.length} post${visible.length === 1 ? '' : 's'} · click a slug or type \`open <slug>\``),
    ]);
  },
};

const tags: Command = {
  name: 'tags',
  summary: 'list tags and how often they appear',
  group: 'content',
  async run() {
    const all = await api.tags();
    if (!all.length) return success(dim('no tags yet'));

    return success([
      ...table(
        all.map((entry) => [
          seg(entry.tag, { colour: 'teal', command: `posts --tag ${entry.tag}` }),
          seg('▏'.repeat(Math.min(entry.count, 24)), { colour: 'mauve' }),
          seg(String(entry.count), { colour: 'overlay1' }),
        ])
      ),
      blank(),
      ...dim('click a tag to filter, or `posts --tag <tag>`'),
    ]);
  },
};

const search: Command = {
  name: 'search',
  aliases: ['grep', 'rg', 'find'],
  summary: 'full-text search across every post',
  usage: 'search <query>',
  group: 'content',
  async run({ args }) {
    const query = args.join(' ').trim();
    if (query.length < 2) return failure(error('search: need at least 2 characters'), 2);

    try {
      const hits = await api.search(query);
      if (!hits.length) return failure(error(`no matches for "${query}"`), 1);

      const lines: Line[] = [];
      for (const hit of hits) {
        lines.push([
          seg(hit.post.slug, { colour: 'blue', bold: true, command: `open ${hit.post.slug}` }),
          seg(`  ${hit.matches} match${hit.matches === 1 ? '' : 'es'}`, { colour: 'overlay0' }),
        ]);
        lines.push(...paragraph(hit.excerpt, 'subtext0', 80).map((row) => [seg('  '), ...row]));
        lines.push(blank());
      }
      lines.push(...dim(`${hits.length} file${hits.length === 1 ? '' : 's'} matched`));
      return success(lines);
    } catch (cause) {
      return failure(error(`search: ${(cause as Error).message}`), 1);
    }
  },
};

const whoami: Command = {
  name: 'whoami',
  summary: 'who runs this place',
  group: 'content',
  run() {
    return success([
      [seg('faiz', { colour: 'green', bold: true })],
      blank(),
      ...paragraph(
        'Engineer. Backend systems, developer tooling, and interfaces that respect the keyboard. This site is where I write the longer version.',
        'subtext1',
        78
      ),
      blank(),
      line(seg('  ', {}), seg('about', { colour: 'yellow', command: 'about' }), seg('    the longer introduction', { colour: 'overlay1' })),
      line(seg('  ', {}), seg('contact', { colour: 'yellow', command: 'cat contact.txt' }), seg('  how to reach me', { colour: 'overlay1' })),
    ]);
  },
};

const about: Command = {
  name: 'about',
  summary: 'what this site is',
  group: 'content',
  run({ state }) {
    const stats = state.stats;
    return success([
      ...paragraph(
        'sfaizh.top is an engineering blog with a terminal for a front door. The shell is the index; posts open in a pager with vim motions. Everything is markdown, kept in a git repository, rendered on the server.',
        'subtext1',
        78
      ),
      blank(),
      ...table([
        [seg('  posts', { colour: 'overlay1' }), seg(String(stats?.posts ?? state.posts.length), { colour: 'green' })],
        [seg('  tags', { colour: 'overlay1' }), seg(String(stats?.tags ?? 0), { colour: 'green' })],
        [seg('  words', { colour: 'overlay1' }), seg((stats?.words ?? 0).toLocaleString('en-GB'), { colour: 'green' })],
        [seg('  storage', { colour: 'overlay1' }), seg(stats?.storage ?? 'filesystem', { colour: 'green' })],
      ]),
      blank(),
      ...dim(ROOT_PROMPT_HINT),
    ]);
  },
};

const neofetch: Command = {
  name: 'neofetch',
  aliases: ['fastfetch', 'uname'],
  summary: 'system information, with a logo',
  group: 'system',
  run({ state }) {
    const art = [
      '        .--.        ',
      '       |o_o |       ',
      '       |:_/ |       ',
      '      //   \\ \\      ',
      "     (|     | )     ",
      "    /'\\_   _/`\\     ",
      '    \\___)=(___/     ',
    ];
    const info: [string, string][] = [
      ['host', 'sfaizh.top'],
      ['os', 'Next.js 16 · NestJS 11'],
      ['shell', 'sfsh 1.0 (zsh-flavoured)'],
      ['theme', `catppuccin-${state.flavour}`],
      ['font', 'nerd font, if you have one'],
      ['posts', String(state.stats?.posts ?? state.posts.length)],
      ['words', (state.stats?.words ?? 0).toLocaleString('en-GB')],
      ['storage', state.stats?.storage ?? 'filesystem'],
      ['uptime', 'since you loaded the page'],
    ];

    const rows: Line[] = [];
    const height = Math.max(art.length, info.length + 2);
    for (let index = 0; index < height; index++) {
      const left = seg(art[index] ?? ' '.repeat(20), { colour: 'mauve' });
      if (index === 0) {
        rows.push([left, seg('faiz', { colour: 'green', bold: true }), seg('@', { colour: 'overlay1' }), seg('sfaizh.top', { colour: 'green', bold: true })]);
      } else if (index === 1) {
        rows.push([left, seg('─'.repeat(20), { colour: 'overlay0' })]);
      } else {
        const entry = info[index - 2];
        rows.push(entry ? [left, seg(`${entry[0]}: `, { colour: 'blue', bold: true }), seg(entry[1], { colour: 'subtext1' })] : [left]);
      }
    }

    rows.push(blank());
    rows.push([
      ...(['red', 'peach', 'yellow', 'green', 'teal', 'blue', 'mauve', 'pink'] as const).map((colour) =>
        seg('███', { colour })
      ),
    ]);

    return success(rows);
  },
};

const theme: Command = {
  name: 'theme',
  aliases: ['flavour', 'flavor'],
  summary: 'switch Catppuccin flavour',
  usage: 'theme [mocha|macchiato|frappe|latte]',
  group: 'appearance',
  completions: () => [...CATPPUCCIN_FLAVOURS],
  run({ args, state }) {
    const requested = args[0];
    if (!requested) {
      return success([
        line(seg('current: ', { colour: 'overlay1' }), seg(`catppuccin-${state.flavour}`, { colour: 'mauve', bold: true })),
        blank(),
        ...CATPPUCCIN_FLAVOURS.map((flavour) => [
          seg(flavour === state.flavour ? '  ● ' : '  ○ ', { colour: 'green' }),
          seg(flavour, { colour: 'yellow', command: `theme ${flavour}` }),
          seg(flavour === 'latte' ? '  (light)' : '', { colour: 'overlay0' }),
        ]),
      ]);
    }
    if (!isFlavour(requested)) {
      return failure(error(`theme: unknown flavour '${requested}' (try ${CATPPUCCIN_FLAVOURS.join(', ')})`), 1);
    }
    return success(
      [line(seg('theme → ', { colour: 'overlay1' }), seg(`catppuccin-${requested}`, { colour: 'mauve', bold: true }))],
      [{ type: 'flavour', flavour: requested }]
    );
  },
};

const clear: Command = {
  name: 'clear',
  aliases: ['cls'],
  summary: 'clear the scrollback',
  group: 'system',
  run() {
    return success([], [{ type: 'clear' }]);
  },
};

const history: Command = {
  name: 'history',
  summary: 'show recent commands',
  group: 'system',
  run({ state }) {
    if (!state.history.length) return success(dim('(no history yet)'));
    return success(
      table(
        state.history.slice(-40).map((entry, index) => [
          seg(String(index + 1), { colour: 'overlay0' }),
          seg(entry, { colour: 'subtext1', command: entry }),
        ])
      )
    );
  },
};

const dateCommand: Command = {
  name: 'date',
  summary: 'print the current date and time',
  group: 'system',
  run() {
    return success(text(new Date().toString(), 'subtext1'));
  },
};

const echo: Command = {
  name: 'echo',
  summary: 'print its arguments',
  usage: 'echo <text>',
  group: 'system',
  hidden: true,
  run({ args }) {
    return success(text(args.join(' '), 'subtext1'));
  },
};

const banner: Command = {
  name: 'banner',
  aliases: ['motd', 'logo'],
  summary: 'reprint the welcome banner',
  group: 'appearance',
  run() {
    return success(bannerLines());
  },
};

const reboot: Command = {
  name: 'reboot',
  summary: 'replay the boot sequence',
  group: 'system',
  run() {
    return success(dim('rebooting…'), [{ type: 'reboot' }]);
  },
};

const sudo: Command = {
  name: 'sudo',
  summary: 'elevate — `sudo -i` opens the admin console',
  usage: 'sudo -i',
  group: 'system',
  completions: () => ['-i', 'su', '-s'],
  run({ args }) {
    const wantsShell =
      args.length === 0 ||
      args[0] === '-i' ||
      args[0] === '-s' ||
      args[0] === 'su' ||
      args.join(' ') === 'su -';

    if (wantsShell) {
      return success(
        [
          [seg('[sudo] password for faiz: ', { colour: 'overlay1' }), seg('••••••••', { colour: 'overlay0' })],
          [seg('→ launching admin console', { colour: 'green' })],
        ],
        [{ type: 'navigate', href: '/admin' }]
      );
    }

    return failure(
      [
        ...error(`faiz is not in the sudoers file for '${args.join(' ')}'.`),
        ...dim('This incident will be reported. (It will not.)'),
      ],
      1
    );
  },
};

const exitCommand: Command = {
  name: 'exit',
  aliases: ['logout', 'quit'],
  summary: 'there is no exit',
  group: 'system',
  hidden: true,
  run() {
    return success([
      ...dim('There is no exit. There is only more scrollback.'),
      ...dim('Try `clear`, or close the tab like a coward.'),
    ]);
  },
};

// ── registry ─────────────────────────────────────────────────────────────────

export const COMMANDS: Command[] = [
  help,
  ls,
  cd,
  pwd,
  posts,
  open,
  cat,
  search,
  tags,
  whoami,
  about,
  theme,
  banner,
  neofetch,
  history,
  dateCommand,
  clear,
  reboot,
  sudo,
  echo,
  exitCommand,
];

const INDEX = new Map<string, Command>();
for (const command of COMMANDS) {
  INDEX.set(command.name, command);
  for (const alias of command.aliases ?? []) INDEX.set(alias, command);
}

export function findCommand(name: string): Command | undefined {
  return INDEX.get(name.toLowerCase());
}

export function commandNames(): string[] {
  return [...INDEX.keys()].sort();
}

export function bannerLines(): Line[] {
  return [
    [seg('   ▄▄▄· ▄▄▄· ▪   ·▄▄▄▄•', { colour: 'mauve' })],
    [seg('  ▐█ ▀█ ▐█ ▀█ ██  ▪▀·.█▌', { colour: 'mauve' })],
    [seg('  ▄█▀▀█ ▄█▀▀█ ▐█· ▄█▀▀▀•', { colour: 'pink' })],
    [seg('  ▐█ ▪▐▌▐█ ▪▐▌▐█▌ █▌▪▄█▀', { colour: 'pink' })],
    [seg('   ▀  ▀  ▀  ▀ ▀▀▀ ·▀▀▀ ·', { colour: 'rosewater' })],
    blank(),
    [
      seg('sfaizh.top', { colour: 'green', bold: true }),
      seg(' · engineering blog · ', { colour: 'overlay1' }),
      seg('sfsh 1.0', { colour: 'teal' }),
    ],
    blank(),
    [
      seg('Type ', { colour: 'subtext0' }),
      seg('help', { colour: 'yellow', bold: true, command: 'help' }),
      seg(' for commands, ', { colour: 'subtext0' }),
      seg('posts', { colour: 'yellow', bold: true, command: 'posts' }),
      seg(' to see what I have written, or ', { colour: 'subtext0' }),
      seg('open latest', { colour: 'yellow', bold: true, command: 'open latest' }),
      seg('.', { colour: 'subtext0' }),
    ],
    blank(),
  ];
}

/** Commands surfaced as tappable chips on touch devices. */
export const MOBILE_COMMANDS = [
  { label: 'help', command: 'help' },
  { label: 'posts', command: 'posts' },
  { label: 'latest', command: 'open latest' },
  { label: 'about', command: 'about' },
  { label: 'tags', command: 'tags' },
  { label: 'theme', command: 'theme' },
  { label: 'neofetch', command: 'neofetch' },
  { label: 'clear', command: 'clear' },
] as const;

export type { CommandContext };
