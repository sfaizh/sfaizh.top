import {
  API_ROUTES,
  STORAGE_KEYS,
  type ApiError,
  type AuthSession,
  type EncodedPost,
  type Post,
  type PostMeta,
  type RenderedPost,
  type SiteStats,
  type UploadedMedia,
} from '@sfaizh/shared';

export interface SearchHit {
  post: PostMeta;
  excerpt: string;
  matches: number;
}

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function adminToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEYS.token);
  } catch {
    return null;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = adminToken();
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

  const response = await fetch(path, { ...init, headers });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as ApiError;
      if (payload?.message) message = payload.message;
    } catch {
      /* non-JSON error bodies are reported by status alone */
    }
    throw new ApiRequestError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  return (contentType.includes('application/json') ? response.json() : response.text()) as Promise<T>;
}

/**
 * A tiny memo layer. Every terminal command after the boot sequence is
 * supposed to feel instant, which means the post index and any post already
 * read must not be re-fetched.
 */
const cache = new Map<string, Promise<unknown>>();

function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as Promise<T> | undefined;
  if (hit) return hit;
  const promise = loader().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, promise);
  return promise;
}

export function invalidateCache(): void {
  cache.clear();
}

export const api = {
  listPosts: () => cached('posts', () => request<PostMeta[]>(API_ROUTES.posts)),

  post: (slug: string) => cached(`post:${slug}`, () => request<Post>(API_ROUTES.post(slug))),

  rendered: (slug: string) =>
    cached(`rendered:${slug}`, () => request<RenderedPost>(API_ROUTES.postRendered(slug))),

  raw: (slug: string) =>
    cached(`raw:${slug}`, () => request<string>(`${API_ROUTES.post(slug)}/raw`)),

  tags: () => cached('tags', () => request<{ tag: string; count: number }[]>(API_ROUTES.tags)),

  stats: () => cached('stats', () => request<SiteStats>(API_ROUTES.stats)),

  // Search is never cached: the query space is unbounded.
  search: (query: string) => request<SearchHit[]>(API_ROUTES.search(query)),

  login: (password: string) =>
    request<AuthSession>(API_ROUTES.login, { method: 'POST', body: JSON.stringify({ password }) }),

  session: () => request<{ ok: true }>(API_ROUTES.session),

  adminPosts: () => request<PostMeta[]>(API_ROUTES.adminPosts),

  adminPost: (slug: string) => request<EncodedPost>(API_ROUTES.adminPost(slug)),

  savePost: (slug: string, body: unknown) =>
    request<PostMeta>(API_ROUTES.adminPost(slug), { method: 'PUT', body: JSON.stringify(body) }),

  deletePost: (slug: string) =>
    request<{ removed: boolean; revertedToFile: boolean }>(API_ROUTES.adminPost(slug), {
      method: 'DELETE',
    }),

  uploadStatus: () => request<{ enabled: boolean }>(API_ROUTES.adminUpload),

  /** Raw-body upload; the blob has already been compressed in the browser. */
  uploadImage: (params: {
    blob: Blob;
    filename: string;
    originalSize: number;
    width: number;
    height: number;
  }) => {
    const query = new URLSearchParams({
      filename: params.filename,
      originalSize: String(params.originalSize),
      width: String(params.width),
      height: String(params.height),
    });
    return request<UploadedMedia>(`${API_ROUTES.adminUpload}?${query}`, {
      method: 'POST',
      body: params.blob,
      headers: { 'content-type': params.blob.type },
    });
  },
};
