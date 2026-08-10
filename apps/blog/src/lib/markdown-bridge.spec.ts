import { countEditorWords, editorHtmlToMarkdown, markdownToEditorHtml } from './markdown-bridge';

describe('markdownToEditorHtml', () => {
  it('converts the constructs the editor can represent', () => {
    const html = markdownToEditorHtml('## Heading\n\nSome **bold** text.\n\n- one\n- two\n');

    expect(html).toContain('<h2');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<li>one</li>');
  });

  it('sanitises on the way in', () => {
    expect(markdownToEditorHtml('<script>alert(1)</script>\n\ntext')).not.toContain('alert');
  });
});

describe('editorHtmlToMarkdown', () => {
  it('converts headings, emphasis and lists', () => {
    const markdown = editorHtmlToMarkdown(
      '<h2>Heading</h2><p>Some <strong>bold</strong> and <em>italic</em>.</p><ul><li>one</li><li>two</li></ul>'
    );

    expect(markdown).toContain('## Heading');
    expect(markdown).toContain('**bold**');
    expect(markdown).toContain('*italic*');
    expect(markdown).toContain('- one');
  });

  it('keeps the language on a fenced code block', () => {
    const markdown = editorHtmlToMarkdown('<pre><code class="language-ts">const x = 1;</code></pre>');
    expect(markdown).toBe('```ts\nconst x = 1;\n```');
  });

  it('falls back to a bare fence when no language is set', () => {
    expect(editorHtmlToMarkdown('<pre><code>plain</code></pre>')).toBe('```\nplain\n```');
  });

  it('turns a figure back into an image with its caption as alt text', () => {
    const markdown = editorHtmlToMarkdown(
      '<figure><img src="/a.webp" alt="fallback" /><figcaption>The caption</figcaption></figure>'
    );
    expect(markdown).toBe('![The caption](/a.webp)');
  });

  it('converts a bare image', () => {
    expect(editorHtmlToMarkdown('<p><img src="/b.webp" alt="alt text" /></p>')).toBe('![alt text](/b.webp)');
  });

  it('converts strikethrough', () => {
    expect(editorHtmlToMarkdown('<p><del>gone</del></p>')).toBe('~~gone~~');
  });

  it('converts links', () => {
    expect(editorHtmlToMarkdown('<p><a href="https://example.com">text</a></p>')).toBe(
      '[text](https://example.com)'
    );
  });

  it('collapses runs of blank lines', () => {
    expect(editorHtmlToMarkdown('<p>a</p><p></p><p></p><p>b</p>')).toBe('a\n\nb');
  });

  it('drops anything the sanitiser rejects', () => {
    expect(editorHtmlToMarkdown('<p onclick="x()">text</p><script>bad()</script>')).toBe('text');
  });
});

describe('round trip', () => {
  const source = [
    '## A heading',
    '',
    'A paragraph with **bold**, *italic* and `code`.',
    '',
    '- first',
    '- second',
    '',
    '```ts',
    'const answer = 42;',
    '```',
    '',
    '> A quotation.',
    '',
    '![A picture](/content/img/a.webp)',
  ].join('\n');

  it('survives markdown → HTML → markdown', () => {
    const returned = editorHtmlToMarkdown(markdownToEditorHtml(source));

    expect(returned).toContain('## A heading');
    expect(returned).toContain('**bold**');
    expect(returned).toContain('`code`');
    expect(returned).toContain('- first');
    expect(returned).toContain('```ts\nconst answer = 42;\n```');
    expect(returned).toContain('> A quotation.');
    expect(returned).toContain('![A picture](/content/img/a.webp)');
  });

  it('is stable on a second pass', () => {
    const once = editorHtmlToMarkdown(markdownToEditorHtml(source));
    const twice = editorHtmlToMarkdown(markdownToEditorHtml(once));
    expect(twice).toBe(once);
  });
});

describe('countEditorWords', () => {
  it('counts prose, not markup', () => {
    expect(countEditorWords('<p>one two three</p>')).toBe(3);
  });

  it('is zero for an empty document', () => {
    expect(countEditorWords('')).toBe(0);
    expect(countEditorWords('<p></p>')).toBe(0);
  });
});
