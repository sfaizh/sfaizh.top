import { escapeHtml, highlight, normaliseLanguage } from './highlight';

describe('escapeHtml', () => {
  it('escapes every character that could open a tag', () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  });
});

describe('highlight', () => {
  it('colours TypeScript keywords, strings and comments', () => {
    const output = highlight('const x = "hi"; // note', 'ts');
    expect(output).toContain('<span class="tok-keyword">const</span>');
    expect(output).toContain('<span class="tok-string">&quot;hi&quot;</span>');
    expect(output).toContain('<span class="tok-comment">// note</span>');
  });

  it('escapes source that looks like markup', () => {
    const output = highlight('const html = "<script>";', 'ts');
    expect(output).not.toContain('<script>');
    expect(output).toContain('&lt;script&gt;');
  });

  it('handles shell variables and flags', () => {
    const output = highlight('npm run build --if-present $HOME', 'bash');
    expect(output).toContain('<span class="tok-builtin">npm</span>');
    expect(output).toContain('<span class="tok-variable">$HOME</span>');
    expect(output).toContain('<span class="tok-operator">--if-present</span>');
  });

  it('leaves quoted shell text as a single string token', () => {
    // Expansions inside double quotes are not re-scanned; one pass, one token.
    expect(highlight('echo "$HOME"', 'bash')).toContain('<span class="tok-string">&quot;$HOME&quot;</span>');
  });

  it('colours JSON keys separately from string values', () => {
    const output = highlight('{"key": "value"}', 'json');
    expect(output).toContain('<span class="tok-property">&quot;key&quot;</span>');
    expect(output).toContain('<span class="tok-string">&quot;value&quot;</span>');
  });

  it('escapes but does not colour unknown languages', () => {
    expect(highlight('a < b', 'brainfuck')).toBe('a &lt; b');
    expect(highlight('a < b')).toBe('a &lt; b');
  });

  it('preserves the source text exactly once tags are stripped', () => {
    const source = 'function greet(name: string) {\n  return `hi ${name}`;\n}';
    const plain = highlight(source, 'ts')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
    expect(plain).toBe(source);
  });

  it('terminates on pathological input', () => {
    // A regression guard: a zero-length match used to spin the tokeniser.
    expect(() => highlight('/'.repeat(500), 'ts')).not.toThrow();
    expect(() => highlight('', 'ts')).not.toThrow();
  });
});

describe('normaliseLanguage', () => {
  it('lowercases and takes the first word', () => {
    expect(normaliseLanguage('  TS  ')).toBe('ts');
    expect(normaliseLanguage('js title="x"')).toBe('js');
    expect(normaliseLanguage(undefined)).toBe('');
  });
});
