import { HOME, POSTS_DIR, buildFilesystem, humanSize, isDirectory, resolvePath, shortDate } from './vfs';
import { TEST_POSTS } from './test-state';

describe('buildFilesystem', () => {
  const fs = buildFilesystem(TEST_POSTS);

  it('puts a posts directory and the static files at home', () => {
    const names = (fs.entries.get(HOME) ?? []).map((node) => node.name);
    expect(names).toContain('posts');
    expect(names).toContain('about.md');
    expect(names).toContain('contact.txt');
  });

  it('marks dotfiles as hidden', () => {
    const zshrc = (fs.entries.get(HOME) ?? []).find((node) => node.name === '.zshrc');
    expect(zshrc?.hidden).toBe(true);
  });

  it('exposes one markdown file per post, carrying its slug', () => {
    const files = fs.entries.get(POSTS_DIR) ?? [];
    expect(files).toHaveLength(TEST_POSTS.length);
    expect(files.map((node) => node.name)).toContain('building-a-terminal-blog.md');
    expect(fs.fileAt(POSTS_DIR, 'building-a-terminal-blog.md')?.slug).toBe('building-a-terminal-blog');
  });

  it('returns undefined for a directory looked up as a file', () => {
    expect(fs.fileAt(HOME, 'posts')).toBeUndefined();
  });

  it('copes with an empty post list', () => {
    expect(buildFilesystem([]).entries.get(POSTS_DIR)).toEqual([]);
  });
});

describe('resolvePath', () => {
  it('resolves relative and absolute forms of the posts directory', () => {
    expect(resolvePath(HOME, 'posts')).toBe(POSTS_DIR);
    expect(resolvePath(HOME, '~/posts')).toBe(POSTS_DIR);
    expect(resolvePath(HOME, 'posts/')).toBe(POSTS_DIR);
  });

  it('treats no argument as the current directory', () => {
    expect(resolvePath(POSTS_DIR, undefined)).toBe(POSTS_DIR);
    expect(resolvePath(POSTS_DIR, '.')).toBe(POSTS_DIR);
  });

  it('sends ~, / and .. home', () => {
    expect(resolvePath(POSTS_DIR, '~')).toBe(HOME);
    expect(resolvePath(POSTS_DIR, '/')).toBe(HOME);
    expect(resolvePath(POSTS_DIR, '..')).toBe(HOME);
  });

  it('returns null for anywhere that does not exist', () => {
    expect(resolvePath(HOME, 'etc')).toBeNull();
    expect(resolvePath(POSTS_DIR, 'deeper')).toBeNull();
  });
});

describe('formatting', () => {
  it('scales sizes', () => {
    expect(humanSize(512)).toBe('512B');
    expect(humanSize(2048)).toBe('2.0K');
    expect(humanSize(3 * 1024 * 1024)).toBe('3.0M');
  });

  it('formats dates and survives invalid ones', () => {
    expect(shortDate('2026-05-18T00:00:00.000Z')).toContain('2026');
    expect(shortDate('nonsense')).toBe('—');
  });

  it('knows which paths are directories', () => {
    expect(isDirectory(HOME)).toBe(true);
    expect(isDirectory(POSTS_DIR)).toBe(true);
    expect(isDirectory('~/nope')).toBe(false);
  });
});
