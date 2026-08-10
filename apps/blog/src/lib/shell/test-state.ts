import { DEFAULT_FLAVOUR, type PostMeta } from '@sfaizh/shared';
import type { ShellState } from './types';
import { HOME, buildFilesystem } from './vfs';

/** Two posts, shaped like the real index, for the shell tests. */
export const TEST_POSTS: PostMeta[] = [
  {
    slug: 'vim-motions-as-a-design-language',
    title: 'Vim motions as a design language',
    summary: 'Modal editing is a UI pattern.',
    date: '2026-06-27T00:00:00.000Z',
    tags: ['vim', 'design'],
    readingMinutes: 7,
    words: 1400,
    draft: false,
    source: 'file',
  },
  {
    slug: 'building-a-terminal-blog',
    title: 'Building a terminal-shaped blog',
    summary: 'Why the front door is a prompt.',
    date: '2026-05-18T00:00:00.000Z',
    tags: ['design', 'terminal'],
    readingMinutes: 6,
    words: 1200,
    draft: false,
    source: 'file',
  },
];

export function makeState(overrides: Partial<ShellState> = {}): ShellState {
  const posts = overrides.posts ?? TEST_POSTS;
  return {
    cwd: HOME,
    posts,
    fs: buildFilesystem(posts),
    history: [],
    flavour: DEFAULT_FLAVOUR,
    stats: { posts: posts.length, drafts: 0, tags: 3, words: 2600, storage: 'filesystem' },
    lastExit: 0,
    reducedMotion: false,
    motion: 'auto' as const,
    ...overrides,
    // The filesystem must always match whichever post list won.
    ...(overrides.posts ? { fs: buildFilesystem(overrides.posts) } : {}),
  };
}
