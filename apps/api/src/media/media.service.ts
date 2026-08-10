import { Inject, Injectable, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { put } from '@vercel/blob';
import { assertUploadable, slugify, ValidationError, type UploadedMedia } from '@sfaizh/shared';
import { API_CONFIG, type ApiConfig } from '../config/config';

/**
 * Images arrive already re-encoded by the browser (see `image-compress.ts` in
 * the web app) — the server's job is to refuse anything that is not a
 * compressed image and to hand it to Vercel Blob under a stable path.
 */
@Injectable()
export class MediaService {
  constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {}

  get enabled(): boolean {
    return this.config.blob !== null;
  }

  async upload(params: {
    body: Buffer;
    filename: string;
    contentType: string;
    originalSize?: number;
    width?: number;
    height?: number;
  }): Promise<UploadedMedia> {
    if (!this.config.blob) {
      throw new ServiceUnavailableException(
        'Image uploads are disabled. Set BLOB_READ_WRITE_TOKEN to enable them.'
      );
    }
    if (!params.body?.length) throw new BadRequestException('Empty upload body');

    try {
      assertUploadable(params.contentType, params.body.length);
    } catch (error) {
      if (error instanceof ValidationError) throw new BadRequestException(error.issues);
      throw error;
    }

    const pathname = this.buildPathname(params.filename, params.contentType);
    const blob = await put(pathname, params.body, {
      access: 'public',
      contentType: params.contentType,
      token: this.config.blob.token,
      addRandomSuffix: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });

    return {
      url: blob.url,
      pathname: blob.pathname,
      contentType: params.contentType,
      size: params.body.length,
      originalSize: params.originalSize ?? params.body.length,
      width: params.width,
      height: params.height,
    };
  }

  /** `blog/2026/06/my-diagram.webp` — sortable, readable, collision-resistant. */
  private buildPathname(filename: string, contentType: string): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');

    const extension = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
    const stem = slugify(filename.replace(/\.[^.]+$/, '')) || 'image';

    return `${this.config.blob?.prefix ?? 'blog'}/${year}/${month}/${stem}.${extension}`;
  }
}
