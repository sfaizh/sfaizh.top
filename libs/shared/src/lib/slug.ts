/**
 * Slugs double as filenames, database primary keys and terminal arguments, so
 * they are deliberately restricted to lowercase alphanumerics and hyphens.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 96);
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 96 && SLUG_PATTERN.test(value);
}

/** Deterministic anchor ids for headings, with a counter for duplicates. */
export function headingId(text: string, seen: Map<string, number>): string {
  const base = slugify(text) || 'section';
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}
