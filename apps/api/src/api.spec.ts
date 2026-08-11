import request from 'supertest';
import type { Express } from 'express';
import { API_ROUTES, decodeMarkdown } from '@sfaizh/shared';
import { createExpressApp } from './index';
import { AuthService } from './auth/auth.service';

/**
 * End-to-end tests for the HTTP surface, driven through the same Express
 * instance the Next.js app mounts in production. Supabase is deliberately left
 * unconfigured so these also cover the filesystem fallback and the
 * "editing is unavailable" path.
 */

const SECRET = 'integration-secret';
const PASSWORD = 'integration-password';

let app: Express;
let token: string;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.AUTH_SECRET = SECRET;
  process.env.ADMIN_PASSWORD_HASH = AuthService.hashPassword(PASSWORD, SECRET);
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.BLOB_READ_WRITE_TOKEN;

  app = await createExpressApp();

  const login = await request(app).post(API_ROUTES.login).send({ password: PASSWORD });
  token = login.body.token;
});

describe('GET /health', () => {
  it('reports which storage backend is live', async () => {
    const response = await request(app).get(API_ROUTES.health).expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.storage).toBe('filesystem');
  });
});

describe('GET /posts', () => {
  it('lists the seeded posts newest first', async () => {
    const response = await request(app).get(API_ROUTES.posts).expect(200);

    expect(response.body.length).toBeGreaterThanOrEqual(2);
    const dates = response.body.map((post: { date: string }) => new Date(post.date).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('returns metadata without the body', async () => {
    const [post] = (await request(app).get(API_ROUTES.posts).expect(200)).body;
    expect(post).toMatchObject({ slug: expect.any(String), title: expect.any(String), readingMinutes: expect.any(Number) });
    expect(post.markdown).toBeUndefined();
  });

  it('filters by tag', async () => {
    const response = await request(app).get(`${API_ROUTES.posts}?tag=vim`).expect(200);
    const slugs = response.body.map((post: { slug: string }) => post.slug);

    // Assert the filter, not the corpus: counting posts here means every new
    // one tagged `vim` breaks a test that has nothing to do with it.
    expect(response.body.length).toBeGreaterThan(0);
    for (const post of response.body) expect(post.tags).toContain('vim');

    expect(slugs).toContain('vim-motions-as-a-design-language');
    expect(slugs).not.toContain('building-a-terminal-blog');
  });

  it('returns an empty list for an unknown tag', async () => {
    await request(app).get(`${API_ROUTES.posts}?tag=nonexistent`).expect(200).expect([]);
  });
});

describe('GET /posts/:slug', () => {
  it('404s an unknown slug', async () => {
    const response = await request(app).get(API_ROUTES.post('does-not-exist')).expect(404);
    expect(response.body).toMatchObject({ statusCode: 404, message: 'No such post: does-not-exist' });
  });

  it('400s a malformed slug', async () => {
    await request(app).get(API_ROUTES.post('Not A Slug')).expect(400);
  });

  it('serves the raw markdown file for `cat`', async () => {
    const response = await request(app).get(`${API_ROUTES.post('vim-motions-as-a-design-language')}/raw`).expect(200);
    expect(response.headers['content-type']).toContain('text/markdown');
    expect(response.text.startsWith('---')).toBe(true);
  });
});

describe('GET /posts/:slug/rendered', () => {
  it('returns sanitised HTML and a heading outline', async () => {
    const response = await request(app)
      .get(API_ROUTES.postRendered('vim-motions-as-a-design-language'))
      .expect(200);

    expect(response.body.html).toContain('<h2 id="verbs-nouns-and-counts">');
    expect(response.body.html).not.toContain('<script');
    expect(response.body.headings.length).toBeGreaterThan(0);
    expect(response.body.markdown).toBeUndefined();
  });
});

describe('GET /posts/search', () => {
  it('finds posts by body text', async () => {
    const response = await request(app).get(API_ROUTES.search('Neovim')).expect(200);
    const hit = response.body.find(
      (result: { post: { slug: string } }) => result.post.slug === 'blazingly-fast-workflows-with-alacritty-nvim'
    );

    expect(hit).toBeDefined();
    expect(hit.excerpt).toContain('Neovim');
  });

  it('rejects a query that is too short', async () => {
    await request(app).get(API_ROUTES.search('a')).expect(400);
  });

  it('returns an empty array when nothing matches', async () => {
    await request(app).get(API_ROUTES.search('zzzznotfound')).expect(200).expect([]);
  });
});

describe('GET /tags and /stats', () => {
  it('counts tags, most used first', async () => {
    const response = await request(app).get(API_ROUTES.tags).expect(200);
    expect(response.body[0].count).toBeGreaterThanOrEqual(response.body[response.body.length - 1].count);
  });

  it('summarises the site', async () => {
    const response = await request(app).get(API_ROUTES.stats).expect(200);
    expect(response.body).toMatchObject({
      posts: expect.any(Number),
      drafts: expect.any(Number),
      tags: expect.any(Number),
      words: expect.any(Number),
      storage: 'filesystem',
    });
  });
});

describe('auth', () => {
  it('rejects the wrong password', async () => {
    await request(app).post(API_ROUTES.login).send({ password: 'nope' }).expect(401);
  });

  it('accepts the right one and validates the session', async () => {
    await request(app).get(API_ROUTES.session).set('authorization', `Bearer ${token}`).expect(200);
  });

  it('refuses an unauthenticated session probe', async () => {
    await request(app).get(API_ROUTES.session).expect(401);
  });

  it('accepts the token via the x-admin-token header too', async () => {
    await request(app).get(API_ROUTES.session).set('x-admin-token', token).expect(200);
  });
});

describe('admin routes', () => {
  it('require a token', async () => {
    await request(app).get(API_ROUTES.adminPosts).expect(401);
    await request(app).put(API_ROUTES.adminPost('x')).send({}).expect(401);
    await request(app).delete(API_ROUTES.adminPost('x')).expect(401);
  });

  it('reject a forged token', async () => {
    await request(app).get(API_ROUTES.adminPosts).set('authorization', 'Bearer forged.token').expect(401);
  });

  it('list posts including drafts', async () => {
    const response = await request(app).get(API_ROUTES.adminPosts).set('authorization', `Bearer ${token}`).expect(200);
    expect(response.body.length).toBeGreaterThanOrEqual(2);
  });

  it('return the body compressed, and it inflates back to the original', async () => {
    const response = await request(app)
      .get(API_ROUTES.adminPost('vim-motions-as-a-design-language'))
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.contentEncoding).toBe('deflate-base64url');
    expect(response.body.contentEncoded.startsWith('mdz1.')).toBe(true);
    expect(response.body.contentEncoded.length).toBeLessThan(response.body.rawBytes);
    expect(decodeMarkdown(response.body.contentEncoded)).toContain('## Verbs, nouns and counts');
  });

  it('refuse to write when Supabase is not configured', async () => {
    const response = await request(app)
      .put(API_ROUTES.adminPost('a-new-post'))
      .set('authorization', `Bearer ${token}`)
      .send({ slug: 'a-new-post', title: 'A new post', markdown: '# hi' })
      .expect(503);

    expect(response.body.message).toContain('Supabase is not configured');
  });

  it('validate the payload before reaching storage', async () => {
    const response = await request(app)
      .put(API_ROUTES.adminPost('bad'))
      .set('authorization', `Bearer ${token}`)
      .send({ slug: 'Bad Slug', title: '' })
      .expect(400);

    expect(response.body.message).toContain('slug must be lowercase');
  });

  it('reject a payload whose slug disagrees with the URL', async () => {
    await request(app)
      .put(API_ROUTES.adminPost('one-slug'))
      .set('authorization', `Bearer ${token}`)
      .send({ slug: 'another-slug', title: 'T', markdown: 'x' })
      .expect(400);
  });
});

describe('media', () => {
  it('reports that uploads are disabled without a blob token', async () => {
    const response = await request(app)
      .get(API_ROUTES.adminUpload)
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.enabled).toBe(false);
  });

  it('refuses an upload when uploads are disabled', async () => {
    await request(app)
      .post(`${API_ROUTES.adminUpload}?filename=x`)
      .set('authorization', `Bearer ${token}`)
      .set('content-type', 'image/webp')
      .send(Buffer.from([0x52, 0x49, 0x46, 0x46]))
      .expect(503);
  });
});

describe('errors', () => {
  it('404s an unknown route in the API shape', async () => {
    const response = await request(app).get('/api/v1/nope').expect(404);
    expect(response.body).toMatchObject({ statusCode: 404 });
  });
});
