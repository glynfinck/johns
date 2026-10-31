import type { QrShape } from "@app/core";
import jsQR from "jsqr";

/**
 * Reads a QR code the way a phone camera would: paints the app's drawing of
 * it (dark runs on white, `scale` pixels to a unit) and decodes the pixels.
 * Null when nothing in it scans.
 */
export function scanQr({ size, path }: QrShape, scale = 2): string | null {
  const side = Math.ceil(size * scale);
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
  for (const [, x, y, w, h] of path.matchAll(/M([\d.]+) ([\d.]+)h([\d.]+)v([\d.]+)h-[\d.]+z/g)) {
    const [left, top, width, height] = [x, y, w, h].map((n) => Math.round(Number(n) * scale));
    for (let row = top; row < top + height; row++) {
      for (let col = left; col < left + width; col++) pixels.fill(0, (row * side + col) * 4, (row * side + col) * 4 + 3);
    }
  }
  return jsQR(pixels, side, side)?.data ?? null;
}
