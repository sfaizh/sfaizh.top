import { STORAGE_KEYS } from '@sfaizh/shared';
import { clearDraft, describeAge, listDrafts, loadDraft, revisionOf, saveDraft } from './autosave';

const DRAFT = {
  slug: 'a-post',
  title: 'A post',
  summary: 'A summary',
  tags: ['design'],
  date: '2026-01-01',
  draft: true,
  cover: undefined,
  html: '<p>Body <strong>text</strong></p>',
  savedAt: 1_700_000_000_000,
  baseRevision: 'deadbeef',
};

describe('revisionOf', () => {
  it('is stable for the same content', () => {
    expect(revisionOf('hello')).toBe(revisionOf('hello'));
  });

  it('differs for different content', () => {
    expect(revisionOf('hello')).not.toBe(revisionOf('hellp'));
  });

  it('is always eight hex characters', () => {
    expect(revisionOf('')).toMatch(/^[0-9a-f]{8}$/);
    expect(revisionOf('x'.repeat(10_000))).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('draft persistence', () => {
  it('round-trips a draft through localStorage', () => {
    expect(saveDraft(DRAFT)).toBe(true);
    expect(loadDraft('a-post')).toEqual(DRAFT);
  });

  it('stores the body compressed rather than as plain HTML', () => {
    saveDraft({ ...DRAFT, html: '<p>a distinctive sentence</p>' });
    const raw = window.localStorage.getItem(STORAGE_KEYS.draft('a-post')) ?? '';

    expect(raw).not.toContain('distinctive');
    expect(raw).toContain('mdz1.');
  });

  it('returns null when there is no draft', () => {
    expect(loadDraft('never-written')).toBeNull();
  });

  it('discards a corrupt draft instead of throwing', () => {
    window.localStorage.setItem(STORAGE_KEYS.draft('broken'), 'not json');
    expect(loadDraft('broken')).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEYS.draft('broken'))).toBeNull();
  });

  it('keeps an index of drafts, most recent first', () => {
    saveDraft(DRAFT);
    saveDraft({ ...DRAFT, slug: 'another', savedAt: DRAFT.savedAt + 1000 });

    expect(listDrafts().map((entry) => entry.slug)).toEqual(['another', 'a-post']);
  });

  it('does not duplicate an entry when the same draft is saved twice', () => {
    saveDraft(DRAFT);
    saveDraft({ ...DRAFT, savedAt: DRAFT.savedAt + 1 });
    expect(listDrafts().filter((entry) => entry.slug === 'a-post')).toHaveLength(1);
  });

  it('clears a draft and removes it from the index', () => {
    saveDraft(DRAFT);
    clearDraft('a-post');

    expect(loadDraft('a-post')).toBeNull();
    expect(listDrafts()).toEqual([]);
  });

  it('survives a storage failure without throwing', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    expect(saveDraft(DRAFT)).toBe(false);
    setItem.mockRestore();
  });
});

describe('describeAge', () => {
  const now = 1_700_000_000_000;

  it('describes recent saves in human terms', () => {
    expect(describeAge(now, now)).toBe('just now');
    expect(describeAge(now - 30_000, now)).toBe('30s ago');
    expect(describeAge(now - 5 * 60_000, now)).toBe('5m ago');
    expect(describeAge(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(describeAge(now - 50 * 3_600_000, now)).toBe('2d ago');
  });

  it('never reports a negative age', () => {
    expect(describeAge(now + 10_000, now)).toBe('just now');
  });
});
