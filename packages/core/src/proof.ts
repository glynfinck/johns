// Photo receipts, the same on every platform: shrunk to one size and saved
// as JPEG, so an upload stays well under the `proofs` bucket's 5 MB, and kept
// at the path its storage policies and mark_done's photo check expect.

/** The longest side a receipt keeps, in pixels. */
export const PROOF_LONG_EDGE = 1600;

/** JPEG quality for a receipt, from 0 to 1. */
export const PROOF_QUALITY = 0.82;

/**
 * The size to shrink a photo to: the long side at most PROOF_LONG_EDGE, the
 * shape kept, whole pixels. A photo that already fits keeps its size.
 */
export function proofSize(width: number, height: number): { width: number; height: number } {
  if (!(width > 0 && height > 0) || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new RangeError(`A photo has a size: got ${width}×${height}`);
  }
  const scale = Math.min(1, PROOF_LONG_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Where a receipt lives in the `proofs` bucket: `<house>/<assignment>/<file>.jpg`. */
export function proofPath(houseId: string, assignmentId: string, fileId: string): string {
  for (const part of [houseId, assignmentId, fileId]) {
    if (!part || part.includes("/")) throw new RangeError(`Not a path segment: "${part}"`);
  }
  return `${houseId}/${assignmentId}/${fileId}.jpg`;
}
