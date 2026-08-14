import { Marked, type RendererObject, type Tokens } from 'marked';
import { highlight, normaliseLanguage, escapeHtml } from './highlight';
import { sanitizeHtml, stripHtml } from './sanitize';
import { headingId } from './slug';
import type { PostHeading } from './types';

export interface RenderResult {
  html: string;
  headings: PostHeading[];
  /** Plain text of the body, used for search and excerpts. */
  text: string;
}

/**
 * Uploads live in Vercel Blob, and Next's optimiser is already configured to
 * resize that host (`images.remotePatterns` in the blog's next.config.js).
 * Matching on the hostname keeps everything else — local SVG diagrams, any
 * surviving third-party link — on a plain `src`, which is what we want: the
 * optimiser refuses SVG by default, and a host it has not been told about is a
 * 400 rather than an image.
 */
const OPTIMISABLE_HOST = /^https:\/\/[^/]*\.public\.blob\.vercel-storage\.com\//;

/**
 * The rungs offered to the browser.
 *
 * Capped at 1080 deliberately. The reader's column is 38.5rem, so 1080 already
 * covers a 2× display, and every rung past that costs decoded memory rather
 * than detail — a phone holding a dozen 1200×1600 photographs is carrying
 * around 108MB of bitmap, which is where iOS starts refusing to decode at all
 * and paints the broken-image glyph instead.
 */
const IMAGE_WIDTHS = [384, 640, 828, 1080];

/**
 * The column the images actually occupy: `.prose-reader` is `max-width:
 * 41.5rem` with `1.5rem` of padding a side. Getting this right is the whole
 * point — `sizes` is what lets a phone choose the 384 rung instead of the 1080
 * one, and a wrong value silently wastes the exercise.
 */
const IMAGE_SIZES = '(max-width: 41.5rem) calc(100vw - 3rem), 38.5rem';

function optimised(href: string, width: number): string {
  return `/_next/image?url=${encodeURIComponent(href)}&w=${width}&q=75`;
}

/** `srcset`/`sizes` for an upload; nothing at all for anything else. */
function responsiveAttributes(href: string): string {
  if (!OPTIMISABLE_HOST.test(href)) return '';
  const srcset = IMAGE_WIDTHS.map((width) => `${optimised(href, width)} ${width}w`).join(', ');
  return ` srcset="${escapeHtml(srcset)}" sizes="${escapeHtml(IMAGE_SIZES)}"`;
}

/**
 * Markdown → HTML for the reader. Rendering happens on the server; the client
 * receives sanitised HTML plus the heading outline that `]]` / `[[` jump
 * between.
 */
export function renderMarkdown(markdown: string): RenderResult {
  const headings: PostHeading[] = [];
  const seen = new Map<string, number>();

  const marked = new Marked({ gfm: true, breaks: false });

  const renderer: RendererObject = {
      heading(token: Tokens.Heading) {
        const inline = this.parser.parseInline(token.tokens);
        const id = headingId(stripHtml(inline), seen);
        if (token.depth <= 3) {
          headings.push({ id, text: stripHtml(inline), depth: token.depth });
        }
        return `<h${token.depth} id="${id}">${inline}</h${token.depth}>\n`;
      },

      code(token: Tokens.Code) {
        const lang = normaliseLanguage(token.lang);
        const body = highlight(token.text, lang);
        const label = lang ? ` data-lang="${escapeHtml(lang)}"` : '';
        const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
        return `<pre${label}${cls}><code${cls}>${body}</code></pre>\n`;
      },

      /**
       * A lone image on its own line becomes a `<figure>`, and a `<figure>`
       * inside a `<p>` is invalid HTML that browsers silently tear apart. When
       * a paragraph holds nothing but an image, the paragraph is dropped.
       */
      paragraph(token: Tokens.Paragraph) {
        const inline = this.parser.parseInline(token.tokens);
        const lone = token.tokens.length === 1 && token.tokens[0].type === 'image';
        return lone ? inline : `<p>${inline}</p>\n`;
      },

      image(token: Tokens.Image) {
        const alt = escapeHtml(token.text ?? '');
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
        const caption = token.text ? `<figcaption>${alt}</figcaption>` : '';
        // `src` stays the original upload so the image still resolves if the
        // optimiser is ever unavailable; `srcset` is what a modern browser
        // actually uses.
        return (
          `<figure class="md-figure">` +
          `<img src="${escapeHtml(token.href)}"${responsiveAttributes(token.href)} alt="${alt}"${title} loading="lazy" decoding="async" />` +
          `${caption}</figure>\n`
        );
      },

      link(token: Tokens.Link) {
        const inner = this.parser.parseInline(token.tokens);
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
        const external = /^https?:\/\//i.test(token.href);
        const rel = external ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${escapeHtml(token.href)}"${title}${rel}>${inner}</a>`;
      },
  };

  marked.use({ renderer });

  const raw = marked.parse(markdown, { async: false }) as string;
  const html = sanitizeHtml(raw);

  return { html, headings, text: stripHtml(html) };
}

/** First meaningful paragraph, trimmed — the fallback when no summary is set. */
export function deriveSummary(markdown: string, maxLength = 200): string {
  const body = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\s{0,3}#{1,6}\s+.*$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .trim();

  const paragraph = body.split(/\n\s*\n/).find((chunk) => chunk.trim().length > 40) ?? '';
  const text = stripHtml(paragraph.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`>]/g, ''));

  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}
