import { Controller, Get, Header, Inject, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { PostMeta, RenderedPost, SiteStats } from '@sfaizh/shared';
import { OptionalAuth } from '../auth/auth.guard';
import { PostsService, type SearchHit } from './posts.service';

/**
 * Public read surface. Drafts are hidden unless the caller happens to present
 * a valid admin token, which lets the editor preview a draft in the real
 * reader instead of a separate preview mode.
 */
@Controller()
export class PostsController {
  constructor(
    @Inject(PostsService) private readonly posts: PostsService,
    @Inject(OptionalAuth) private readonly optionalAuth: OptionalAuth
  ) {}

  @Get('health')
  health(): { status: 'ok'; storage: SiteStats['storage']; time: string } {
    return { status: 'ok', storage: this.posts.storage, time: new Date().toISOString() };
  }

  @Get('stats')
  stats(): Promise<SiteStats> {
    return this.posts.stats();
  }

  @Get('tags')
  tags(): Promise<{ tag: string; count: number }[]> {
    return this.posts.tags();
  }

  @Get('posts')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300')
  list(
    @Req() request: Request,
    @Query('tag') tag?: string,
    @Query('limit') limit?: string
  ): Promise<PostMeta[]> {
    return this.posts.list({
      tag: tag?.trim() || undefined,
      includeDrafts: this.optionalAuth.isAuthenticated(request),
      limit: limit ? Number(limit) : undefined,
    });
  }

  // Declared before `posts/:slug` so that "search" is not read as a slug.
  @Get('posts/search')
  search(@Req() request: Request, @Query('q') query = ''): Promise<SearchHit[]> {
    return this.posts.search(query, { includeDrafts: this.optionalAuth.isAuthenticated(request) });
  }

  @Get('posts/:slug')
  find(@Req() request: Request, @Param('slug') slug: string) {
    return this.posts.find(slug, { includeDrafts: this.optionalAuth.isAuthenticated(request) });
  }

  /** The exact markdown file, for `cat`. */
  @Get('posts/:slug/raw')
  @Header('Content-Type', 'text/markdown; charset=utf-8')
  raw(@Req() request: Request, @Param('slug') slug: string): Promise<string> {
    return this.posts.raw(slug, { includeDrafts: this.optionalAuth.isAuthenticated(request) });
  }

  @Get('posts/:slug/rendered')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300')
  rendered(@Req() request: Request, @Param('slug') slug: string): Promise<RenderedPost> {
    return this.posts.render(slug, { includeDrafts: this.optionalAuth.isAuthenticated(request) });
  }
}
