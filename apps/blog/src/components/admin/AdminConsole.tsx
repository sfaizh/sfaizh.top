'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor as TipTapEditor } from '@tiptap/react';
import {
  STORAGE_KEYS,
  decodeMarkdown,
  encodeMarkdown,
  slugify,
  type PostMeta,
} from '@sfaizh/shared';
import { api, invalidateCache } from '../../lib/api-client';
import { clearDraft, describeAge, loadDraft, revisionOf, saveDraft } from '../../lib/autosave';
import { compressImage, formatBytes } from '../../lib/image-compress';
import { countEditorWords, editorHtmlToMarkdown, markdownToEditorHtml } from '../../lib/markdown-bridge';
import { removeLocal } from '../../lib/storage';
import { StatusLine } from '../StatusLine';
import { Editor } from './Editor';

/**
 * The editing surface.
 *
 * The contract the whole thing is built around: **nothing reaches the server
 * until Save is pressed.** A post is fetched compressed, inflated once in the
 * browser, and from then on lives in React state — with a debounced copy in
 * `localStorage` so a refresh, a crash or a closed tab cannot lose it. Clearing
 * site data is the only thing that can, and that is the intended escape hatch.
 */

const AUTOSAVE_DELAY_MS = 700;
const NEW_POST = '__new__';

interface Meta {
  slug: string;
  title: string;
  summary: string;
  tags: string;
  date: string;
  draft: boolean;
  cover: string;
}

const EMPTY_META: Meta = {
  slug: '',
  title: '',
  summary: '',
  tags: '',
  date: new Date().toISOString().slice(0, 10),
  draft: true,
  cover: '',
};

type Notice = { tone: 'ok' | 'warn' | 'error'; message: string } | null;

