import { parseFrontmatter, serializeFrontmatter } from './frontmatter';
import { deriveSummary } from './markdown';
import { countWords, readingMinutes } from './reading';
import { slugify } from './slug';
import type { Post, PostMeta } from './types';

/**
 * The bridge between "a markdown file on disk" and "a `Post`". Both the
 * filesystem repository and the Supabase repository funnel through here so
 * that a post has identical shape regardless of where it was stored.
 */
export function postFromMarkdown(
  slug: string,
  source: string,
  options: { source?: PostMeta['source']; updatedAt?: string } = {}
): Post {
  const { data, body } = parseFrontmatter(source);

  const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : slug;
  const summary =
    typeof data.summary === 'string' && data.summary.trim() ? data.summary.trim() : deriveSummary(body);

  const rawDate = data.date;
  const parsedDate = rawDate ? new Date(String(rawDate)) : null;
  const date =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? parsedDate.toISOString()
      : new Date(0).toISOString();

  const tags = Array.isArray(data.tags)
    ? data.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean)
    : [];

  return {
    slug,
    title,
    summary,
    date,
    updatedAt: options.updatedAt ?? (typeof data.updatedAt === 'string' ? data.updatedAt : undefined),
    tags,
    readingMinutes: readingMinutes(body),
    words: countWords(body),
    draft: data.draft === true,
    cover: typeof data.cover === 'string' && data.cover.trim() ? data.cover.trim() : undefined,
    source: options.source ?? 'file',
    markdown: body,
  };
}

/** The inverse: a `Post` rendered back into a reviewable markdown file. */
export function markdownFromPost(post: Post): string {
  return serializeFrontmatter(
    {
      title: post.title,
      date: post.date.slice(0, 10),
      summary: post.summary,
      tags: post.tags,
      cover: post.cover,
      draft: post.draft,
      updatedAt: post.updatedAt,
    },
    post.markdown
  );
}

export function toMeta(post: Post): PostMeta {
  const { markdown: _markdown, ...meta } = post;
  return meta;
}

/** Newest first, with drafts kept in place so admin listings stay stable. */
export function byDateDescending(a: PostMeta, b: PostMeta): number {
  const delta = new Date(b.date).getTime() - new Date(a.date).getTime();
  return delta !== 0 ? delta : a.slug.localeCompare(b.slug);
}

export function slugFromFilename(filename: string): string {
  return slugify(filename.replace(/\.mdx?$/i, ''));
}
