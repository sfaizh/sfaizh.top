/** Average adult reading speed for technical prose, words per minute. */
const WORDS_PER_MINUTE = 220;

/** Strip the markdown syntax that would otherwise inflate the word count. */
function toProse(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/[*_>~|-]+/g, ' ');
}

export function countWords(markdown: string): number {
  const prose = toProse(markdown).trim();
  if (!prose) return 0;
  return prose.split(/\s+/).length;
}

export function readingMinutes(markdown: string): number {
  const words = countWords(markdown);
  // Code blocks are skimmed rather than read, but still cost something.
  const codeLines = (markdown.match(/```[\s\S]*?```/g) ?? []).join('\n').split('\n').length;
  const minutes = words / WORDS_PER_MINUTE + codeLines / 90;
  return Math.max(1, Math.round(minutes));
}
