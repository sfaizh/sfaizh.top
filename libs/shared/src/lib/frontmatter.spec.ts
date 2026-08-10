import { parseFrontmatter, serializeFrontmatter } from './frontmatter';

const SOURCE = `---
title: Building a terminal-shaped blog
date: 2026-05-18
summary: Why the reading surface of this site is a shell prompt, how the boot
  sequence earns its one-time cost, and what it takes.
tags: [design, frontend, terminal]
cover: /content/img/terminal-anatomy.svg
draft: false
---

Body starts here.

## A heading
`;

describe('parseFrontmatter', () => {
  it('reads scalars, arrays and booleans', () => {
    const { data } = parseFrontmatter(SOURCE);
    expect(data.title).toBe('Building a terminal-shaped blog');
    expect(data.tags).toEqual(['design', 'frontend', 'terminal']);
    expect(data.draft).toBe(false);
    expect(data.cover).toBe('/content/img/terminal-anatomy.svg');
  });

  it('folds indented continuation lines into the previous value', () => {
    const { data } = parseFrontmatter(SOURCE);
    expect(data.summary).toBe(
      'Why the reading surface of this site is a shell prompt, how the boot sequence earns its one-time cost, and what it takes.'
    );
  });

  it('returns the body without the delimiters', () => {
    const { body } = parseFrontmatter(SOURCE);
    expect(body.startsWith('Body starts here.')).toBe(true);
    expect(body).toContain('## A heading');
    expect(body).not.toContain('---');
  });

  it('treats a document with no frontmatter as all body', () => {
    const { data, body } = parseFrontmatter('# Just markdown\n');
    expect(data).toEqual({});
    expect(body).toBe('# Just markdown\n');
  });

  it('does not mistake a horizontal rule for frontmatter', () => {
    const { data, body } = parseFrontmatter('Some text\n\n---\n\nMore text\n');
    expect(data).toEqual({});
    expect(body).toContain('More text');
  });

  it('strips surrounding quotes', () => {
    const { data } = parseFrontmatter('---\ntitle: "A: colon in the title"\n---\nbody\n');
    expect(data.title).toBe('A: colon in the title');
  });

  it('handles CRLF line endings', () => {
    const { data } = parseFrontmatter('---\r\ntitle: Windows\r\n---\r\nbody\r\n');
    expect(data.title).toBe('Windows');
  });

  it('reads an empty array', () => {
    const { data } = parseFrontmatter('---\ntags: []\n---\nbody\n');
    expect(data.tags).toEqual([]);
  });
});

describe('serializeFrontmatter', () => {
  it('round-trips through the parser', () => {
    const data = { title: 'Round trip', date: '2026-01-01', tags: ['a', 'b'], draft: true };
    const parsed = parseFrontmatter(serializeFrontmatter(data, 'Body.\n'));

    expect(parsed.data.title).toBe('Round trip');
    expect(parsed.data.tags).toEqual(['a', 'b']);
    expect(parsed.data.draft).toBe(true);
    expect(parsed.body.trim()).toBe('Body.');
  });

  it('quotes values that would otherwise change meaning', () => {
    const output = serializeFrontmatter({ title: 'Key: value' }, 'body');
    expect(output).toContain('title: "Key: value"');
    expect(parseFrontmatter(output).data.title).toBe('Key: value');
  });

  it('omits undefined and null values', () => {
    const output = serializeFrontmatter({ title: 'x', cover: undefined, extra: null }, 'body');
    expect(output).not.toContain('cover');
    expect(output).not.toContain('extra');
  });
});
