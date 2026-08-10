import { InternalServerErrorException } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  CONTENT_ENCODING,
  countWords,
  decodeMarkdown,
  ensureEncoded,
  readingMinutes,
  type Post,
} from '@sfaizh/shared';
import type { SupabaseConfig } from '../config/config';
import type { WritablePostsRepository } from './posts.repository';

/** Column layout of `public.posts`; see `supabase/schema.sql`. */
interface PostRow {
  slug: string;
  title: string;
  summary: string;
  date: string;
  updated_at: string;
  tags: string[] | null;
  draft: boolean;
  cover: string | null;
  content_encoded: string;
  content_encoding: string;
  words: number;
  reading_minutes: number;
}

const SELECT_COLUMNS =
  'slug,title,summary,date,updated_at,tags,draft,cover,content_encoded,content_encoding,words,reading_minutes';

/**
 * Posts live in Supabase with their markdown DEFLATE'd and base64url'd. The
 * repository is the only place that knows about the encoding: everything above
 * it sees plain markdown, and the admin routes ask for the encoded form
 * explicitly.
 */
export class SupabasePostsRepository implements WritablePostsRepository {
  readonly kind = 'supabase' as const;
  private readonly client: SupabaseClient;

  constructor(private readonly config: SupabaseConfig) {
    this.client = createClient(config.url, config.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async list(): Promise<Post[]> {
    const { data, error } = await this.client
      .from(this.config.table)
      .select(SELECT_COLUMNS)
      .order('date', { ascending: false });

    if (error) throw new InternalServerErrorException(`Supabase list failed: ${error.message}`);
    return (data ?? []).map((row) => this.toPost(row as PostRow));
  }

  async get(slug: string): Promise<Post | null> {
    const { data, error } = await this.client
      .from(this.config.table)
      .select(SELECT_COLUMNS)
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(`Supabase read failed: ${error.message}`);
    return data ? this.toPost(data as PostRow) : null;
  }

  async upsert(post: Post): Promise<Post> {
    const contentEncoded = ensureEncoded(post.markdown);
    const row: PostRow = {
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      date: post.date,
      updated_at: new Date().toISOString(),
      tags: post.tags,
      draft: post.draft,
      cover: post.cover ?? null,
      content_encoded: contentEncoded,
      content_encoding: CONTENT_ENCODING,
      words: countWords(post.markdown),
      reading_minutes: readingMinutes(post.markdown),
    };

    const { data, error } = await this.client
      .from(this.config.table)
      .upsert(row, { onConflict: 'slug' })
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw new InternalServerErrorException(`Supabase write failed: ${error.message}`);
    return this.toPost(data as PostRow);
  }

  async remove(slug: string): Promise<boolean> {
    const { data, error } = await this.client
      .from(this.config.table)
      .delete()
      .eq('slug', slug)
      .select('slug');

    if (error) throw new InternalServerErrorException(`Supabase delete failed: ${error.message}`);
    return (data ?? []).length > 0;
  }

  /** The encoded body, untouched — the admin editor inflates it client-side. */
  async getEncoded(slug: string): Promise<{ post: Post; contentEncoded: string } | null> {
    const { data, error } = await this.client
      .from(this.config.table)
      .select(SELECT_COLUMNS)
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(`Supabase read failed: ${error.message}`);
    if (!data) return null;

    const row = data as PostRow;
    return { post: this.toPost(row), contentEncoded: row.content_encoded };
  }

  private toPost(row: PostRow): Post {
    const markdown = decodeMarkdown(row.content_encoded ?? '');
    return {
      slug: row.slug,
      title: row.title,
      summary: row.summary ?? '',
      date: new Date(row.date).toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      tags: row.tags ?? [],
      readingMinutes: row.reading_minutes || readingMinutes(markdown),
      words: row.words || countWords(markdown),
      draft: Boolean(row.draft),
      cover: row.cover ?? undefined,
      source: 'db',
      markdown,
    };
  }
}
