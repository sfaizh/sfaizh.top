import { deriveSummary, renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('gives headings stable ids and reports the outline', () => {
    const { html, headings } = renderMarkdown('## Verbs, nouns and counts\n\ntext\n');
    expect(html).toContain('<h2 id="verbs-nouns-and-counts">');
    expect(headings).toEqual([{ id: 'verbs-nouns-and-counts', text: 'Verbs, nouns and counts', depth: 2 }]);
  });

  it('disambiguates repeated headings', () => {
    const { headings } = renderMarkdown('## Notes\n\na\n\n## Notes\n\nb\n');
    expect(headings.map((heading) => heading.id)).toEqual(['notes', 'notes-1']);
  });

  it('renders a lone image as a figure outside any paragraph', () => {
    const { html } = renderMarkdown('![A caption](/img/a.svg)\n');
    expect(html).toContain('<figure class="md-figure">');
    expect(html).toContain('<figcaption>A caption</figcaption>');
    expect(html).not.toMatch(/<p>\s*<figure/);
  });

  /**
   * A 1200×1600 upload in a 38.5rem column is roughly 7.7MB of bitmap once
   * decoded. A dozen of them is past what a phone will hold, and iOS answers
   * by refusing to decode and painting the broken-image glyph — so the rungs
   * and the `sizes` that selects between them are load-bearing, not polish.
   */
  it('offers resized rungs for uploads, keeping the original as src', () => {
    const url = 'https://abc123.public.blob.vercel-storage.com/blog/2026/08/photo-xyz.webp';
    const { html } = renderMarkdown(`![A photo](${url})\n`);

    expect(html).toContain(`src="${url}"`);
    expect(html).toContain('srcset="');
    expect(html).toContain('/_next/image?url=');
    // The narrow rung is the one a phone picks; without it nothing is saved.
    expect(html).toContain('&amp;w=384&amp;q=75 384w');
    expect(html).toContain('&amp;w=1080&amp;q=75 1080w');
    expect(html).toContain('sizes="(max-width: 41.5rem) calc(100vw - 3rem), 38.5rem"');
  });

  it('leaves images the optimiser cannot handle on a plain src', () => {
    // Next refuses SVG unless `dangerouslyAllowSVG` is set, and a host missing
    // from `remotePatterns` is a 400 — either would be a broken image.
    const local = renderMarkdown('![Diagram](/content/img/vim-motions.svg)\n').html;
    expect(local).not.toContain('srcset');
    expect(local).toContain('src="/content/img/vim-motions.svg"');

    const foreign = renderMarkdown('![Photo](https://i.imgur.com/abc.jpg)\n').html;
    expect(foreign).not.toContain('srcset');
    expect(foreign).toContain('src="https://i.imgur.com/abc.jpg"');
  });

  it('keeps the language on a fenced code block and highlights it', () => {
    const { html } = renderMarkdown('```ts\nconst x = 1;\n```\n');
    expect(html).toContain('data-lang="ts"');
    expect(html).toContain('tok-keyword');
  });

  it('marks external links as noopener but leaves internal ones alone', () => {
    const external = renderMarkdown('[out](https://example.com)').html;
    expect(external).toContain('rel="noopener noreferrer"');

    const internal = renderMarkdown('[in](/posts/a)').html;
    expect(internal).not.toContain('rel=');
  });

  it('sanitises raw HTML embedded in the markdown', () => {
    const { html } = renderMarkdown('Before\n\n<script>alert(1)</script>\n\nAfter\n');
    expect(html).not.toContain('alert');
    expect(html).toContain('Before');
    expect(html).toContain('After');
  });

  it('renders GitHub-flavoured tables', () => {
    const { html } = renderMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |\n');
    expect(html).toContain('<table>');
    expect(html).toContain('<td>1</td>');
  });

  it('returns a plain-text projection for search', () => {
    const { text } = renderMarkdown('## Title\n\nSome **bold** prose.\n');
    expect(text).toBe('Title Some bold prose.');
  });
});

describe('deriveSummary', () => {
  it('uses the first substantial paragraph', () => {
    const summary = deriveSummary('# Heading\n\n![img](/a.png)\n\nThis is the first real paragraph of the post, long enough to count.\n');
    expect(summary).toBe('This is the first real paragraph of the post, long enough to count.');
  });

  it('truncates on a word boundary', () => {
    const summary = deriveSummary(`${'word '.repeat(100)}`, 40);
    expect(summary.length).toBeLessThanOrEqual(41);
    expect(summary.endsWith('…')).toBe(true);
  });

  it('ignores code blocks', () => {
    const summary = deriveSummary('```ts\nconst secret = 1;\n```\n\nThe prose paragraph that should be picked instead.\n');
    expect(summary).not.toContain('secret');
  });
});
