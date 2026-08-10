import { Body, Controller, Delete, Get, Inject, Param, Post, Put, UseGuards } from '@nestjs/common';
import type { EncodedPost, PostMeta } from '@sfaizh/shared';
import { AuthGuard } from '../auth/auth.guard';
import { PostsService } from './posts.service';

/**
 * Every route here requires a session token. Writes always land in Supabase;
 * the markdown files in the repository are never mutated by the running app.
 */
@Controller('admin/posts')
@UseGuards(AuthGuard)
export class AdminPostsController {
  constructor(@Inject(PostsService) private readonly posts: PostsService) {}

  @Get()
  list(): Promise<PostMeta[]> {
    return this.posts.listForAdmin();
  }

  @Get(':slug')
  find(@Param('slug') slug: string): Promise<EncodedPost> {
    return this.posts.findEncoded(slug);
  }

  @Post()
  create(@Body() body: unknown): Promise<PostMeta> {
    return this.posts.upsert(body);
  }

  @Put(':slug')
  update(@Param('slug') slug: string, @Body() body: unknown): Promise<PostMeta> {
    return this.posts.upsert(body, slug);
  }

  @Delete(':slug')
  remove(@Param('slug') slug: string): Promise<{ removed: boolean; revertedToFile: boolean }> {
    return this.posts.remove(slug);
  }
}
