# sfaizh.top

An engineering blog with a terminal for a front door.

The home page is a shell. You type `ls`, you get posts. You type
`open building-a-terminal-blog`, and the post opens in a pager that behaves like
Neovim — `j`/`k` to move, `gg`/`G` to jump, `/` to search, `q` to come back.
There is no menu and no toolbar. Everything is one page.

Posts are markdown files in this repository. Supabase is an editing surface on
top of them, not the source of truth.

```
┌─────────────────────────────────────────────┐
│                s f a i z h . t o p          │  split-flap header
├─────────────────────────────────────────────┤
│  ~/blog  ⎇ main  ❯ posts                    │
│  DATE         SLUG                    READ  │  the terminal
│  18 May 2026  building-a-terminal-blog  6m  │
│  ~/blog  ⎇ main  ❯ ▉                        │
├─────────────────────────────────────────────┤
│ SHELL │ 0:sfsh* │ help · posts · open  23:41│  tmux/nvim statusline
└─────────────────────────────────────────────┘
```

---

## Quick start

```bash
npm ci
npm run dev          # http://localhost:3000
```

That is the whole setup. With no environment variables the site runs completely:
posts are served from `content/posts`, and the admin console accepts the
development password `catppuccin`. Configuration adds capabilities rather than
enabling the basics — see [Environment](#environment).

```bash
npm run dev:api      # the NestJS API alone, on :3333
npm test             # every unit test
npm run e2e          # Playwright, against a production build
npm run verify       # content bundle + typecheck + tests + build
```

---

## The admin console

**The command is `sudo -i`.** Type it at the prompt on the home page and the
admin console opens. `sudo su -` and `sudo -s` work too. The page lives at
`/admin`; nothing on the public site links to it and it is excluded from
indexing.

The console gives you:

- A WYSIWYG editor (TipTap). It holds HTML; markdown is generated on save.
- **Image upload with compression.** Paste, drop or pick an image and the
  browser re-encodes it to WebP at a maximum edge of 1600px before anything is
  uploaded. A 6MB screenshot becomes ~120KB. Raw files never reach the network.
  Uploads land in Vercel Blob under `blog/<year>/<month>/`.
- **Local autosave.** Every keystroke is debounced into `localStorage`,
  compressed with the same codec the database uses. A refresh, a crash or a
  closed tab cannot lose a draft; clearing site data can, and that is the
  intended escape hatch. **Nothing is sent to the server until you press Save**
  (or `⌘S` / `Ctrl-S`).
- Draft/published toggle, tags, summary, cover image and slug.

Set a real password before deploying:

```bash
AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))") \
  npm run admin:hash -- 'your password'
```

That prints the `AUTH_SECRET` and `ADMIN_PASSWORD_HASH` pair to put in the
environment. Sessions are HMAC-signed tokens, not JWTs — there is one user and
no third party consuming them.

---

## Using the site

### Shell commands

| Command | What it does |
| --- | --- |
| `help [command]` | Every command, or an explanation of one |
| `posts [--tag <tag>]` | The archive, as a table |
| `open <slug>` | Read a post. Aliases: `vim`, `nvim`, `less`, `man`, `read` |
| `ls [-a] [-l]`, `cd`, `pwd`, `cat <file>` | The virtual filesystem |
| `search <query>` | Full-text search. Aliases: `grep`, `rg` |
| `tags` | Tags and how often they appear |
| `whoami`, `about`, `neofetch` | Who and what this is |
| `theme [mocha\|macchiato\|frappe\|latte]` | Catppuccin flavour, remembered |
| `clear`, `history`, `date`, `banner`, `reboot` | Housekeeping |
| `sudo -i` | The admin console |

Readline keys work: `Tab` accepts the inline suggestion, `↑`/`↓` walk history,
`Ctrl-R` searches it, `Ctrl-A`/`Ctrl-E`/`Ctrl-W`/`Ctrl-U`/`Ctrl-K`/`Ctrl-L`
behave as they should. Completion is `zsh-autocomplete` shaped: a dim ghost
suggestion ahead of the cursor, and a menu on the second `Tab`.

### Reader motions

| Key | Motion |
| --- | --- |
| `j` / `k` | One line |
| `Ctrl-D` / `Ctrl-U` | Half a screen |
| `Ctrl-F` / `Ctrl-B` | A full screen |
| `gg` / `G` | Top / bottom |
| `{` / `}` | Previous / next paragraph |
| `[[` / `]]` | Previous / next heading |
| `/`, then `n` / `N` | Search, next match, previous match |
| `?` | The full key map |
| `q` / `Esc` | Back to the shell |

Counts work: `10j`, `3}`. A pending count or prefix is shown in the statusline
as you type it, and a stale `g` prefix expires after a second rather than
teleporting you somewhere a minute later.

### On a phone

Touch devices get a different, complete UI rather than a degraded one: a
scrollable row of tappable commands above the prompt, native momentum scrolling
in the reader, and jump buttons (top / previous heading / next heading / end /
close) instead of motions.

### Accessibility

`prefers-reduced-motion` skips the boot sequence and stops every animation. The
reader renders a real semantic document — `<article>`, real headings, real
landmarks — with the motion layer attached to a focusable container that `Esc`
always escapes. There is a skip link to the terminal, and the split-flap header
has a stable accessible name that does not flicker.

---

## Architecture

```
apps/
  blog/            Next.js 16 — the terminal, the reader, the admin console
    src/app/       App Router pages (/, /admin)
    src/pages/api/v1/[...path].ts   ← the NestJS app, mounted
    src/components/                 terminal · reader · admin · statusline
    src/lib/shell/                  the shell: commands, engine, VFS, output
    src/lib/reader/                 vim motions, search highlighting
  api/             NestJS 11 — posts, auth, media
  blog-e2e/        Playwright
libs/
  shared/          codec · markdown · frontmatter · sanitiser · highlighter
content/posts/     the posts, as markdown
tools/scripts/     content bundler, password hasher, Supabase seeder
supabase/          schema.sql
```

### One deployment, two frameworks

The NestJS application is not a separate service. `apps/blog/src/pages/api/v1/[...path].ts`
is a Pages Router API route that hands the request straight to the Express
instance Nest is bound to:

```ts
export const config = { api: { bodyParser: false, externalResolver: true } };

export default async function handler(req, res) {
  const server = await getExpressApp();
  server(req, res);
}
```

The Pages Router is used deliberately — its handlers receive real Node
`IncomingMessage`/`ServerResponse` objects, which is exactly what Express wants.
Body parsing is disabled so Nest's own parsers, including the raw parser the
image upload depends on, see an untouched stream. The Nest instance is memoised
across warm invocations.

`npm run dev:api` still runs the same app standalone on port 3333 when you want
to work on the backend alone.

Because the API is compiled by SWC in that context, nothing in it relies on
`emitDecoratorMetadata`: every constructor dependency is declared with an
explicit `@Inject(...)`, and request payloads are validated by hand-written
functions in `libs/shared/src/lib/validate.ts` rather than by `class-validator`.

That choice is what lets the deploy build skip type checking (see below)
without breaking dependency injection: Nest never has to read decorator
metadata, so SWC never has to emit any.

### Where posts live

Markdown files in `content/posts` are the source of truth — greppable,
diffable, reviewable. Database rows shadow them by slug:

```
content/posts/*.md  ──┐
                      ├──►  merged by slug (DB wins)  ──►  the site
Supabase posts table ─┘
```

Editing a file-backed post through the admin console creates a database row that
shadows it. Deleting that row reverts the post to the file. If Supabase is
unreachable or unconfigured, the site serves the files and nothing else changes.

A serverless function cannot rely on seeing the repository's working tree, so
`tools/scripts/generate-content.mjs` compiles the markdown into
`apps/api/src/content/generated-content.ts`. It runs automatically before `dev`
and `build`, is committed, and CI fails if the commit is stale. In development
the files are re-read from disk on every request, so editing a post in `$EDITOR`
shows up on refresh.

### Compression

Markdown is never stored as plain text. `libs/shared/src/lib/codec.ts` DEFLATEs
it and base64url-encodes the result behind an `mdz1.` magic prefix:

```
markdown ──DEFLATE──► base64url ──► "mdz1.7VZtb9s4Ev6..."
```

`pako` is used rather than node's `zlib` so the identical code path runs in the
browser and on the server. That matters, because the admin editor fetches the
**compressed** body, inflates it once in memory, and keeps it there until you
save. Typical posts store 60–70% smaller; repetitive ones over 90%.

The same codec compresses local autosave drafts, which is what keeps a long post
from eating a meaningful slice of the origin's storage quota.

### Rendering

Markdown → HTML happens on the server. Headings get stable ids (and feed the
reader's `]]` motion), fenced code is highlighted by a ~150-line tokeniser
written for this site, and everything is passed through an allow-list sanitiser
before it reaches the client. No syntax-highlighting library is shipped to the
browser, and no webfont is downloaded — powerline separators are CSS `clip-path`
cuts, so they render identically whether or not you have a Nerd Font installed.
If you do have one, it is picked up first.

### Theming

All four Catppuccin flavours are emitted as CSS custom properties keyed on
`data-flavour`, generated from the palette in `libs/shared/src/lib/theme.ts`.
Switching flavour is one attribute write — no re-render, no flash. An inline
script applies the stored choice before first paint.

---

## Environment

Everything is optional; each variable switches on one more capability. See
[`.env.example`](.env.example) for the annotated list.

| Variable | Without it |
| --- | --- |
| `AUTH_SECRET`, `ADMIN_PASSWORD_HASH` | Admin uses the dev password locally, and is disabled in production |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Posts are served read-only from the markdown files |
| `BLOB_READ_WRITE_TOKEN` | Image upload is disabled, with a clear message |

---

## Deploying to Vercel

1. Import the repository. Vercel reads [`vercel.json`](vercel.json); the root
   directory stays at the repository root.
2. Add the environment variables above.
3. Attach a Blob store to the project — `BLOB_READ_WRITE_TOKEN` appears
   automatically.
4. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor,
   then seed the existing posts:

   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:seed
   ```

The build command is `npm run build`, which regenerates the content bundle and
then builds the Next app. Both halves of the site deploy as one project.

### Two things that exist because of how Vercel builds

Vercel runs the build **from inside `apps/blog`**, not from the repository
root, and it does not reliably install root `devDependencies`. Two consequences
are baked into the configuration, and both will look odd until you know why:

- **`apps/blog/package.json` declares its own build toolchain** — `tailwindcss`,
  `postcss`, `autoprefixer` and `typescript` sit in its `dependencies`, not in
  the root's `devDependencies`. They are genuinely what this app needs in order
  to build, and putting them here means the build works whether the install is
  workspace-scoped or root-wide, pruned or not. npm workspaces hoists a single
  copy, so nothing is duplicated on disk.
- **`next build` does not type-check.** `typescript.ignoreBuildErrors` is on in
  `next.config.js`. CI runs `npm run typecheck` over both projects on every push
  and pull request; doing it a second time inside the deploy would drag every
  dev-only `@types` package (`express`, `pako`, `turndown`, `jest`) into the
  production dependency graph to satisfy a duplicate check. The trade is real:
  a type error pushed straight to `main` can deploy before CI goes red. Watch
  the CI badge, or set `ignoreBuildErrors: false` and promote those `@types`
  packages if you would rather the deploy be the gate.

`next.config.js` is also deliberately free of `@nx/next`'s `withNx` wrapper,
for the same reason: it made the config file require a devDependency at build
time. Nx still infers its targets from the file's presence.

---

## Writing

Add a markdown file to `content/posts/`:

```markdown
---
title: The title
date: 2026-08-01
summary: One or two sentences. Indented continuation lines are folded in.
tags: [design, frontend]
cover: /content/img/something.svg
draft: false
---

The body.
```

Then `npm run content:build` (or just `npm run dev`, which does it for you).
Images go in `apps/blog/public/content/img/` and are referenced as
`/content/img/…`. Or write it in the admin console and let it handle all of
that.

---

## Testing

| Command | Covers |
| --- | --- |
| `npm run test:shared` | Codec round-trips, frontmatter, sanitiser, highlighter, markdown rendering |
| `npm run test:api` | Every HTTP route through the real Express instance, auth, validation |
| `npm run test:blog` | Shell engine, commands, VFS, vim motions, autosave, terminal component |
| `npm run e2e` | The whole site in a browser, desktop and mobile profiles |

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs typecheck,
lint and all three unit suites on every push and pull request, then builds for
production and runs Playwright against that build. It also fails if the
committed content bundle has drifted from the markdown files.

---

## Licence

MIT.
