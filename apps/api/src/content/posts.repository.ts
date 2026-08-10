import type { Post } from '@sfaizh/shared';

export const FILE_POSTS_REPOSITORY = 'FILE_POSTS_REPOSITORY';
export const DB_POSTS_REPOSITORY = 'DB_POSTS_REPOSITORY';

export interface ReadablePostsRepository {
  readonly kind: 'file' | 'supabase';
  list(): Promise<Post[]>;
  get(slug: string): Promise<Post | null>;
}

export interface WritablePostsRepository extends ReadablePostsRepository {
  upsert(post: Post): Promise<Post>;
  remove(slug: string): Promise<boolean>;
}
