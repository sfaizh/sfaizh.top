---
title: Building a terminal-shaped blog
date: 2026-05-18
summary: Why the reading surface of this site is a shell prompt, how the boot
  sequence earns its one-time cost, and what it takes to make a fake terminal
  feel like a real one.
tags: [design, frontend, terminal]
cover: /content/img/terminal-anatomy.svg
draft: false
---

Most engineering blogs are a list of cards. You scroll, you squint at the
metadata, you click, you read, you hit back. It works, and it is completely
forgettable. I wanted the front door of this site to be the thing I actually
spend my day inside: a prompt.

So the home page of `sfaizh.top` is a shell. You type `ls`, you get posts. You
type `open building-a-terminal-blog`, and the post opens in something that
behaves like `nvim` — `j`/`k` to move, `gg`/`G` to jump, `/` to search, `q` to
get back to the prompt. The whole thing is one page. There is no menu, no
toolbar, no hamburger.

![The anatomy of the terminal surface](/content/img/terminal-anatomy.svg)

## The three surfaces

There are exactly three pieces of chrome, and each one has a job.

The **header** is a split-flap display. It alternates between `sfaizh.top` and
`Engineering blog`, one character at a time, the way departure boards at an
airport do. It is the only ornament on the page and it exists to answer the
question "what is this?" for someone who has landed here without context.

The **terminal** is the middle. It owns the vertical space, it is centred, and
it holds a scrollback buffer of everything you have typed. Output is printed
the way a real shell prints it: immediately, monospaced, left-aligned, with a
powerline prompt that carries the current directory and a git-ish branch
segment.

The **statusline** is the bottom. In shell mode it is a tmux status bar —
session name, window list, clock. In reader mode it becomes a Neovim
statusline: mode indicator, filename, filetype, and a line-position percentage
that updates as you scroll. The keybindings for whatever mode you are in are
always visible there, the same way `man` tells you that `q` quits.

## The boot sequence is a promise

When you load the site for the first time, you get a fake boot: package lists,
a progress bar, a few `[ OK ]` lines. It takes about two and a half seconds.

That animation is doing real work. It sets the expectation that this is a
machine you operate rather than a document you scroll, and it covers the
moment where the post index is actually being fetched. But it is also the kind
of thing that becomes infuriating on the fourth visit, so it runs **once**, and
the fact that it ran is written to `localStorage`. Every subsequent load drops
you straight at the prompt, and every command after that is instant — the
index is in memory, the post bodies are fetched once and cached.

```ts
// The boot flag lives in localStorage, not sessionStorage: a new tab should
// not replay the animation, but clearing site data should bring it back.
const hasBooted = localStorage.getItem(STORAGE_KEYS.booted) === '1';
if (hasBooted || prefersReducedMotion) {
  skipToPrompt();
} else {
  await playBootSequence();
  localStorage.setItem(STORAGE_KEYS.booted, '1');
}
```

The `prefersReducedMotion` check is not optional. A vestibular disorder does
not care how charming your progress bar is.

## Making a fake terminal feel real

The gap between "a text input styled like a terminal" and "a terminal" is
almost entirely in the small behaviours. The ones that mattered most:

- **Autocomplete that suggests rather than corrects.** Typing `op` renders
  `open` as dim ghost text ahead of the cursor, with the completion menu
  underneath. `Tab` accepts, `→` accepts, `Esc` dismisses. This is
  `zsh-autocomplete` behaviour and it is the single feature that makes the
  prompt feel alive.
- **History that survives.** `↑`/`↓` walk the buffer, `Ctrl-R` searches it,
  and it persists across reloads.
- **Readline muscle memory.** `Ctrl-A`, `Ctrl-E`, `Ctrl-W`, `Ctrl-U`, `Ctrl-K`,
  `Ctrl-L`. If your fingers know them, they should work.
- **Errors that look like errors.** `zsh: command not found: sl` in red, exit
  code preserved and reflected in the prompt's status segment. A fake terminal
  that never fails is obviously fake.

## Where the words actually live

Every post on this site is a markdown file in the repository under
`content/posts`. That is the source of truth I can grep, diff and review.

The database is a cache and an editing surface, not the canon. When a post is
edited through the admin console it is written to Supabase — DEFLATE'd and
base64url'd, because storing a wall of markdown as plain text in a `text`
column is a waste of both bytes and dignity. The API decodes on read, the
admin editor decodes in the browser and holds the result in memory until you
press save.

Which means the answer to "what happens if Supabase goes down" is: the site
serves the markdown files off disk and nobody notices.

## Was it worth it?

The honest answer is that a terminal is a worse interface for reading than a
column of text, which is why opening a post exits the terminal metaphor
entirely and gives you a 75%-width column, a proper reading typeface, and
generous line height. The shell is the index, not the book.

But as an index — as the thing that says who I am before you have read a word
of my writing — it is the best two hundred lines of TypeScript on this domain.

Type `help` when you get back to the prompt. There is more in there than the
legend shows.
