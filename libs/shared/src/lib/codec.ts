import { deflateRaw, inflateRaw } from 'pako';
import { CONTENT_ENCODING, type ContentEncoding } from './types';

/**
 * Markdown bodies are never stored as plain text. They are DEFLATE'd and then
 * base64url encoded so they survive JSON transport, database columns and URLs
 * without escaping. `pako` is used rather than node's `zlib` so that the exact
 * same code path runs in the browser (the admin editor decodes in memory) and
 * on the server (the API encodes on write).
 *
 * Payloads carry a short magic prefix so a value can be recognised as encoded
 * without consulting a schema, and so the format can be versioned later.
 */
export const CODEC_MAGIC = 'mdz1';
const SEPARATOR = '.';

export interface DecodeResult {
  markdown: string;
  /** Bytes on the wire, after encoding. */
  encodedBytes: number;
  /** Bytes of UTF-8 markdown, before encoding. */
  rawBytes: number;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: false });

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  // Chunked to avoid blowing the argument limit on large posts.
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary =
    typeof atob === 'function'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Compress markdown into the transport format: `mdz1.<base64url>`.
 */
export function encodeMarkdown(markdown: string): string {
  const raw = textEncoder.encode(markdown);
  const compressed = deflateRaw(raw, { level: 9 });
  return `${CODEC_MAGIC}${SEPARATOR}${bytesToBase64Url(compressed)}`;
}

/**
 * Reverse {@link encodeMarkdown}. Plain (unencoded) markdown is passed through
 * untouched so that legacy rows, seed data and hand-written fixtures all work.
 */
export function decodeMarkdown(payload: string): string {
  return decodeMarkdownDetailed(payload).markdown;
}

export function decodeMarkdownDetailed(payload: string): DecodeResult {
  if (!isEncodedMarkdown(payload)) {
    return {
      markdown: payload,
      encodedBytes: textEncoder.encode(payload).length,
      rawBytes: textEncoder.encode(payload).length,
    };
  }
  const body = payload.slice(CODEC_MAGIC.length + SEPARATOR.length);
  let markdown: string;
  try {
    const bytes = base64UrlToBytes(body);
    markdown = textDecoder.decode(inflateRaw(bytes));
  } catch (cause) {
    throw new Error('Corrupt markdown payload: could not inflate', { cause });
  }
  return {
    markdown,
    encodedBytes: payload.length,
    rawBytes: textEncoder.encode(markdown).length,
  };
}

export function isEncodedMarkdown(value: string): boolean {
  return typeof value === 'string' && value.startsWith(`${CODEC_MAGIC}${SEPARATOR}`);
}

/** Encode only if the value is not already encoded — safe to call twice. */
export function ensureEncoded(value: string): string {
  return isEncodedMarkdown(value) ? value : encodeMarkdown(value);
}

export function contentEncoding(): ContentEncoding {
  return CONTENT_ENCODING;
}

/** How much smaller the stored payload is, as a 0–1 ratio. Handy for the UI. */
export function compressionRatio(markdown: string, encoded: string): number {
  const raw = textEncoder.encode(markdown).length;
  if (raw === 0) return 0;
  return 1 - encoded.length / raw;
}

export function utf8Bytes(value: string): number {
  return textEncoder.encode(value).length;
}
