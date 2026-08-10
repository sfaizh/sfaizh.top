'use client';

import { Marked } from 'marked';
import TurndownService from 'turndown';
import { sanitizeHtml } from '@sfaizh/shared';

/**
 * The WYSIWYG editor speaks HTML; the repository, the database and the reader
 * all speak markdown. This module is the only place the two meet.
 *
 * Round-tripping is lossy by nature, so the rules here are deliberately narrow:
 * they cover exactly the constructs the editor can produce, and anything else
 * survives as-is because the markdown is never regenerated from scratch — the
 * editor only ever rewrites what the author actually touched.
 */

const marked = new Marked({ gfm: true, breaks: false });

/** Markdown → HTML for loading a post into the editor. */
export function markdownToEditorHtml(markdown: string): string {
  return sanitizeHtml(marked.parse(markdown, { async: false }) as string);
}

let turndown: TurndownService | null = null;

function service(): TurndownService {
  if (turndown) return turndown;

  turndown = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });

  // Keep the language on fenced blocks — losing it would lose the highlighting.
  turndown.addRule('fencedCodeWithLanguage', {
    filter: (node) =>
      node.nodeName === 'PRE' && node.firstChild !== null && node.firstChild.nodeName === 'CODE',
    replacement: (_content, node) => {
      const code = (node as HTMLElement).querySelector('code');
      const className = code?.getAttribute('class') ?? '';
      const language = /language-([\w-]+)/.exec(className)?.[1] ?? '';
      const body = (code?.textContent ?? '').replace(/\n$/, '');
      return `\n\n\`\`\`${language}\n${body}\n\`\`\`\n\n`;
    },
  });

  // Turndown indents list content by three spaces after the marker. One space
  // is what the posts in the repository use, and it keeps diffs readable.
  turndown.addRule('listItem', {
    filter: 'li',
    replacement: (content, node) => {
      const body = content
        .replace(/^\n+/, '')
        .replace(/\n+$/, '\n')
        .replace(/\n/gm, '\n  ');

      const parent = node.parentNode as HTMLElement | null;
      let prefix = '- ';
      if (parent?.nodeName === 'OL') {
        const start = Number(parent.getAttribute('start') ?? 1);
        const index = Array.prototype.indexOf.call(parent.children, node);
        prefix = `${start + index}. `;
      }

      return prefix + body + (node.nextSibling && !/\n$/.test(body) ? '\n' : '');
    },
  });

  turndown.addRule('strikethrough', {
    filter: ['del', 's'],
    replacement: (content) => `~~${content}~~`,
  });

  // A figure is an image with a caption; markdown expresses that as alt text.
  turndown.addRule('figure', {
    filter: (node) => node.nodeName === 'FIGURE',
    replacement: (_content, node) => {
      const image = (node as HTMLElement).querySelector('img');
      if (!image) return '';
      const caption = (node as HTMLElement).querySelector('figcaption')?.textContent?.trim();
      const alt = caption || image.getAttribute('alt') || '';
      return `\n\n![${alt}](${image.getAttribute('src') ?? ''})\n\n`;
    },
  });

  return turndown;
}

/** HTML → markdown for saving. */
export function editorHtmlToMarkdown(html: string): string {
  return service()
    .turndown(sanitizeHtml(html))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Rough word count for the editor statusline. */
export function countEditorWords(html: string): number {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .trim();
  return text ? text.split(/\s+/).length : 0;
}
