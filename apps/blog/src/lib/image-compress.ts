/**
 * Browser-side image compression.
 *
 * Raw camera and screenshot files must never reach Vercel Blob — a 6MB PNG
 * screenshot becomes a ~120KB WebP with no visible difference at blog widths.
 * Doing it here rather than on the server also means the bytes are never
 * uploaded twice and no image codec has to run in a serverless function.
 */

export interface CompressionOptions {
  /** Longest edge, in CSS pixels. Anything larger is scaled down. */
  maxEdge?: number;
  quality?: number;
  /** Falls back to JPEG automatically when WebP encoding is unavailable. */
  mimeType?: 'image/webp' | 'image/jpeg';
}

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  /** 0–1; how much smaller the result is than the input. */
  saved: number;
  filename: string;
}

const DEFAULTS: Required<CompressionOptions> = {
  maxEdge: 1600,
  quality: 0.82,
  mimeType: 'image/webp',
};

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressedImage> {
  const settings = { ...DEFAULTS, ...options };

  if (!file.type.startsWith('image/')) {
    throw new Error(`${file.name} is not an image`);
  }
  // SVG is already a compressed vector; rasterising it would be a downgrade.
  if (file.type === 'image/svg+xml') {
    throw new Error('SVG uploads are not supported — export a raster image instead');
  }

  const bitmap = await decode(file);
  const scale = Math.min(1, settings.maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable — cannot compress the image');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  if ('close' in bitmap) bitmap.close();

  let blob = await toBlob(canvas, settings.mimeType, settings.quality);
  // Safari used to silently hand back a PNG when asked for WebP.
  if (!blob || blob.type !== settings.mimeType) {
    blob = await toBlob(canvas, 'image/jpeg', settings.quality);
  }
  if (!blob) throw new Error('The browser refused to encode the image');

  return {
    blob,
    width,
    height,
    originalSize: file.size,
    saved: file.size > 0 ? Math.max(0, 1 - blob.size / file.size) : 0,
    filename: file.name.replace(/\.[^.]+$/, ''),
  };
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to the <img> path */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not decode the image'));
      image.src = url;
    });
  } finally {
    // Revoking immediately is safe: decoding has already finished or failed.
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}
