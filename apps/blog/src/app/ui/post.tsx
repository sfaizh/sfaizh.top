import Link from 'next/link'
import type { Post } from '@/lib/posts'
 
type PostCardProps = {
  post: Post
}
 
export default function PostCard({ post }: PostCardProps) {
  return (
    <article className="rounded-3xl border border-slate-200 p-6 transition hover:border-slate-300">
      <Link href={`/paper/${post.slug}`} className="block space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-slate-500">
            {post.publishedAt} · {post.readingTime}
          </p>
          <h2 className="text-2xl font-semibold text-slate-900">{post.title}</h2>
        </div>
        <p className="text-base leading-7 text-slate-700">{post.excerpt}</p>
        <p className="text-sm text-slate-500">By {post.author}</p>
      </Link>
    </article>
  )
}
