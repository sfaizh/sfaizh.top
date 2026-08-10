import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  byDateDescending,
  countWords,
  decodeMarkdown,
  deriveSummary,
  encodeMarkdown,
  isValidSlug,
  markdownFromPost,
  parsePostUpsert,
  readingMinutes,
  renderMarkdown,
  toMeta,
  utf8Bytes,
  ValidationError,
  type EncodedPost,
  type Post,
  type PostMeta,
  type PostUpsert,
  type RenderedPost,
  type SiteStats,
  CONTENT_ENCODING,
} from '@sfaizh/shared';
import { FilePostsRepository } from './file-posts.repository';
import { DB_POSTS_REPOSITORY } from './posts.repository';
import { SupabasePostsRepository } from './supabase-posts.repository';

export interface ListOptions {
  tag?: string;
  includeDrafts?: boolean;
  limit?: number;
}

export interface SearchHit {
  post: PostMeta;
  /** A short excerpt with the match in context. */
  excerpt: string;
  matches: number;
}

/** Lists are cached briefly so a burst of terminal commands hits memory. */
const CACHE_TTL_MS = 30_000;

@Injectable()
export class PostsService {
  private cache: { at: number; posts: Post[] } | null = null;

  constructor(
    @Inject(FilePostsRepository) private readonly files: FilePostsRepository,
    @Inject(DB_POSTS_REPOSITORY) private readonly db: SupabasePostsRepository | null
  ) {}

  get storage(): SiteStats['storage'] {
    return this.db ? 'supabase' : 'filesystem';
  }

  invalidate(): void {
    this.cache = null;
  }

  /**
   * The merged view: markdown files are the baseline, database rows shadow
   * them by slug. Deleting a database row therefore reverts a post to whatever
   * is checked into the repository rather than destroying it.
   */
  private async all(): Promise<Post[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return this.cache.posts;

    const [fromFiles, fromDb] = await Promise.all([
      this.files.list(),
      this.db ? this.db.list() : Promise.resolve([] as Post[]),
    ]);

    const merged = new Map<string, Post>();
    for (const post of fromFiles) merged.set(post.slug, post);
    for (const post of fromDb) merged.set(post.slug, post);

    const posts = [...merged.values()].sort(byDateDescending);
    this.cache = { at: Date.now(), posts };
    return posts;
  }

  async list(options: ListOptions = {}): Promise<PostMeta[]> {
    const posts = await this.all();
    let visible = options.includeDrafts ? posts : posts.filter((post) => !post.draft);
    if (options.tag) {
      const tag = options.tag.toLowerCase();
      visible = visible.filter((post) => post.tags.includes(tag));
    }
    if (options.limit && options.limit > 0) visible = visible.slice(0, options.limit);
    return visible.map(toMeta);
  }

  async find(slug: string, options: { includeDrafts?: boolean } = {}): Promise<Post> {
    if (!isValidSlug(slug)) throw new BadRequestException(`Invalid slug: ${slug}`);
    const post = (await this.all()).find((candidate) => candidate.slug === slug);
    if (!post || (post.draft && !options.includeDrafts)) {
      throw new NotFoundException(`No such post: ${slug}`);
    }
    return post;
  }

  async render(slug: string, options: { includeDrafts?: boolean } = {}): Promise<RenderedPost> {
    const post = await this.find(slug, options);
    const { html, headings } = renderMarkdown(post.markdown);
    const { markdown: _markdown, ...meta } = post;
    return { ...meta, html, headings };
  }

  /** The markdown file a post would serialise to — what `cat` prints. */
  async raw(slug: string, options: { includeDrafts?: boolean } = {}): Promise<string> {
    return markdownFromPost(await this.find(slug, options));
  }

