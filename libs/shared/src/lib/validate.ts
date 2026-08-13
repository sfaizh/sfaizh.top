import { isValidSlug } from './slug';
import type { PostUpsert } from './types';

/**
 * Hand-rolled validation rather than `class-validator`, because the API is
 * compiled by Next's SWC when it is mounted in-process and we do not want the
 * backend's correctness to depend on `emitDecoratorMetadata` being honoured.
 */
export class ValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join('; '));
    this.name = 'ValidationError';
  }
}

const MAX_TITLE = 160;
const MAX_SUMMARY = 400;
const MAX_TAGS = 12;
const MAX_MARKDOWN_BYTES = 1_000_000;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate and normalise an untrusted admin payload into a `PostUpsert`.
 * Unknown keys are dropped rather than rejected.
 */
export function parsePostUpsert(input: unknown): PostUpsert {
  const issues: string[] = [];
  const body = (input ?? {}) as Record<string, unknown>;

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  if (!isValidSlug(slug)) {
    issues.push('slug must be lowercase alphanumeric words separated by hyphens');
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!isNonEmptyString(title)) issues.push('title is required');
  else if (title.length > MAX_TITLE) issues.push(`title must be <= ${MAX_TITLE} characters`);

  const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
  if (summary.length > MAX_SUMMARY) issues.push(`summary must be <= ${MAX_SUMMARY} characters`);

  let date: string | undefined;
  if (body.date !== undefined && body.date !== null && body.date !== '') {
    const parsed = new Date(String(body.date));
    if (Number.isNaN(parsed.getTime())) issues.push('date must be a valid ISO-8601 date');
    else date = parsed.toISOString();
  }

  let tags: string[] = [];
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      issues.push('tags must be an array of strings');
    } else {
      tags = body.tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);
      if (tags.length > MAX_TAGS) issues.push(`no more than ${MAX_TAGS} tags`);
      tags = Array.from(new Set(tags)).slice(0, MAX_TAGS);
    }
  }

  const hasEncoded = isNonEmptyString(body.contentEncoded);
  const hasMarkdown = typeof body.markdown === 'string';
  if (!hasEncoded && !hasMarkdown) {
    issues.push('one of contentEncoded or markdown is required');
  }
  if (hasMarkdown && (body.markdown as string).length > MAX_MARKDOWN_BYTES) {
    issues.push('markdown body is too large');
  }

  const cover = typeof body.cover === 'string' && body.cover.trim() ? body.cover.trim() : undefined;

  if (issues.length) throw new ValidationError(issues);

  return {
    slug,
    title,
    summary: summary || undefined,
    date,
    tags,
    draft: body.draft === true,
    cover,
    contentEncoded: hasEncoded ? (body.contentEncoded as string) : undefined,
    markdown: hasMarkdown ? (body.markdown as string) : undefined,
  };
}

/**
 * Images only: the formats the compressor can produce, plus GIF, which is
 * uploaded untouched because a canvas cannot re-encode an animation.
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/webp',
  'image/jpeg',
  'image/png',
  'image/avif',
  'image/gif',
] as const;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export function assertUploadable(contentType: string, size: number): void {
  const issues: string[] = [];
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
    issues.push(`unsupported content type ${contentType || '(none)'}`);
  }
  if (!Number.isFinite(size) || size <= 0) issues.push('empty upload');
  if (size > MAX_UPLOAD_BYTES) {
    issues.push(`upload exceeds ${Math.round(MAX_UPLOAD_BYTES / 1024)}KB after compression`);
  }
  if (issues.length) throw new ValidationError(issues);
}
