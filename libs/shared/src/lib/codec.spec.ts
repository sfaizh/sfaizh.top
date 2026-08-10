import {
  CODEC_MAGIC,
  compressionRatio,
  decodeMarkdown,
  decodeMarkdownDetailed,
  encodeMarkdown,
  ensureEncoded,
  isEncodedMarkdown,
  utf8Bytes,
} from './codec';

describe('markdown codec', () => {
  it('round-trips a document unchanged', () => {
    const markdown = '# Title\n\nSome *prose* with `code` and a [link](https://example.com).\n';
    expect(decodeMarkdown(encodeMarkdown(markdown))).toBe(markdown);
  });

  it('round-trips multi-byte characters', () => {
    const markdown = 'Katakana カタカナ · emoji 🌱 · combining é · zero-width​ end';
    expect(decodeMarkdown(encodeMarkdown(markdown))).toBe(markdown);
  });

  it('round-trips an empty document', () => {
    expect(decodeMarkdown(encodeMarkdown(''))).toBe('');
  });

  it('round-trips a document larger than one base64 chunk', () => {
    const markdown = 'paragraph of text\n\n'.repeat(5000);
    expect(decodeMarkdown(encodeMarkdown(markdown))).toBe(markdown);
  });

  it('tags encoded payloads with the magic prefix', () => {
    const encoded = encodeMarkdown('hello');
    expect(encoded.startsWith(`${CODEC_MAGIC}.`)).toBe(true);
    expect(isEncodedMarkdown(encoded)).toBe(true);
  });

  it('produces URL-safe output', () => {
    const encoded = encodeMarkdown('the quick brown fox '.repeat(200));
    expect(encoded.slice(CODEC_MAGIC.length + 1)).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('passes plain markdown through untouched', () => {
    expect(isEncodedMarkdown('# not encoded')).toBe(false);
    expect(decodeMarkdown('# not encoded')).toBe('# not encoded');
  });

  it('is idempotent through ensureEncoded', () => {
    const once = ensureEncoded('body');
    expect(ensureEncoded(once)).toBe(once);
    expect(decodeMarkdown(ensureEncoded(once))).toBe('body');
  });

  it('reports raw and encoded sizes', () => {
    const markdown = 'a'.repeat(1000);
    const result = decodeMarkdownDetailed(encodeMarkdown(markdown));
    expect(result.rawBytes).toBe(1000);
    expect(result.encodedBytes).toBeLessThan(result.rawBytes);
  });

  it('actually compresses repetitive prose', () => {
    const markdown = 'the same sentence over and over. '.repeat(300);
    expect(compressionRatio(markdown, encodeMarkdown(markdown))).toBeGreaterThan(0.9);
  });

  it('throws a useful error on a corrupt payload', () => {
    expect(() => decodeMarkdown(`${CODEC_MAGIC}.notvaliddeflate`)).toThrow(/Corrupt markdown payload/);
  });

  it('counts UTF-8 bytes rather than code units', () => {
    expect(utf8Bytes('abc')).toBe(3);
    expect(utf8Bytes('é')).toBe(2);
    expect(utf8Bytes('🌱')).toBe(4);
  });
});
