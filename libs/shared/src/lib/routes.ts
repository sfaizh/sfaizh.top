/** Single source of truth for API paths, shared by the client and the server. */
export const API_PREFIX = '/api/v1';

export const API_ROUTES = {
  health: `${API_PREFIX}/health`,
  stats: `${API_PREFIX}/stats`,
  posts: `${API_PREFIX}/posts`,
  post: (slug: string) => `${API_PREFIX}/posts/${encodeURIComponent(slug)}`,
  postRendered: (slug: string) => `${API_PREFIX}/posts/${encodeURIComponent(slug)}/rendered`,
  search: (query: string) => `${API_PREFIX}/posts/search?q=${encodeURIComponent(query)}`,
  tags: `${API_PREFIX}/tags`,
  login: `${API_PREFIX}/auth/login`,
  session: `${API_PREFIX}/auth/session`,
  adminPosts: `${API_PREFIX}/admin/posts`,
  adminPost: (slug: string) => `${API_PREFIX}/admin/posts/${encodeURIComponent(slug)}`,
  adminUpload: `${API_PREFIX}/admin/media`,
} as const;

/** localStorage / sessionStorage keys, kept together so they never collide. */
export const STORAGE_KEYS = {
  booted: 'sfaizh:boot:v1',
  flavour: 'sfaizh:flavour:v1',
  motion: 'sfaizh:motion:v1',
  history: 'sfaizh:history:v1',
  token: 'sfaizh:admin-token:v1',
  draft: (slug: string) => `sfaizh:draft:v1:${slug}`,
  draftIndex: 'sfaizh:draft-index:v1',
} as const;
