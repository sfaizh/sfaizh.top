'use client';

import { STORAGE_KEYS, decodeMarkdown, encodeMarkdown } from '@sfaizh/shared';
import { readJson, readLocal, removeLocal, writeJson, writeLocal } from './storage';

/**
 * Client-side draft persistence.
 *
 * Nothing is sent to the server until Save is pressed, so the only thing
 * standing between a half-written post and an accidental refresh is
 * `localStorage`. Drafts are stored under one key per slug and the document
 * body is compressed with the same codec the database uses — a long post
 * otherwise eats a meaningful slice of the 5MB origin quota.
 */

export interface DraftMetadata {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  date: string;
  draft: boolean;
  cover?: string;
}

export interface StoredDraft extends DraftMetadata {
  /** TipTap's HTML document. Held compressed on disk, plain in memory. */
  html: string;
  savedAt: number;
  /** Fingerprint of the server document this draft was branched from. */
  baseRevision: string;
}

interface DraftEnvelope extends DraftMetadata {
  htmlEncoded: string;
  savedAt: number;
  baseRevision: string;
  version: 1;
}

interface DraftIndexEntry {
  slug: string;
  savedAt: number;
  title: string;
}

/** Cheap content fingerprint — enough to notice the server moved underneath us. */
export function revisionOf(content: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < content.length; index++) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function saveDraft(draft: StoredDraft): boolean {
  const envelope: DraftEnvelope = {
    slug: draft.slug,
    title: draft.title,
    summary: draft.summary,
    tags: draft.tags,
    date: draft.date,
    draft: draft.draft,
    cover: draft.cover,
    htmlEncoded: encodeMarkdown(draft.html),
    savedAt: draft.savedAt,
    baseRevision: draft.baseRevision,
    version: 1,
  };

  const stored = writeLocal(STORAGE_KEYS.draft(draft.slug), JSON.stringify(envelope));
  if (stored) touchIndex({ slug: draft.slug, savedAt: draft.savedAt, title: draft.title });
  return stored;
}

export function loadDraft(slug: string): StoredDraft | null {
  const raw = readLocal(STORAGE_KEYS.draft(slug));
  if (!raw) return null;

  try {
    const envelope = JSON.parse(raw) as DraftEnvelope;
    if (envelope.version !== 1) return null;
    return {
      slug: envelope.slug,
      title: envelope.title,
      summary: envelope.summary,
      tags: envelope.tags ?? [],
      date: envelope.date,
      draft: envelope.draft,
      cover: envelope.cover,
      html: decodeMarkdown(envelope.htmlEncoded),
      savedAt: envelope.savedAt,
      baseRevision: envelope.baseRevision,
    };
  } catch {
    // A corrupt draft is worse than no draft; drop it rather than crash the editor.
    removeLocal(STORAGE_KEYS.draft(slug));
    return null;
  }
}

export function clearDraft(slug: string): void {
  removeLocal(STORAGE_KEYS.draft(slug));
  const index = listDrafts().filter((entry) => entry.slug !== slug);
  writeJson(STORAGE_KEYS.draftIndex, index);
}

export function listDrafts(): DraftIndexEntry[] {
  return readJson<DraftIndexEntry[]>(STORAGE_KEYS.draftIndex, []);
}

function touchIndex(entry: DraftIndexEntry): void {
  const index = listDrafts().filter((existing) => existing.slug !== entry.slug);
  index.unshift(entry);
  writeJson(STORAGE_KEYS.draftIndex, index.slice(0, 50));
}

export function describeAge(savedAt: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - savedAt) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
