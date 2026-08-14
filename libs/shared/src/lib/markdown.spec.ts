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
   * The image tag stays plain. Every attribute that has been tried here —
   * `srcset`, `sizes`, `loading`, `decoding`, a rewritten `src` pointing at an
   * image optimiser — was aimed at a mobile rendering fault, and each one
   * either changed nothing or moved the symptom. The URL the author wrote is
   * the URL the browser fetches.
   */
  it('emits a plain image tag with no loading or optimisation hints', () => {
    const url = 'https://abc123.public.blob.vercel-storage.com/blog/2026/08/photo-xyz.webp';
    const { html } = renderMarkdown(`![A photo](${url})\n`);

    expect(html).toContain(`<img src="${url}" alt="A photo" />`);
    expect(html).not.toContain('srcset');
    expect(html).not.toContain('sizes=');
    expect(html).not.toContain('loading=');
    expect(html).not.toContain('decoding=');
    expect(html).not.toContain('/_next/image');
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
