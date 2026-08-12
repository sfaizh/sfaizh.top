import { getPost } from '@/lib/posts'
import { notFound } from 'next/navigation'
 
type PageProps = {
  params: {
    slug: string
  }
}
 
export default async function BlogPostPage({ params }: PageProps) {
  const post = await getPost(params.slug)

  if (!post) {
    notFound()
  }

  return (
    <article className="space-y-6">
      <h1 className="text-4xl font-semibold text-slate-900">{post.title}</h1>
      <p className="text-sm text-slate-500">
        {post.publishedAt} · {post.readingTime} · {post.author}
      </p>
      <div className="prose prose-slate max-w-none">
        <p>{post.content}</p>
      </div>
    </article>
  )
}
