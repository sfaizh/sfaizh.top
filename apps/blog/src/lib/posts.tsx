export type Post = {
  id: string
  title: string
  slug: string
  excerpt: string
  publishedAt: string
  author: string
  readingTime: string
  tags: string[]
  coverImage?: string
  content: string
}

const posts: Post[] = [
  {
    id: 'paper-001',
    title: 'Building a Minimal Paper Workflow',
    slug: 'minimal-paper-workflow',
    excerpt: 'A lightweight, distraction-free system for capturing ideas, research notes, and drafts.',
    publishedAt: '2026-07-24',
    author: 'Faizan',
    readingTime: '6 min read',
    tags: ['notes', 'productivity', 'workflow'],
    coverImage: '/images/papers/minimal-workflow.jpg',
    content:
      'A lightweight, distraction-free system for capturing ideas, research notes, and drafts. This post explains how to keep your note taking simple while still preserving enough structure to turn notes into finished work.',
  },
  {
    id: 'paper-002',
    title: 'Research Notes for Better Writing',
    slug: 'research-notes-better-writing',
    excerpt: 'How to structure research notes so they turn into stronger writing projects.',
    publishedAt: '2026-06-18',
    author: 'Faizan',
    readingTime: '5 min read',
    tags: ['research', 'writing', 'process'],
    coverImage: '/images/papers/research-notes.jpg',
    content:
      'Research should feed your writing, not overwhelm it. Learn the simple structure that makes notes easier to review, easier to turn into drafts, and easier to share with collaborators.',
  },
  {
    id: 'paper-003',
    title: 'Organizing Longform Ideas',
    slug: 'organizing-longform-ideas',
    excerpt: 'A practical guide to keeping longform thinking organized across drafts and experiments.',
    publishedAt: '2026-05-11',
    author: 'Faizan',
    readingTime: '7 min read',
    tags: ['longform', 'ideas', 'writing'],
    coverImage: '/images/papers/longform-ideas.jpg',
    content:
      'Longform thinking is messy by design. This guide helps you keep key ideas, experiments, and drafts aligned without losing the open-ended curiosity that makes longform work powerful.',
  },
]

export async function getPosts(): Promise<Post[]> {
  return posts
}

export async function getPost(slug: string): Promise<Post | undefined> {
  return posts.find((post) => post.slug === slug)
}
