-- ─────────────────────────────────────────────────────────────────────────────
-- sfaizh.top — Supabase schema
--
-- Run this once in the Supabase SQL editor, then `npm run db:seed` to copy the
-- markdown in content/posts into the table.
--
-- Note that `content_encoded` holds DEFLATE'd, base64url'd markdown rather than
-- plain text — the API is the only thing that reads it, and it decodes on the
-- way out. Do not try to edit this column by hand.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.posts (
  slug              text primary key
                    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title             text        not null,
  summary           text        not null default '',
  date              timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  tags              text[]      not null default '{}',
  draft             boolean     not null default false,
  cover             text,
  content_encoded   text        not null,
  content_encoding  text        not null default 'deflate-base64url',
  words             integer     not null default 0,
  reading_minutes   integer     not null default 1
);

comment on column public.posts.content_encoded is
  'DEFLATE + base64url markdown, prefixed "mdz1.". Decoded by the API.';

-- Listing is always "newest first, published only".
create index if not exists posts_date_idx on public.posts (date desc);
create index if not exists posts_draft_idx on public.posts (draft) where draft = false;
create index if not exists posts_tags_idx on public.posts using gin (tags);

-- ── Row level security ───────────────────────────────────────────────────────
-- The API talks to Supabase with the service role key, which bypasses RLS. The
-- policies below exist so that leaking the *anon* key cannot expose drafts or
-- allow writes.

alter table public.posts enable row level security;

drop policy if exists "published posts are readable" on public.posts;
create policy "published posts are readable"
  on public.posts
  for select
  to anon, authenticated
  using (draft = false);

-- No insert/update/delete policy is defined on purpose: writes are only
-- possible with the service role key, which never leaves the server.

-- ── Keep updated_at honest ───────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
  before update on public.posts
  for each row
  execute function public.touch_updated_at();
