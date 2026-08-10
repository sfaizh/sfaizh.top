import type { PostMeta } from '@sfaizh/shared';

/**
 * A virtual filesystem just deep enough to make `ls`, `cd` and `cat` mean
 * something. Posts appear as `~/posts/<slug>.md`; the handful of files at `~`
 * are the "who is this person" pages that would otherwise need their own
 * commands.
 */

export interface VFile {
  name: string;
  kind: 'file';
  /** Bytes, for the `ls -l` style listing. */
  size: number;
  modified: string;
  /** Set when the file is a post, so `cat` and `open` can find it. */
  slug?: string;
  /** Static body for the non-post files. */
  body?: string;
  hidden?: boolean;
}

export interface VDir {
  name: string;
  kind: 'dir';
  modified: string;
  hidden?: boolean;
}

export type VNode = VFile | VDir;

export const HOME = '~';
export const POSTS_DIR = '~/posts';

export const STATIC_FILES: Record<string, string> = {
  'about.md': `# whoami

Faizan — engineer. I build backends that stay up and interfaces that get out of
the way, and I have strong opinions about both.

This site is the long-form half of that. The short-form half is a terminal I
never close.

Things I care about: systems that fail loudly, tools that respect muscle
memory, and prose that says what it means on the first read.

  posts     what I have written
  tags      what I write about
  contact   how to reach me
`,

  'now.txt': `Currently
─────────
  · Building distributed systems and the tooling around them.
  · Reading about editor design and text rendering.
  · Writing the posts listed under ~/posts.

This file is a "now page" — the honest, dated answer to "what are you up to?".
`,

  'contact.txt': `Reach me
────────
  email     hello@sfaizh.top
  github    github.com/sfaizh
  site      https://sfaizh.top

I read everything. I reply to most of it.
`,

  '.zshrc': `# ~/.zshrc — the parts that matter

ZSH_THEME="powerlevel10k/powerlevel10k"
plugins=(git zsh-autosuggestions zsh-syntax-highlighting zsh-autocomplete fzf)

setopt HIST_IGNORE_ALL_DUPS SHARE_HISTORY INC_APPEND_HISTORY
bindkey -v                       # yes, vi mode
export EDITOR=nvim

alias ll='eza -la --git --icons'
alias cat='bat --style=plain'

# You found the dotfiles. There is nothing else hidden here. Probably.
`,
};

function bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

export interface Filesystem {
  /** Absolute-ish paths (`~`, `~/posts`) to their children. */
  entries: Map<string, VNode[]>;
  fileAt(path: string, name: string): VFile | undefined;
}

export function buildFilesystem(posts: PostMeta[]): Filesystem {
  const home: VNode[] = [
    { name: 'posts', kind: 'dir', modified: posts[0]?.date ?? new Date().toISOString() },
    ...Object.entries(STATIC_FILES).map(([name, body]) => ({
      name,
      kind: 'file' as const,
      size: bytes(body),
      modified: '2026-01-04T00:00:00.000Z',
      body,
      hidden: name.startsWith('.'),
    })),
  ];

  const postFiles: VNode[] = posts.map((post) => ({
    name: `${post.slug}.md`,
    kind: 'file' as const,
    size: post.words * 6,
    modified: post.updatedAt ?? post.date,
    slug: post.slug,
  }));

  const entries = new Map<string, VNode[]>([
    [HOME, home],
    [POSTS_DIR, postFiles],
  ]);

  return {
    entries,
    fileAt(path, name) {
      const node = entries.get(path)?.find((entry) => entry.name === name);
      return node?.kind === 'file' ? node : undefined;
    },
  };
}

/** Resolve a user-typed path against the current directory. */
export function resolvePath(cwd: string, target: string | undefined): string | null {
  if (!target || target === '.') return cwd;
  if (target === '~' || target === '/' || target === '~/') return HOME;
  if (target === '..') return cwd === HOME ? HOME : HOME;

  const normalised = target.replace(/\/+$/, '');
  const absolute = normalised.startsWith('~/')
    ? normalised
    : cwd === HOME
      ? `${HOME}/${normalised}`
      : `${cwd}/${normalised}`;

  return absolute === HOME || absolute === POSTS_DIR ? absolute : null;
}

/** `~` and `~/posts` are the only directories; everything else is a file. */
export function isDirectory(path: string): boolean {
  return path === HOME || path === POSTS_DIR;
}

export function humanSize(size: number): string {
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}K`;
  return `${(size / (1024 * 1024)).toFixed(1)}M`;
}

export function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