  async tags(): Promise<{ tag: string; count: number }[]> {
    const posts = await this.all();
    const counts = new Map<string, number>();
    for (const post of posts) {
      if (post.draft) continue;
      for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  /** Case-insensitive substring search over title, summary, tags and body. */
  async search(query: string, options: { includeDrafts?: boolean } = {}): Promise<SearchHit[]> {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) throw new BadRequestException('Search needs at least 2 characters');

    const posts = await this.all();
    const hits: SearchHit[] = [];

    for (const post of posts) {
      if (post.draft && !options.includeDrafts) continue;
      const haystack = `${post.title}\n${post.summary}\n${post.tags.join(' ')}\n${post.markdown}`.toLowerCase();
      const matches = haystack.split(needle).length - 1;
      if (matches === 0) continue;
      hits.push({ post: toMeta(post), excerpt: excerptAround(post.markdown, needle), matches });
    }

    return hits.sort((a, b) => b.matches - a.matches);
  }

  async stats(): Promise<SiteStats> {
    const posts = await this.all();
    const published = posts.filter((post) => !post.draft);
    const tags = new Set(published.flatMap((post) => post.tags));
    return {
      posts: published.length,
      drafts: posts.length - published.length,
      tags: tags.size,
      words: published.reduce((total, post) => total + post.words, 0),
      storage: this.storage,
    };
  }

  // ── admin ─────────────────────────────────────────────────────────────────

  private requireDb(): SupabasePostsRepository {
    if (!this.db) {
      throw new ServiceUnavailableException(
        'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable editing.'
      );
    }
    return this.db;
  }

  /** Admin listing includes drafts and reports where each post is stored. */
  async listForAdmin(): Promise<PostMeta[]> {
    return this.list({ includeDrafts: true });
  }

  /**
   * The editor's load path. The body stays compressed all the way to the
   * browser, which inflates it once and keeps the markdown in memory until
   * save — nothing is written back until the user asks for it.
   */
  async findEncoded(slug: string): Promise<EncodedPost> {
    const post = await this.find(slug, { includeDrafts: true });
    const { markdown, ...meta } = post;
    return {
      ...meta,
      contentEncoded: encodeMarkdown(markdown),
      contentEncoding: CONTENT_ENCODING,
      rawBytes: utf8Bytes(markdown),
    };
  }

  async upsert(input: unknown, slugFromRoute?: string): Promise<PostMeta> {
    let payload: PostUpsert;
    try {
      payload = parsePostUpsert(input);
    } catch (error) {
      if (error instanceof ValidationError) throw new BadRequestException(error.issues);
      throw error;
    }
    if (slugFromRoute && slugFromRoute !== payload.slug) {
      throw new BadRequestException('Slug in the URL does not match the payload');
    }

    const db = this.requireDb();
    const markdown = decodeUpsertBody(payload);
    const existing = (await this.all()).find((post) => post.slug === payload.slug);

    const post: Post = {
      slug: payload.slug,
      title: payload.title,
      summary: payload.summary?.trim() || deriveSummary(markdown),
      date: payload.date ?? existing?.date ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: payload.tags ?? [],
      readingMinutes: readingMinutes(markdown),
      words: countWords(markdown),
      draft: payload.draft ?? false,
      cover: payload.cover,
      source: 'db',
      markdown,
    };

    const saved = await db.upsert(post);
    this.invalidate();
    return toMeta(saved);
  }

  /** Removes the database row. File-backed posts revert to their file version. */
  async remove(slug: string): Promise<{ removed: boolean; revertedToFile: boolean }> {
    if (!isValidSlug(slug)) throw new BadRequestException(`Invalid slug: ${slug}`);
    const removed = await this.requireDb().remove(slug);
    this.invalidate();
    const revertedToFile = (await this.files.get(slug)) !== null;
    return { removed, revertedToFile };
  }
}

/** The editor sends compressed markdown; the seed script sends plain text. */
function decodeUpsertBody(payload: PostUpsert): string {
  if (payload.contentEncoded) {
    try {
      return decodeMarkdown(payload.contentEncoded);
    } catch {
      throw new BadRequestException('contentEncoded could not be inflated');
    }
  }
  return payload.markdown ?? '';
}

function excerptAround(markdown: string, needle: string, radius = 90): string {
  const index = markdown.toLowerCase().indexOf(needle);
  if (index === -1) return markdown.slice(0, radius * 2).trim();

  const start = Math.max(0, index - radius);
  const end = Math.min(markdown.length, index + needle.length + radius);
  const slice = markdown.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${slice}${end < markdown.length ? '…' : ''}`;
}
