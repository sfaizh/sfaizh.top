/**
 * Copies the markdown in `content/posts` into Supabase, compressed.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:seed
 *
 * The site does not need this to work — without Supabase it serves the same
 * files read-only. Seeding is what makes those posts editable in the admin
 * console. Existing rows are updated in place, so it is safe to re-run.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  CONTENT_ENCODING,
  compressionRatio,
  countWords,
  encodeMarkdown,
  postFromMarkdown,
  readingMinutes,
} from '@sfaizh/shared';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const table = process.env.SUPABASE_POSTS_TABLE ?? 'posts';

async function main(): Promise<void> {
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    process.exitCode = 1;
    return;
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  const directory = resolve(process.cwd(), 'content/posts');
  const filenames = (await readdir(directory)).filter((name) => /\.mdx?$/i.test(name)).sort();

  if (!filenames.length) {
    console.log('No markdown files found — nothing to seed.');
    return;
  }

  for (const filename of filenames) {
    const slug = filename.replace(/\.mdx?$/i, '');
    const source = await readFile(join(directory, filename), 'utf8');
    const post = postFromMarkdown(slug, source);
    const encoded = encodeMarkdown(post.markdown);

    const { error } = await client.from(table).upsert(
      {
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        date: post.date,
        updated_at: new Date().toISOString(),
        tags: post.tags,
        draft: post.draft,
        cover: post.cover ?? null,
        content_encoded: encoded,
        content_encoding: CONTENT_ENCODING,
        words: countWords(post.markdown),
        reading_minutes: readingMinutes(post.markdown),
      },
      { onConflict: 'slug' }
    );

    if (error) {
      console.error(`  ✗ ${slug}: ${error.message}`);
      process.exitCode = 1;
      continue;
    }

    const saved = Math.round(compressionRatio(post.markdown, encoded) * 100);
    console.log(`  ✓ ${slug} — ${post.words} words, stored ${saved}% smaller`);
  }

  console.log(`\nSeeded ${filenames.length} post(s) into "${table}".`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
