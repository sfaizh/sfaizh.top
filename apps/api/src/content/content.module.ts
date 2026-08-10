import { Module } from '@nestjs/common';
import { API_CONFIG, type ApiConfig } from '../config/config';
import { AdminPostsController } from './admin-posts.controller';
import { FilePostsRepository } from './file-posts.repository';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { DB_POSTS_REPOSITORY } from './posts.repository';
import { SupabasePostsRepository } from './supabase-posts.repository';

@Module({
  controllers: [PostsController, AdminPostsController],
  providers: [
    FilePostsRepository,
    {
      // Resolves to `null` when Supabase is unconfigured, which is the signal
      // the service uses to fall back to read-only filesystem mode.
      provide: DB_POSTS_REPOSITORY,
      inject: [API_CONFIG],
      useFactory: (config: ApiConfig) =>
        config.supabase ? new SupabasePostsRepository(config.supabase) : null,
    },
    PostsService,
  ],
  exports: [PostsService],
})
export class ContentModule {}
