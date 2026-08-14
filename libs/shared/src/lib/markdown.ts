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
        // A plain image tag, deliberately. No `srcset`, no `sizes`, no
        // `loading`, no `decoding` — every one of those was tried against a
        // mobile rendering fault and every one of them either did nothing or
        // moved the symptom somewhere new. The browser is left to fetch and
        // paint the file exactly as it is given.
        return (
          `<figure class="md-figure">` +
          `<img src="${escapeHtml(token.href)}" alt="${alt}"${title} />` +
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
