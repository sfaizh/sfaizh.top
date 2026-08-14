import { sanitizeHtml, stripHtml } from './sanitize';

describe('sanitizeHtml', () => {
  it('keeps allowed structural markup', () => {
    const html = '<h2 id="a">Title</h2><p>Body <strong>bold</strong> <em>italic</em></p>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('removes script tags along with their contents', () => {
    const output = sanitizeHtml('<p>before</p><script>alert(1)</script><p>after</p>');
    expect(output).not.toContain('alert');
    expect(output).toContain('before');
    expect(output).toContain('after');
  });

  it('removes style, iframe and object elements', () => {
    for (const tag of ['style', 'iframe', 'object']) {
      expect(sanitizeHtml(`<${tag}>payload</${tag}>`)).not.toContain('payload');
    }
  });

  it('drops event handler attributes', () => {
    const output = sanitizeHtml('<p onclick="steal()">text</p>');
    expect(output).toBe('<p>text</p>');
  });

  it('rejects javascript: URLs', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
  });

  it('rejects entity-encoded javascript: URLs', () => {
    expect(sanitizeHtml('<a href="java&#115;cript:alert(1)">x</a>')).toBe('<a>x</a>');
  });

  it('allows http, mailto and relative URLs', () => {
    expect(sanitizeHtml('<a href="https://example.com">x</a>')).toContain('href="https://example.com"');
    expect(sanitizeHtml('<a href="mailto:a@b.c">x</a>')).toContain('mailto:a@b.c');
    expect(sanitizeHtml('<img src="/content/img/a.svg" alt="a" />')).toContain('src="/content/img/a.svg"');
  });

  it('allows base64 image data URLs but not other data URLs', () => {
    expect(sanitizeHtml('<img src="data:image/png;base64,AAAA" alt="" />')).toContain('data:image/png');
    expect(sanitizeHtml('<img src="data:text/html;base64,AAAA" alt="" />')).not.toContain('data:text/html');
  });

  it('keeps a srcset whose every candidate is a safe URL', () => {
    const html = '<img src="/a.webp" srcset="/a-384.webp 384w, /a-640.webp 640w" sizes="50vw" />';
    const output = sanitizeHtml(html);
    expect(output).toContain('srcset="/a-384.webp 384w, /a-640.webp 640w"');
    expect(output).toContain('sizes="50vw"');
  });

  it('drops the whole srcset when any candidate is unsafe', () => {
    const output = sanitizeHtml('<img src="/a.webp" srcset="/a-384.webp 384w, javascript:alert(1) 640w" />');
    expect(output).not.toContain('srcset');
    // The image itself survives — only the responsive rungs are lost.
    expect(output).toContain('src="/a.webp"');
  });

  it('unwraps disallowed tags but keeps their text', () => {
    expect(sanitizeHtml('<marquee>still readable</marquee>')).toBe('still readable');
  });

  it('restricts class names to the known prefixes', () => {
    expect(sanitizeHtml('<span class="tok-string">x</span>')).toContain('class="tok-string"');
    expect(sanitizeHtml('<span class="fixed inset-0 z-50">x</span>')).toBe('<span>x</span>');
  });

  it('removes HTML comments', () => {
    expect(sanitizeHtml('<p>a</p><!-- hidden --><p>b</p>')).toBe('<p>a</p><p>b</p>');
  });

  it('closes void elements consistently', () => {
    expect(sanitizeHtml('<br></br>')).toBe('<br />');
  });
});

describe('stripHtml', () => {
  it('reduces markup to readable text', () => {
    expect(stripHtml('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('decodes the entities the renderer produces', () => {
    expect(stripHtml('<p>a &amp; b &lt;c&gt; &quot;d&quot;</p>')).toBe('a & b <c> "d"');
  });
});
