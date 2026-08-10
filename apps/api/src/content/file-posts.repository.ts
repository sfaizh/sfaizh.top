import { Injectable } from '@nestjs/common';
import { postFromMarkdown, type Post } from '@sfaizh/shared';
import { RAW_POSTS } from './generated-content';
import type { ReadablePostsRepository } from './posts.repository';

/**
 * Read-only repository backed by the markdown checked into `content/posts`.
 *
 * In production the posts arrive via the generated bundle, because a
 * serverless function cannot be relied upon to see the repository's files. In
 * development the files are re-read on every request so that editing a post in
 * `$EDITOR` shows up on refresh without regenerating the bundle.
 */
@Injectable()
export class FilePostsRepository implements ReadablePostsRepository {
  readonly kind = 'file' as const;

  async list(): Promise<Post[]> {
    const sources = await this.sources();
    return sources.map(({ slug, source }) => postFromMarkdown(slug, source, { source: 'file' }));
  }

  async get(slug: string): Promise<Post | null> {
    const sources = await this.sources();
    const hit = sources.find((entry) => entry.slug === slug);
    return hit ? postFromMarkdown(hit.slug, hit.source, { source: 'file' }) : null;
  }

  private async sources(): Promise<{ slug: string; source: string }[]> {
    if (process.env.NODE_ENV === 'production') return RAW_POSTS;
    return (await readFromDisk()) ?? RAW_POSTS;
  }
}

/**
 * Best-effort filesystem read for the dev server. Returns `null` — rather than
 * throwing — whenever the working tree is not visible, so the bundle can take
 * over silently.
 */
async function readFromDisk(): Promise<{ slug: string; source: string }[] | null> {
  try {
    const { readdir, readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const dir = await locateContentDir();
    if (!dir) return null;

    const filenames = (await readdir(dir)).filter((name) => /\.mdx?$/i.test(name)).sort();
    return Promise.all(
      filenames.map(async (filename) => ({
        slug: filename.replace(/\.mdx?$/i, ''),
        source: await readFile(join(dir, filename), 'utf8'),
      }))
    );
  } catch {
    return null;
  }
}

/** Walk up from the cwd looking for `content/posts` — Nx runs from varying roots. */
async function locateContentDir(): Promise<string | null> {
  const { access } = await import('node:fs/promises');
  const { join, dirname } = await import('node:path');

  let current = process.cwd();
  for (let depth = 0; depth < 5; depth++) {
    const candidate = join(current, 'content', 'posts');
    try {
      await access(candidate);
      return candidate;
    } catch {
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return null;
}
