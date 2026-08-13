import { detectAnimation } from './image-compress';

/**
 * Format sniffing, checked against hand-built headers. The compression path
 * itself needs a real canvas, so it belongs in the e2e suite — but deciding
 * *whether* to compress is pure byte inspection, and it is the decision that
 * broke animated GIFs.
 */

const GIF_HEADER = [
  ...[0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  0x10, 0x00, // width 16
  0x08, 0x00, // height 8
  0x00, // packed: no global colour table
  0x00, // background colour
  0x00, // pixel aspect ratio
];

/** A 1×1 frame: descriptor, LZW code size, one sub-block, terminator. */
const GIF_FRAME = [0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0x00, 0x02, 0x01, 0x44, 0x00];

const GRAPHIC_CONTROL = [0x21, 0xf9, 0x04, 0x00, 0x0a, 0x00, 0x00, 0x00];

function gif(...frames: number[][]): Uint8Array {
  return new Uint8Array([...GIF_HEADER, ...frames.flat(), 0x3b]);
}

describe('detectAnimation', () => {
  it('reports a multi-frame GIF as animated, with its dimensions', () => {
    const result = detectAnimation(gif(GRAPHIC_CONTROL, GIF_FRAME, GRAPHIC_CONTROL, GIF_FRAME));

    expect(result.animated).toBe(true);
    expect(result.width).toBe(16);
    expect(result.height).toBe(8);
  });

  it('reports a single-frame GIF as still, so it is still compressed', () => {
    expect(detectAnimation(gif(GIF_FRAME)).animated).toBe(false);
  });

  it('walks past a global colour table', () => {
    const withTable = gif(GIF_FRAME, GIF_FRAME);
    withTable[10] = 0x80 | 0x01; // table present, 2^(1+1) = 4 entries
    const bytes = new Uint8Array([
      ...withTable.subarray(0, 13),
      ...new Array(12).fill(0xff), // 4 entries × 3 bytes
      ...withTable.subarray(13),
    ]);

    expect(detectAnimation(bytes).animated).toBe(true);
  });

  it('detects an animated WebP by its VP8X flag', () => {
    const bytes = new Uint8Array(32);
    bytes.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
    bytes.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8);
    bytes.set([...'VP8X'].map((c) => c.charCodeAt(0)), 12);
    bytes[20] = 0x02;

    expect(detectAnimation(bytes).animated).toBe(true);

    bytes[20] = 0x00;
    expect(detectAnimation(bytes).animated).toBe(false);
  });

  it('detects APNG by its acTL chunk, and plain PNG by its absence', () => {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const chunk = (type: string, dataLength = 0) => [
      0x00, 0x00, 0x00, dataLength,
      ...[...type].map((c) => c.charCodeAt(0)),
      ...new Array(dataLength + 4).fill(0), // data + CRC
    ];

    const apng = new Uint8Array([...signature, ...chunk('IHDR', 13), ...chunk('acTL', 8)]);
    const png = new Uint8Array([...signature, ...chunk('IHDR', 13), ...chunk('IDAT', 4)]);

    expect(detectAnimation(apng).animated).toBe(true);
    expect(detectAnimation(png).animated).toBe(false);
  });

  it('leaves unknown bytes alone', () => {
    expect(detectAnimation(new Uint8Array([1, 2, 3, 4])).animated).toBe(false);
  });
});
