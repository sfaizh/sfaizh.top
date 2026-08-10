import { TextDecoder, TextEncoder } from 'node:util';

/**
 * jsdom does not expose the encoding APIs that the markdown codec uses. They
 * are standard in every browser the site supports, so the polyfill belongs in
 * the harness rather than in the source.
 */
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder as unknown as typeof globalThis.TextEncoder;
}

if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;
}
