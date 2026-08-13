import { byDateDescending, markdownFromPost, postFromMarkdown, slugFromFilename, toMeta } from './post-file';
import { isValidSlug, slugify } from './slug';
import { countWords, readingMinutes } from './reading';
import { parsePostUpsert, ValidationError, assertUploadable } from './validate';

const SOURCE = `---
title: A Post
date: 2026-03-04
summary: A short summary.
tags: [Design, TERMINAL]
draft: false
---

Body paragraph one.

Body paragraph two.
`;

describe('postFromMarkdown', () => {
  it('maps frontmatter onto a post', () => {
    const post = postFromMarkdown('a-post', SOURCE);
    expect(post.title).toBe('A Post');
    expect(post.summary).toBe('A short summary.');
    expect(post.date).toBe(new Date('2026-03-04').toISOString());
    expect(post.draft).toBe(false);
    expect(post.source).toBe('file');
    expect(post.markdown.startsWith('Body paragraph one.')).toBe(true);
  });

  it('lowercases tags', () => {
    expect(postFromMarkdown('a-post', SOURCE).tags).toEqual(['design', 'terminal']);
  });

  it('derives reading time and word count from the body', () => {
    const post = postFromMarkdown('a-post', SOURCE);
    expect(post.words).toBeGreaterThan(0);
    expect(post.readingMinutes).toBeGreaterThanOrEqual(1);
  });

  it('falls back to the slug when a title is missing', () => {
    expect(postFromMarkdown('fallback-slug', 'body only').title).toBe('fallback-slug');
  });

  it('derives a summary when none is given', () => {
    const post = postFromMarkdown('x', '---\ntitle: T\n---\n\nA paragraph long enough to be used as the summary of this post.\n');
    expect(post.summary).toContain('A paragraph long enough');
  });

  it('survives an unparseable date', () => {
    const post = postFromMarkdown('x', '---\ntitle: T\ndate: not-a-date\n---\nbody\n');
    expect(Number.isNaN(new Date(post.date).getTime())).toBe(false);
  });
});

describe('markdownFromPost', () => {
  it('round-trips a post back into a file', () => {
    const original = postFromMarkdown('a-post', SOURCE);
    const reparsed = postFromMarkdown('a-post', markdownFromPost(original));

    expect(reparsed.title).toBe(original.title);
    expect(reparsed.tags).toEqual(original.tags);
    expect(reparsed.markdown.trim()).toBe(original.markdown.trim());
  });
});

describe('helpers', () => {
  it('strips the body from a post to make metadata', () => {
    expect('markdown' in toMeta(postFromMarkdown('a', SOURCE))).toBe(false);
  });

  it('sorts newest first with a stable tiebreak', () => {
    const older = { date: '2025-01-01T00:00:00.000Z', slug: 'b' };
    const newer = { date: '2026-01-01T00:00:00.000Z', slug: 'a' };
    expect(byDateDescending(older as never, newer as never)).toBeGreaterThan(0);
    expect(byDateDescending({ ...newer } as never, { ...newer, slug: 'z' } as never)).toBeLessThan(0);
  });

  it('derives slugs from filenames', () => {
    expect(slugFromFilename('Building A Blog.md')).toBe('building-a-blog');
    expect(slugFromFilename('already-fine.mdx')).toBe('already-fine');
  });
});

describe('slugify', () => {
  it('produces url-safe slugs', () => {
    expect(slugify("Vim Motions as a Design Language!")).toBe('vim-motions-as-a-design-language');
    expect(slugify('  spaced   out  ')).toBe('spaced-out');
    expect(slugify("don't panic")).toBe('dont-panic');
  });

  it('validates slug shape', () => {
    expect(isValidSlug('a-valid-slug')).toBe(true);
    expect(isValidSlug('Not Valid')).toBe(false);
    expect(isValidSlug('-leading')).toBe(false);
    expect(isValidSlug('')).toBe(false);
  });
});

describe('reading estimates', () => {
  it('ignores markdown syntax when counting words', () => {
    expect(countWords('**bold** *italic*')).toBe(2);
    expect(countWords('```ts\nconst a = 1;\n```')).toBe(0);
  });

  it('never reports less than a minute', () => {
    expect(readingMinutes('one word')).toBe(1);
  });

  it('scales with length', () => {
    expect(readingMinutes('word '.repeat(2000))).toBeGreaterThan(5);
  });
});

describe('parsePostUpsert', () => {
  const valid = { slug: 'a-post', title: 'A post', markdown: '# hi' };

  it('accepts a well-formed payload', () => {
    const parsed = parsePostUpsert({ ...valid, tags: [' Design ', 'design', 'TERMINAL'] });
    expect(parsed.slug).toBe('a-post');
    expect(parsed.tags).toEqual(['design', 'terminal']);
    expect(parsed.draft).toBe(false);
  });

  it('rejects an invalid slug', () => {
    expect(() => parsePostUpsert({ ...valid, slug: 'Not A Slug' })).toThrow(ValidationError);
  });

  it('requires a title', () => {
    expect(() => parsePostUpsert({ ...valid, title: '   ' })).toThrow(/title is required/);
  });

  it('requires a body in one form or the other', () => {
    expect(() => parsePostUpsert({ slug: 'a-post', title: 'T' })).toThrow(/contentEncoded or markdown/);
  });

  it('rejects an invalid date', () => {
    expect(() => parsePostUpsert({ ...valid, date: 'yesterday' })).toThrow(/ISO-8601/);
  });

  it('normalises a valid date to ISO', () => {
    expect(parsePostUpsert({ ...valid, date: '2026-02-03' }).date).toBe(new Date('2026-02-03').toISOString());
  });

  it('collects every issue at once', () => {
    try {
      parsePostUpsert({ slug: 'BAD', title: '' });
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as ValidationError).issues.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('assertUploadable', () => {
  it('accepts compressed image types', () => {
    expect(() => assertUploadable('image/webp', 1024)).not.toThrow();
  });

  it('accepts GIF, which is uploaded uncompressed to keep the animation', () => {
    expect(() => assertUploadable('image/gif', 1024)).not.toThrow();
  });

  it('rejects other content types', () => {
    expect(() => assertUploadable('application/pdf', 1024)).toThrow(/unsupported content type/);
  });

  it('rejects empty and oversized uploads', () => {
    expect(() => assertUploadable('image/webp', 0)).toThrow(/empty upload/);
    expect(() => assertUploadable('image/webp', 99 * 1024 * 1024)).toThrow(/exceeds/);
  });
});
