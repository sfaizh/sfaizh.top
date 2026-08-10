/**
 * Domain types shared between the Next.js client, the NestJS API and the
 * seeding tooling. Keeping them in one place means the terminal, the reader
 * and the admin editor all agree on the shape of a post.
 */

/** Wire format used for markdown stored in Supabase. */
export const CONTENT_ENCODING = 'deflate-base64url' as const;
export type ContentEncoding = typeof CONTENT_ENCODING;

/** Everything about a post except its body. Cheap to list. */
export interface PostMeta {
  slug: string;
  title: string;
  summary: string;
  /** ISO-8601 date the post was published. */
  date: string;
  /** ISO-8601 timestamp of the last edit, when known. */
  updatedAt?: string;
  tags: string[];
  /** Estimated reading time in minutes, derived from the body. */
  readingMinutes: number;
  /** Word count of the body, derived. */
  words: number;
  draft: boolean;
  /** Optional hero image path or URL. */
  cover?: string;
  /** Where this post came from — the repo's markdown files, or the database. */
  source: 'file' | 'db';
}

/** A post plus its raw markdown body. */
export interface Post extends PostMeta {
  markdown: string;
}

/** A post rendered for the reader: sanitised HTML plus a heading outline. */
export interface RenderedPost extends PostMeta {
  html: string;
  headings: PostHeading[];
}

export interface PostHeading {
  id: string;
  text: string;
  depth: number;
}

/** Admin-facing payload: the body travels compressed and is decoded client-side. */
export interface EncodedPost extends PostMeta {
  contentEncoded: string;
  contentEncoding: ContentEncoding;
  /** Byte length of the markdown before encoding — used for the editor statusline. */
  rawBytes: number;
}

/** Body accepted by POST/PUT /admin/posts. */
export interface PostUpsert {
  slug: string;
  title: string;
  summary?: string;
  date?: string;
  tags?: string[];
  draft?: boolean;
  cover?: string;
  /** Compressed markdown. Exactly one of `contentEncoded` / `markdown` is required. */
  contentEncoded?: string;
  markdown?: string;
}

export interface UploadedMedia {
  url: string;
  pathname: string;
  contentType: string;
  /** Size in bytes of the compressed upload that was actually stored. */
  size: number;
  /** Size in bytes of the file the user originally selected. */
  originalSize: number;
  width?: number;
  height?: number;
}

export interface SiteStats {
  posts: number;
  drafts: number;
  tags: number;
  words: number;
  /** Which backend is serving posts right now. */
  storage: 'supabase' | 'filesystem';
}

export interface AuthSession {
  token: string;
  /** Unix seconds. */
  expiresAt: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}
