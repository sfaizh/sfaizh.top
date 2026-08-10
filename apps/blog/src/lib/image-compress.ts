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

  const { source, release } = await decode(file);
  const scale = Math.min(1, settings.maxEdge / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    release();
    throw new Error('Canvas is unavailable — cannot compress the image');
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  try {
    context.drawImage(source, 0, 0, width, height);
  } finally {
    // Only once the pixels are on the canvas.
    release();
  }

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

/**
 * Decode a file into something drawable.
 *
 * Three routes, because any one of them can fail on a file that is perfectly
 * fine: `createImageBitmap` is fastest but refuses some sources, an object URL
 * can be blocked by policy, and a data URL always works but costs memory. The
 * caller must call `release()` once it has finished drawing — revoking the URL
 * earlier can invalidate the image mid-draw.
 */
async function decode(file: File): Promise<{
  source: CanvasImageSource & { width: number; height: number };
  release: () => void;
}> {
  const failures: string[] = [];

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, release: () => bitmap.close() };
    } catch (cause) {
      failures.push(`createImageBitmap: ${(cause as Error).message || cause}`);
    }
  }

  try {
    const url = URL.createObjectURL(file);
    const image = await loadImage(url);
    return { source: image, release: () => URL.revokeObjectURL(url) };
  } catch (cause) {
    failures.push(`object URL: ${(cause as Error).message || cause}`);
  }

  try {
    const image = await loadImage(await readAsDataUrl(file));
    return { source: image, release: () => undefined };
  } catch (cause) {
    failures.push(`data URL: ${(cause as Error).message || cause}`);
  }

  // Say *why*, so the next report is actionable rather than a shrug. A file
  // dragged from another tab or a cloud folder often arrives as a reference
  // the page is not allowed to read.
  throw new Error(
    `Could not decode ${file.name || 'the image'} (${file.type || 'unknown type'}, ${formatBytes(file.size)}). ` +
      `It may be a link rather than a real file — try saving it locally first. [${failures.join('; ')}]`
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('the browser could not read it'));
    image.src = src;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('the file could not be read'));
    reader.readAsDataURL(file);
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}
