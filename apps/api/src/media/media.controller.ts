import { Controller, Delete, Get, Inject, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { UploadedMedia } from '@sfaizh/shared';
import { AuthGuard } from '../auth/auth.guard';
import { MediaService } from './media.service';

/**
 * The upload endpoint takes a raw body rather than multipart: the browser has
 * already produced a single compressed blob, so there is nothing to
 * multiplex, and raw bodies survive Vercel's request pipeline unchanged.
 */
@Controller('admin/media')
@UseGuards(AuthGuard)
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Get()
  status(): { enabled: boolean } {
    return { enabled: this.media.enabled };
  }

  /** Remove an upload the editor no longer references. */
  @Delete()
  remove(@Query('url') url: string): Promise<{ removed: boolean }> {
    return this.media.remove(url);
  }

  @Post()
  upload(
    @Req() request: Request,
    @Query('filename') filename = 'image',
    @Query('originalSize') originalSize?: string,
    @Query('width') width?: string,
    @Query('height') height?: string
  ): Promise<UploadedMedia> {
    const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    return this.media.upload({
      body,
      filename,
      contentType: (request.headers['content-type'] ?? '').split(';')[0].trim(),
      originalSize: originalSize ? Number(originalSize) : undefined,
      width: width ? Number(width) : undefined,
      height: height ? Number(height) : undefined,
    });
  }
}