export function AdminConsole() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta>(EMPTY_META);
  const [html, setHtml] = useState('');
  const [baseRevision, setBaseRevision] = useState('');
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadsEnabled, setUploadsEnabled] = useState<boolean | null>(null);
  const [restorable, setRestorable] = useState<{ savedAt: number; stale: boolean } | null>(null);

  const editorRef = useRef<TipTapEditor | null>(null);
  const autosaveTimer = useRef<number | null>(null);

  // ── listing ───────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      setPosts(await api.adminPosts());
    } catch (cause) {
      setNotice({ tone: 'error', message: (cause as Error).message });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Ask once whether the blob store is configured, so the editor can say so
  // before you pick a file rather than after it has compressed one.
  useEffect(() => {
    api
      .uploadStatus()
      .then((status) => setUploadsEnabled(status.enabled))
      .catch(() => setUploadsEnabled(false));
  }, []);

  /**
   * Write the draft now rather than on the debounce.
   *
   * Switching buffers used to drop up to 700ms of typing on the floor — the
   * pending timer was simply replaced. Leaving a buffer flushes it first.
   */
  const flushDraft = useCallback(() => {
    if (!selected || !dirty) return;
    if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current);

    const at = Date.now();
    saveDraft({
      slug: selected,
      title: meta.title,
      summary: meta.summary,
      tags: splitTags(meta.tags),
      date: meta.date,
      draft: meta.draft,
      cover: meta.cover || undefined,
      html,
      savedAt: at,
      baseRevision,
    });
    setSavedAt(at);
  }, [baseRevision, dirty, html, meta, selected]);

  // ── loading a post ────────────────────────────────────────────────────────
  const openPost = useCallback(async (slug: string) => {
    // Never leave a buffer without persisting it first.
    flushDraft();
    setNotice(null);
    setRestorable(null);

    if (slug === NEW_POST) {
      setSelected(NEW_POST);
      setMeta(EMPTY_META);
      setHtml('');
      setBaseRevision(revisionOf(''));
      setDirty(false);
      const draft = loadDraft(NEW_POST);
      if (draft) setRestorable({ savedAt: draft.savedAt, stale: false });
      return;
    }

    try {
      const encoded = await api.adminPost(slug);
      // The body arrives compressed and is inflated exactly once, here.
      const markdown = decodeMarkdown(encoded.contentEncoded);
      const revision = revisionOf(markdown);

      setSelected(slug);
      setBaseRevision(revision);
      setMeta({
        slug: encoded.slug,
        title: encoded.title,
        summary: encoded.summary,
        tags: encoded.tags.join(', '),
        date: encoded.date.slice(0, 10),
        draft: encoded.draft,
        cover: encoded.cover ?? '',
      });
      setHtml(markdownToEditorHtml(markdown));
      setDirty(false);

      const draft = loadDraft(slug);
      if (!draft) return;

      if (draft.baseRevision !== revision) {
        // The server copy moved underneath the draft — that is a real conflict
        // and wants a decision, so it still asks.
        setRestorable({ savedAt: draft.savedAt, stale: true });
        return;
      }

      // Otherwise put the work straight back. Switching between posts should
      // not cost you anything you typed; only Discard should.
      setMeta({
        slug: draft.slug,
        title: draft.title,
        summary: draft.summary,
        tags: draft.tags.join(', '),
        date: draft.date,
        draft: draft.draft,
        cover: draft.cover ?? '',
      });
      setHtml(draft.html);
      setSavedAt(draft.savedAt);
      setDirty(true);
      setNotice({
        tone: 'warn',
        message: `Restored unsaved changes from ${describeAge(draft.savedAt)}. Discard to go back to the saved version.`,
      });
    } catch (cause) {
      setNotice({ tone: 'error', message: (cause as Error).message });
    }
  }, [flushDraft]);

  // ── autosave ──────────────────────────────────────────────────────────────
  const scheduleAutosave = useCallback(
    (nextHtml: string, nextMeta: Meta) => {
      if (!selected) return;
      if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current);

      autosaveTimer.current = window.setTimeout(() => {
        const at = Date.now();
        const stored = saveDraft({
          slug: selected,
          title: nextMeta.title,
          summary: nextMeta.summary,
          tags: splitTags(nextMeta.tags),
          date: nextMeta.date,
          draft: nextMeta.draft,
          cover: nextMeta.cover || undefined,
          html: nextHtml,
          savedAt: at,
          baseRevision,
        });
        if (stored) setSavedAt(at);
        else setNotice({ tone: 'warn', message: 'Local autosave failed — browser storage is full or blocked.' });
      }, AUTOSAVE_DELAY_MS);
    },
    [baseRevision, selected]
  );

  const onEditorChange = useCallback(
    (nextHtml: string) => {
      setHtml(nextHtml);
      setDirty(true);
      scheduleAutosave(nextHtml, meta);
    },
    [meta, scheduleAutosave]
  );

  const updateMeta = useCallback(
    (patch: Partial<Meta>) => {
      setMeta((current) => {
        const next = { ...current, ...patch };
        setDirty(true);
        scheduleAutosave(html, next);
        return next;
      });
    },
    [html, scheduleAutosave]
  );

  // Warn before losing an unsaved change to a real navigation.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const restoreDraft = useCallback(() => {
    if (!selected) return;
    const draft = loadDraft(selected);
    if (!draft) return;

    setMeta({
      slug: draft.slug === NEW_POST ? '' : draft.slug,
      title: draft.title,
      summary: draft.summary,
      tags: draft.tags.join(', '),
      date: draft.date,
      draft: draft.draft,
      cover: draft.cover ?? '',
    });
    setHtml(draft.html);
    setSavedAt(draft.savedAt);
    setDirty(true);
    setRestorable(null);
    setNotice({ tone: 'ok', message: 'Restored the local draft. Nothing has been sent to the server yet.' });
  }, [selected]);

  const discardDraft = useCallback(() => {
    if (!selected) return;
    clearDraft(selected);
    setRestorable(null);
  }, [selected]);

  /**
   * Throw the local draft away and go back to what is stored.
   *
   * This is the only thing that should ever cost you work — switching posts
   * now carries your changes with you, so there has to be a deliberate way
   * out of them.
   */
  const discardChanges = useCallback(async () => {
    if (!selected) return;
    if (dirty && !window.confirm('Discard your unsaved changes to this post?')) return;

    if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current);
    clearDraft(selected);
    setRestorable(null);
    setSavedAt(null);

    if (selected === NEW_POST) {
      setMeta(EMPTY_META);
      setHtml('');
      setDirty(false);
      setNotice({ tone: 'ok', message: 'Cleared.' });
      return;
    }

    const slug = selected;
    setSelected(null);
    setDirty(false);
    await openPost(slug);
    setNotice({ tone: 'ok', message: 'Reverted to the saved version.' });
  }, [dirty, openPost, selected]);

  // ── saving ────────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (!selected || saving) return;

    const slug = meta.slug.trim() || slugify(meta.title);
    if (!slug) {
      setNotice({ tone: 'error', message: 'A slug is required (it is derived from the title if left blank).' });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const markdown = editorHtmlToMarkdown(html);
      const payload = {
        slug,
        title: meta.title.trim() || slug,
        summary: meta.summary.trim(),
        date: meta.date ? new Date(meta.date).toISOString() : undefined,
        tags: splitTags(meta.tags),
        draft: meta.draft,
        cover: meta.cover.trim() || undefined,
        // Compressed on the way out, exactly as it will be stored.
        contentEncoded: encodeMarkdown(markdown),
      };

      const saved = await api.savePost(slug, payload);
      clearDraft(selected);
      if (selected === NEW_POST) clearDraft(NEW_POST);

      invalidateCache();
      setSelected(saved.slug);
      setMeta((current) => ({ ...current, slug: saved.slug }));
      setBaseRevision(revisionOf(markdown));
      setDirty(false);
      setSavedAt(null);
      setNotice({ tone: 'ok', message: `Saved ${saved.slug} — ${saved.words} words, ${saved.readingMinutes} min read.` });
      await refresh();
    } catch (cause) {
      setNotice({ tone: 'error', message: (cause as Error).message });
    } finally {
      setSaving(false);
    }
  }, [html, meta, refresh, saving, selected]);

  // Ctrl-S / Cmd-S, because that is what hands do.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [save]);

  const remove = useCallback(async () => {
    if (!selected || selected === NEW_POST) return;
    if (!window.confirm(`Delete ${selected} from the database?`)) return;

    try {
      const result = await api.deletePost(selected);
      clearDraft(selected);
      invalidateCache();
      setNotice({
        tone: 'ok',
        message: result.revertedToFile
          ? `${selected} reverted to the markdown file in the repository.`
          : `${selected} deleted.`,
      });
      setSelected(null);
      await refresh();
    } catch (cause) {
      setNotice({ tone: 'error', message: (cause as Error).message });
    }
  }, [refresh, selected]);

  // ── images ────────────────────────────────────────────────────────────────
  const uploadFiles = useCallback(async (files: File[]) => {
    if (uploadsEnabled === false) {
      setNotice({
        tone: 'warn',
        message:
          'Image uploads are off because BLOB_READ_WRITE_TOKEN is not set. Attach a Blob store in Vercel (or set the token locally) and redeploy — everything else still works.',
      });
      return;
    }

    for (const file of files) {
      setUploading(file.name);
      try {
        const compressed = await compressImage(file);
        const uploaded = await api.uploadImage({
          blob: compressed.blob,
          filename: compressed.filename,
          originalSize: compressed.originalSize,
          width: compressed.width,
          height: compressed.height,
        });

        editorRef.current
          ?.chain()
          .focus()
          .setImage({ src: uploaded.url, alt: compressed.filename })
          .run();

        setNotice({
          tone: 'ok',
          message: compressed.passthrough
            ? `${file.name}: ${formatBytes(uploaded.size)}, uploaded as-is to keep the animation`
            : `${file.name}: ${formatBytes(compressed.originalSize)} → ${formatBytes(uploaded.size)} (−${Math.round(compressed.saved * 100)}%)`,
        });
      } catch (cause) {
        setNotice({ tone: 'error', message: `${file.name}: ${(cause as Error).message}` });
      } finally {
        setUploading(null);
      }
    }
  }, [uploadsEnabled]);

  /** Compress and upload one file, returning its URL — used by Replace. */
  const uploadOne = useCallback(
    async (file: File): Promise<string | null> => {
      if (uploadsEnabled === false) {
        setNotice({ tone: 'warn', message: 'Image uploads are off — BLOB_READ_WRITE_TOKEN is not set.' });
        return null;
      }
      setUploading(file.name);
      try {
        const compressed = await compressImage(file);
        const uploaded = await api.uploadImage({
          blob: compressed.blob,
          filename: compressed.filename,
          originalSize: compressed.originalSize,
          width: compressed.width,
          height: compressed.height,
        });
        setNotice({
          tone: 'ok',
          message: `${file.name}: ${formatBytes(compressed.originalSize)} → ${formatBytes(uploaded.size)}`,
        });
        return uploaded.url;
      } catch (cause) {
        setNotice({ tone: 'error', message: `${file.name}: ${(cause as Error).message}` });
        return null;
      } finally {
        setUploading(null);
      }
    },
    [uploadsEnabled]
  );

  /**
   * Bin an image that is no longer referenced.
   *
   * Best effort on purpose: the post has already been edited, and failing to
   * tidy up storage should not look like the edit failed.
   */
  const forgetImage = useCallback((src: string) => {
    if (!/blob\.vercel-storage\.com\//.test(src)) return;
    api
      .deleteImage(src)
      .then(() => setNotice({ tone: 'ok', message: 'Image removed from storage.' }))
      .catch((cause: Error) =>
        setNotice({ tone: 'warn', message: `Removed from the post, but storage said: ${cause.message}` })
      );
  }, []);

  const signOut = useCallback(() => {
    removeLocal(STORAGE_KEYS.token);
    window.location.href = '/';
  }, []);

  const words = useMemo(() => countEditorWords(html), [html]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--ctp-surface0)] bg-[color:var(--ctp-mantle)] px-4 py-2.5">
        <div className="font-mono text-[color:var(--ctp-mauve)]">
          sfaizh.top <span className="text-[color:var(--ctp-overlay0)]">/ admin</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[13px]">
          <a href="/" className="text-[color:var(--ctp-overlay1)] underline">
            terminal
          </a>
          <button type="button" onClick={signOut} className="text-[color:var(--ctp-red)] underline">
            sign out
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <PostSidebar
          posts={posts}
          selected={selected}
          onSelect={openPost}
          onNew={() => openPost(NEW_POST)}
        />

        <main className="scroll-themed min-h-0 flex-1 overflow-y-auto">
          {!selected ? (
            <EmptyState onNew={() => openPost(NEW_POST)} />
          ) : (
            <div className="mx-auto max-w-4xl px-4 py-5">
              {notice && <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} />}

              {restorable && (
                <RestoreBanner
                  savedAt={restorable.savedAt}
                  stale={restorable.stale}
                  onRestore={restoreDraft}
                  onDiscard={discardDraft}
                />
              )}

              <MetaFields meta={meta} onChange={updateMeta} isNew={selected === NEW_POST} />

              <div className="mt-4 overflow-hidden rounded-lg border border-[color:var(--ctp-surface1)] bg-[color:var(--ctp-base)]">
                <Editor
                  initialHtml={html}
                  onChange={onEditorChange}
                  onUploadFiles={uploadFiles}
                  uploadsEnabled={uploadsEnabled}
                  onReplaceImage={uploadOne}
                  onRemoveImage={forgetImage}
                  onReady={(instance) => {
                    editorRef.current = instance;
                  }}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="rounded bg-[color:var(--ctp-green)] px-4 py-2 font-mono font-bold text-[color:var(--ctp-crust)] disabled:opacity-50"
                >
                  {saving ? 'saving…' : 'Save  ⌘S'}
                </button>

                <button
                  type="button"
                  onClick={discardChanges}
                  disabled={!dirty && savedAt === null}
                  className="rounded border border-[color:var(--ctp-surface2)] px-4 py-2 font-mono text-[color:var(--ctp-subtext1)] disabled:opacity-40"
                >
                  Discard changes
                </button>

                {selected !== NEW_POST && (
                  <button
                    type="button"
                    onClick={remove}
                    className="rounded border border-[color:var(--ctp-red)] px-4 py-2 font-mono text-[color:var(--ctp-red)]"
                  >
                    Delete
                  </button>
                )}

                <span className="font-mono text-[12.5px] text-[color:var(--ctp-overlay1)]">
                  {uploading
                    ? `uploading ${uploading}…`
                    : uploadsEnabled === false
                      ? 'image uploads disabled — BLOB_READ_WRITE_TOKEN is not set'
                      : 'paste or drop an image to upload it'}
                </span>
              </div>
            </div>
          )}
        </main>
      </div>

      <StatusLine
        mode={{ label: dirty ? 'MODIFIED' : 'SAVED', tone: dirty ? 'peach' : 'green' }}
        left={[
          { label: selected === NEW_POST ? '[new post].md' : selected ? `${selected}.md` : 'no buffer' },
          { label: `${words} words`, muted: true },
        ]}
        right={[
          { label: savedAt ? `autosaved ${describeAge(savedAt)}` : 'no local draft', muted: true },
        ]}
      >
        <span className="truncate">
          {dirty
            ? 'unsaved changes are held in this browser only — press Save to publish'
            : 'in sync with the database'}
        </span>
      </StatusLine>
    </div>
  );
}

