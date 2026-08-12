import { getPosts } from '@/lib/posts'
import PostCard from '@/app/ui/post'

export default async function PaperPage() {
  const posts = await getPosts()

  return (
    <main className="space-y-8">
      <header>
        <h1 className="text-4xl font-semibold">Paper</h1>
        <p className="max-w-2xl text-slate-600">
          A collection of draft articles and research notes.
        </p>
      </header>
      <ul className="space-y-6">
        {posts.map((post) => (
          <li key={post.id}>
            <PostCard post={post} />
          </li>
        ))}
      </ul>
    </main>
  )
}
