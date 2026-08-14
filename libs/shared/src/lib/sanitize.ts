/**
 * A conservative allow-list sanitiser for rendered markdown.
 *
 * The only author is me, but the WYSIWYG editor round-trips through HTML and
 * markdown allows raw HTML through, so untrusted-shaped content can reach the
 * renderer by accident. This strips anything not on the list rather than
 * trying to enumerate what is dangerous.
 */

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'wbr']);

/** Tags whose entire contents are dropped, not just their markup. */
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'svg', 'math']);

const ALLOWED_TAGS: Record<string, readonly string[]> = {
  p: [], br: [], hr: [], em: [], strong: [], del: [], s: [], sub: [], sup: [], mark: [],
  h1: ['id'], h2: ['id'], h3: ['id'], h4: ['id'], h5: ['id'], h6: ['id'],
  ul: [], ol: ['start'], li: [],
  blockquote: [], figure: ['class'], figcaption: [],
  pre: ['class', 'data-lang'], code: ['class'],
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'srcset', 'sizes', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
  table: [], thead: [], tbody: [], tr: [], th: ['align', 'scope'], td: ['align'],
  span: ['class'], div: ['class'], section: ['class'], details: [], summary: [],
};

/** `class` values are further restricted so styling cannot be hijacked. */
const CLASS_PREFIXES = ['tok-', 'language-', 'md-', 'callout', 'footnote'];

const URL_ATTRIBUTES = new Set(['href', 'src']);

/**
 * `srcset` is a URL attribute wearing a disguise — a comma-separated list of
 * `url descriptor` pairs — so it needs the same scheme check as `src`, applied
 * to every candidate rather than to the string as a whole. One bad entry
 * rejects the lot; a partially-filtered srcset is harder to reason about than
 * none, and dropping it only costs the responsive rungs, never the image.
 */
function isSafeSrcset(value: string): boolean {
  const candidates = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (candidates.length === 0) return false;
  return candidates.every((entry) => isSafeUrl(entry.split(/\s+/)[0]));
}

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return false;
  // Relative and root-relative URLs are always fine.
  if (/^[./#?]/.test(trimmed)) return true;
  if (/^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(trimmed)) return true;
  return /^(https?:|mailto:)/i.test(trimmed);
}

function filterClasses(value: string): string {
  return value
    .split(/\s+/)
    .filter((cls) => CLASS_PREFIXES.some((prefix) => cls.startsWith(prefix)))
    .join(' ');
}

const ATTRIBUTE_PATTERN = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>`]+)))?/g;

function sanitizeAttributes(tag: string, raw: string): string {
  const allowed = ALLOWED_TAGS[tag];
  if (!allowed || allowed.length === 0) return '';

  const kept: string[] = [];
  ATTRIBUTE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ATTRIBUTE_PATTERN.exec(raw)) !== null) {
    const name = match[1].toLowerCase();
    if (!allowed.includes(name)) continue;

    let value = match[2] ?? match[3] ?? match[4] ?? '';
    // Entity-decode just enough that `java&#115;cript:` cannot sneak through.
    const probe = value.replace(/&#(\d+);?/g, (_, code) => String.fromCharCode(Number(code)));

    if (URL_ATTRIBUTES.has(name) && !isSafeUrl(probe)) continue;
    if (name === 'srcset' && !isSafeSrcset(probe)) continue;
    if (name === 'class') {
      value = filterClasses(value);
      if (!value) continue;
    }
    kept.push(`${name}="${value.replace(/"/g, '&quot;')}"`);
  }

  return kept.length ? ` ${kept.join(' ')}` : '';
}

/**
 * Strip everything outside the allow-list. Disallowed tags lose their markup
 * but keep their text; a handful of tags lose their contents too.
 */
export function sanitizeHtml(html: string): string {
  let working = html;

  for (const tag of DROP_WITH_CONTENT) {
    working = working.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
    working = working.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '');
  }
  // HTML comments can hide conditional markup.
  working = working.replace(/<!--[\s\S]*?-->/g, '');

  return working.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (whole, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!(tag in ALLOWED_TAGS)) return '';

    const isClosing = whole.startsWith('</');
    if (isClosing) return VOID_TAGS.has(tag) ? '' : `</${tag}>`;

    const attrs = sanitizeAttributes(tag, rawAttrs);
    return VOID_TAGS.has(tag) ? `<${tag}${attrs} />` : `<${tag}${attrs}>`;
  });
}

/** Text-only projection, used for search snippets and meta descriptions. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
