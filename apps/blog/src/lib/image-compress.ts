import { MAX_UPLOAD_BYTES } from '@sfaizh/shared';

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
  /** True when the original bytes were uploaded untouched (animated images). */
  passthrough?: boolean;
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

  // A canvas holds exactly one frame, so anything animated has to skip the
  // compressor entirely — re-encoding a GIF here is what silently turns it
  // into a still WebP.
  const animation = await inspectAnimation(file);
  if (animation.animated) return passThrough(file, animation);

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
 * Upload an animated image exactly as it arrived.
 *
 * There is nothing to compress: shrinking it would mean decoding every frame
 * and re-encoding the animation, which the browser has no API for. The only
 * thing left to enforce is the size ceiling, and since we cannot make the file
 * any smaller the message has to say so rather than blaming compression.
 */
async function passThrough(
  file: File,
  animation: AnimationInfo
): Promise<CompressedImage> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `${file.name} is ${formatBytes(file.size)}. Animated images are uploaded frame-for-frame, ` +
        `so it has to be under ${formatBytes(MAX_UPLOAD_BYTES)} already — trim it or drop the frame rate.`
    );
  }

  // The GIF header carries the real dimensions; other formats need a decode,
  // and a failure there is not fatal because the size is only metadata.
  let { width = 0, height = 0 } = animation;
  if (!width || !height) {
    try {
      const { source, release } = await decode(file);
      width = source.width;
      height = source.height;
      release();
    } catch {
      /* dimensions are advisory — the upload is still perfectly valid */
    }
  }

  // A file dragged in from another window can arrive with an empty `type`,
  // and the server reads the content type to decide what it is storing.
  const blob = file.type ? file : file.slice(0, file.size, animation.mime ?? 'image/gif');

  return {
    blob,
    width,
    height,
    originalSize: file.size,
    saved: 0,
    filename: file.name.replace(/\.[^.]+$/, ''),
    passthrough: true,
  };
}

export interface AnimationInfo {
  animated: boolean;
  width?: number;
  height?: number;
  /** The type the bytes say it is, which a dropped file often does not carry. */
  mime?: string;
}

/**
 * Work out whether a file has more than one frame, from its bytes.
 *
 * Container inspection rather than a guess at the extension: a `.gif` that is
 * really a single still should still get compressed, and an animated WebP
 * dropped in from another site has no telling extension at all.
 */
export async function inspectAnimation(file: File): Promise<AnimationInfo> {
  try {
    // Enough for a GIF's frame table and for the APNG control chunk, which
    // the spec requires to appear before the first IDAT.
    const head = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
    return detectAnimation(head);
  } catch {
    return { animated: false };
  }
}

/** Byte-level format sniffing, split out so it can be tested without a File. */
export function detectAnimation(bytes: Uint8Array): AnimationInfo {
  if (startsWith(bytes, 'GIF8')) return inspectGif(bytes);
  if (startsWith(bytes, 'RIFF') && startsWith(bytes, 'WEBP', 8)) {
    // A VP8X extended header is the only WebP that can be animated; bit 1 of
    // its flag byte is the animation flag.
    const animated = startsWith(bytes, 'VP8X', 12) && (bytes[20] & 0x02) !== 0;
    return { animated, mime: 'image/webp' };
  }
  if (startsWith(bytes, '\x89PNG')) return { animated: pngHasAcTL(bytes), mime: 'image/png' };
  return { animated: false };
}

function inspectGif(bytes: Uint8Array): AnimationInfo {
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);

  const packed = bytes[10];
  let offset = 13;
  if (packed & 0x80) offset += 3 * (1 << ((packed & 0x07) + 1)); // global colour table

  let frames = 0;
  while (offset < bytes.length) {
    const block = bytes[offset];

    if (block === 0x21) {
      // Extension: marker, label, then length-prefixed sub-blocks.
      offset = skipSubBlocks(bytes, offset + 2);
      continue;
    }

    if (block === 0x2c) {
      if (++frames > 1) return { animated: true, width, height, mime: 'image/gif' };
      const local = bytes[offset + 9];
      offset += 10;
      if (local & 0x80) offset += 3 * (1 << ((local & 0x07) + 1)); // local colour table
      offset = skipSubBlocks(bytes, offset + 1); // + LZW minimum code size
      continue;
    }

    // Trailer (0x3b), or a byte we do not understand: either way there is no
    // second frame to be found from here.
    break;
  }

  return { animated: false, width, height, mime: 'image/gif' };
}

function skipSubBlocks(bytes: Uint8Array, start: number): number {
  let offset = start;
  while (offset < bytes.length) {
    const size = bytes[offset++];
    if (size === 0) break;
    offset += size;
  }
  return offset;
}

function pngHasAcTL(bytes: Uint8Array): boolean {
  let offset = 8; // signature
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type === 'acTL') return true;
    // acTL is required to precede IDAT, so this is a definitive "no".
    if (type === 'IDAT' || type === 'IEND') return false;
    offset += 12 + length; // length + type + data + CRC
  }
  return false;
}

function startsWith(bytes: Uint8Array, signature: string, at = 0): boolean {
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[at + index] !== signature.charCodeAt(index)) return false;
  }
  return true;
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