// ── pieces ───────────────────────────────────────────────────────────────────

function splitTags(value: string): string[] {
  return [...new Set(value.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

function PostSidebar({
  posts,
  selected,
  onSelect,
  onNew,
}: {
  posts: PostMeta[];
  selected: string | null;
  onSelect: (slug: string) => void;
  onNew: () => void;
}) {
  return (
    <aside className="scroll-themed shrink-0 overflow-y-auto border-b border-[color:var(--ctp-surface0)] bg-[color:var(--ctp-mantle)] p-3 md:w-72 md:border-b-0 md:border-r">
      <button
        type="button"
        onClick={onNew}
        className="mb-3 w-full rounded bg-[color:var(--ctp-mauve)] px-3 py-2 font-mono text-[13px] font-bold text-[color:var(--ctp-crust)]"
      >
        + new post
      </button>

      <ul className="space-y-1">
        {posts.map((post) => (
          <li key={post.slug}>
            <button
              type="button"
              onClick={() => onSelect(post.slug)}
              aria-current={selected === post.slug}
              className="w-full rounded px-2 py-1.5 text-left font-mono text-[12.5px]"
              style={{
                background: selected === post.slug ? 'var(--ctp-surface1)' : 'transparent',
                color: selected === post.slug ? 'var(--ctp-text)' : 'var(--ctp-subtext0)',
              }}
            >
              <span className="block truncate">{post.title}</span>
              <span className="block truncate text-[11px] text-[color:var(--ctp-overlay0)]">
                {post.slug}
                {post.draft ? ' · draft' : ''}
                {post.source === 'file' ? ' · file' : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-4 font-mono text-[11px] leading-relaxed text-[color:var(--ctp-overlay0)]">
        Posts marked <span className="text-[color:var(--ctp-teal)]">file</span> live in
        <code> content/posts</code>. Saving one creates a database copy that shadows it; deleting
        that copy reverts to the file.
      </p>
    </aside>
  );
}

function MetaFields({
  meta,
  onChange,
  isNew,
}: {
  meta: Meta;
  onChange: (patch: Partial<Meta>) => void;
  isNew: boolean;
}) {
  const field =
    'w-full rounded border border-[color:var(--ctp-surface1)] bg-[color:var(--ctp-base)] px-3 py-2 font-mono text-[13.5px] text-[color:var(--ctp-text)] outline-none focus:border-[color:var(--ctp-lavender)]';
  const label = 'mb-1 block font-mono text-[11.5px] uppercase tracking-wider text-[color:var(--ctp-overlay1)]';

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <label className={label} htmlFor="post-title">
          title
        </label>
        <input
          id="post-title"
          className={field}
          value={meta.title}
          onChange={(event) => {
            const title = event.target.value;
            // A new post's slug tracks the title until it is edited by hand.
            onChange(isNew && (!meta.slug || meta.slug === slugify(meta.title)) ? { title, slug: slugify(title) } : { title });
          }}
        />
      </div>

      <div>
        <label className={label} htmlFor="post-slug">
          slug
        </label>
        <input
          id="post-slug"
          className={field}
          value={meta.slug}
          onChange={(event) => onChange({ slug: slugify(event.target.value) })}
        />
      </div>

      <div>
        <label className={label} htmlFor="post-date">
          date
        </label>
        <input
          id="post-date"
          type="date"
          className={field}
          value={meta.date}
          onChange={(event) => onChange({ date: event.target.value })}
        />
      </div>

      <div className="md:col-span-2">
        <label className={label} htmlFor="post-summary">
          summary
        </label>
        <textarea
          id="post-summary"
          rows={2}
          className={field}
          value={meta.summary}
          onChange={(event) => onChange({ summary: event.target.value })}
        />
      </div>

      <div>
        <label className={label} htmlFor="post-tags">
          tags (comma separated)
        </label>
        <input
          id="post-tags"
          className={field}
          value={meta.tags}
          onChange={(event) => onChange({ tags: event.target.value })}
        />
      </div>

      <div>
        <label className={label} htmlFor="post-cover">
          cover image URL
        </label>
        <input
          id="post-cover"
          className={field}
          value={meta.cover}
          onChange={(event) => onChange({ cover: event.target.value })}
        />
      </div>

      <label className="flex items-center gap-2 font-mono text-[13px] text-[color:var(--ctp-subtext1)]">
        <input
          type="checkbox"
          checked={meta.draft}
          onChange={(event) => onChange({ draft: event.target.checked })}
        />
        draft (hidden from the terminal until unchecked)
      </label>
    </div>
  );
}

function NoticeBanner({ notice, onDismiss }: { notice: NonNullable<Notice>; onDismiss: () => void }) {
  const colour =
    notice.tone === 'error' ? 'var(--ctp-red)' : notice.tone === 'warn' ? 'var(--ctp-yellow)' : 'var(--ctp-green)';

  return (
    <div
      role="status"
      className="mb-4 flex items-start justify-between gap-3 rounded border px-3 py-2 font-mono text-[13px]"
      style={{ borderColor: colour, color: colour }}
    >
      <span>{notice.message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

function RestoreBanner({
  savedAt,
  stale,
  onRestore,
  onDiscard,
}: {
  savedAt: number;
  stale: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="mb-4 rounded border border-[color:var(--ctp-yellow)] px-3 py-2 font-mono text-[13px] text-[color:var(--ctp-yellow)]">
      <p>
        There is an unsaved local draft from {describeAge(savedAt)}.
        {stale && ' The server copy has changed since it was written.'}
      </p>
      <div className="mt-2 flex gap-3">
        <button type="button" onClick={onRestore} className="underline">
          restore it
        </button>
        <button type="button" onClick={onDiscard} className="text-[color:var(--ctp-overlay1)] underline">
          discard
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center font-mono text-[color:var(--ctp-overlay1)]">
      <div>
        <p>Select a post on the left, or</p>
        <button type="button" onClick={onNew} className="mt-2 text-[color:var(--ctp-mauve)] underline">
          start a new one
        </button>
      </div>
    </div>
  );
}
