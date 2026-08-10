/**
 * Converts the exported JSON posts in `content/posts/json` into the markdown
 * files the site actually reads.
 *
 *   npm run posts:from-json
 *
 * The JSON comes from an older MongoDB-backed blog, so the field names do not
 * line up with the frontmatter this site uses:
 *
 *   description → the markdown body      subtitle  → summary
 *   isPrivate   → draft                  images.main → cover
 *   tags        → a space-separated string, not a list
 *
 * Re-runnable: existing markdown is left alone unless `--force` is passed, so
 * an edit made after a conversion is never silently overwritten.
 */
import { readdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { deriveSummary, serializeFrontmatter, slugify } from '@sfaizh/shared';

interface JsonPost {
  title?: string;
  slug?: string;
  subtitle?: string;
  description?: string;
  date?: string;
  tags?: string;
  isPrivate?: boolean;
  createdAt?: string;
  images?: Record<string, string>;
}

const workspaceRoot = resolve(__dirname, '../..');
const jsonDir = join(workspaceRoot, 'content/posts/json');
const postsDir = join(workspaceRoot, 'content/posts');

/** The old editor filled unused image slots with placeholder services. */
function usableCover(images: Record<string, string> | undefined): string | undefined {
  const main = images?.main?.trim();
  if (!main || /via\.placeholder\.com|placehold\.(co|it)/i.test(main)) return undefined;
  return main;
}

/** Tags were one space-separated string; the site wants a lowercase list. */
function parseTags(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(/[\s,]+/).map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

/** `date` was a local-time input value and is sometimes blank. */
function resolveDate(post: JsonPost): string {
  for (const candidate of [post.date, post.createdAt]) {
    if (!candidate?.trim()) continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const filenames = (await readdir(jsonDir)).filter((name) => name.endsWith('.json')).sort();

  let written = 0;
  let skipped = 0;

  for (const filename of filenames) {
    const post = JSON.parse(await readFile(join(jsonDir, filename), 'utf8')) as JsonPost;

    const title = post.title?.trim() || filename.replace(/^post-|\.json$/g, '');
    // Two of the exports never got a slug; derive one from the title.
    const slug = post.slug?.trim() || slugify(title);
    const body = (post.description ?? '').replace(/\r\n/g, '\n').trim();

    const target = join(postsDir, `${slug}.md`);
    if (!force && (await exists(target))) {
      console.log(`  · ${slug}.md already exists, leaving it alone`);
      skipped++;
      continue;
    }

    const markdown = serializeFrontmatter(
      {
        title,
        date: resolveDate(post),
        summary: post.subtitle?.trim() || deriveSummary(body) || title,
        tags: parseTags(post.tags),
        cover: usableCover(post.images),
        // An unpublished post stays unpublished, and an empty one is not
        // something to put on the front page either.
        draft: post.isPrivate === true || body.length < 200,
      },
      body ? `${body}\n` : `_This post has not been written yet._\n`
    );

    await writeFile(target, markdown, 'utf8');
    console.log(`  ✓ ${slug}.md  (${body.length} chars${post.isPrivate ? ', draft' : ''})`);
    written++;
  }

  console.log(`\nConverted ${written} post(s), skipped ${skipped}.`);
  if (written) console.log('Run `npm run content:build` to refresh the bundle the API serves.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
