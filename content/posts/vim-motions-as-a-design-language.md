---
title: Vim motions as a design language
date: 2026-06-27
summary: Modal editing is a UI pattern, not an editor feature. What happens
  when you take verbs, nouns and counts seriously and apply them to a document
  reader on the web — including the parts that do not survive contact with a
  touchscreen.
tags: [vim, design, accessibility, frontend]
cover: /content/img/vim-motions.svg
draft: false
---

The pitch for Vim is usually made in terms of speed, which is the least
interesting thing about it. What Vim actually gives you is a *grammar*. `d2w`
is not a keyboard shortcut, it is a sentence: delete, two, words. Once the
grammar exists, you can compose motions you have never used before and be
right on the first try.

That is a user interface idea, and almost nothing on the web uses it.

![A map of the motions this reader implements](/content/img/vim-motions.svg)

## Verbs, nouns and counts

A modal interface has three parts:

1. A **mode** that changes what keys mean.
2. **Motions** — nouns that describe a region or a destination.
3. **Operators** — verbs that act on a motion.

A document reader does not need operators; you are not editing anything. What
it needs is the motion half of the grammar, plus a clear, always-visible
indication of which mode you are in. That is the deal Vim makes with you: it
will overload every key on the keyboard, and in exchange it will always tell
you what they currently mean.

So this site's reader implements motions only:

| Key | Motion |
| --- | --- |
| `j` / `k` | down / up one line |
| `Ctrl-D` / `Ctrl-U` | half a screen |
| `Ctrl-F` / `Ctrl-B` | a full screen |
| `gg` / `G` | top / bottom of the document |
| `{` / `}` | previous / next paragraph |
| `]]` / `[[` | next / previous heading |
| `/` then `n` / `N` | search, next match, previous match |
| `q` / `Esc` | back to the shell |

Counts work where they make sense: `10j` moves ten lines, `3}` skips three
paragraphs. The count buffer is shown in the statusline as you type it, which
is the affordance Vim itself only added decades in.

## The `gg` problem

`gg` is a two-key sequence, and the moment you have one of those you have
built a state machine with a timeout, which means you have built a bug.

The naive implementation stores the pending prefix and clears it on the next
keypress. The failure mode: press `g`, get distracted, come back a minute
later, press `g` again to start something else, and get teleported to the top
of the document. Real Vim has exactly this behaviour and real Vim users have
made peace with it, but a stranger on a blog has not.

The fix is a one-second timeout on the pending prefix, and rendering the
pending state in the statusline while it is live:

```ts
function pushKey(key: string) {
  if (pending && Date.now() - pending.at > PREFIX_TIMEOUT_MS) pending = null;

  if (pending?.key === 'g' && key === 'g') {
    scrollToTop();
    pending = null;
    return;
  }
  pending = OPERATOR_PREFIXES.has(key) ? { key, at: Date.now() } : null;
}
```

Small thing. It is the difference between "this is a nice touch" and "this
website hijacked my keyboard".

## Where the grammar breaks

Two places, and both of them are about people, not code.

**Touchscreens have no keyboard.** There is no `j` on a phone. Pretending
otherwise produces a site that is unusable for more than half the people who
will ever load it. So the mobile experience is not a degraded desktop
experience — it is a different, complete one: a row of tappable commands above
the prompt for the things you would otherwise type, native momentum scrolling
in the reader, and a floating position indicator instead of a statusline
percentage. The grammar is a power-user affordance layered *on top of*
something that already works, never a prerequisite.

**Screen readers have their own grammar.** A keyboard handler that swallows
`h` is fighting the reader's own heading-navigation key. The reader's content
is a plain semantic document — real `<article>`, real `<h2>`, real landmarks —
and the motion layer is attached to a focusable container that can be escaped
with a single `Esc`. Assistive tech users get the document; keyboard users get
the document plus the grammar. Nobody gets a trap.

## The part I keep coming back to

Modal interfaces are unfashionable because the first ten minutes are hostile,
and most software is judged entirely on its first ten minutes. That is a real
cost and I do not want to hand-wave it.

But the alternative — an interface with no modes, where every action needs its
own visible control — has a cost too, and it is paid forever instead of once.
It is why the toolbar on every application you have ever used grows until
somebody hides it behind a search box.

A blog is a small enough thing that I can pay the ten minutes myself and see
what it feels like. It feels good. Press `?` in the reader for the full map.
