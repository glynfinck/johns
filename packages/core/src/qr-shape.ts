// The QR code Supabase sends when the owner adds an authenticator
// (docs/specs/owner-admin.md), made drawable at any size.

/** A QR code as one path in a square of `size`, its quiet border included. */
export interface QrShape {
  size: number;
  path: string;
}

/**
 * Supabase draws its QR code (goqrsvg on SVGo) as 3-unit squares on an SVG
 * with a width and height but no viewBox, so it can't be scaled: drawn in a
 * bigger box it sits in the top corner, and in a smaller one it's cut off.
 * Each square carries its colour in a style ("fill:black;stroke:none"). This
 * keeps only the dark squares, joined into runs along each row, as one path
 * the app can draw at any size. It takes the markup or the data: URL that
 * supabase-js hands back. Null when there's nothing to draw.
 *
 * tests/db/owner-admin.test.ts checks this against a real Supabase: what it
 * draws has to scan back to the authenticator link.
 */
export function qrShape(svg: string): QrShape | null {
  const body = svg.replace(/^data:image\/svg\+xml[^,]*,/, "");
  const markup = body.includes("%3C") ? decodeURIComponent(body) : body;
  const cells: { x: number; y: number; w: number; h: number }[] = [];
  for (const [, attributes] of markup.matchAll(/<rect\b([^>]*)>/g)) {
    const attr = Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
    // Supabase puts the colour in a style; other drawers use a fill
    // attribute, or a class with no colour at all.
    const fill = (/(?:^|;)\s*fill\s*:\s*([^;]+)/.exec(attr.style ?? "")?.[1] ?? attr.fill ?? "").trim().toLowerCase();
    const dark = fill === "#000000" || fill === "#000" || fill === "black" || (!fill && attr.class === "color");
    const [x, y, w, h] = [attr.x, attr.y, attr.width, attr.height].map(Number);
    if (dark && [x, y, w, h].every(Number.isFinite)) cells.push({ x, y, w, h });
  }
  if (cells.length === 0) return null;

  const width = Number(/<svg\b[^>]*\bwidth="([\d.]+)"/.exec(markup)?.[1]);
  const left = Math.min(...cells.map((cell) => cell.x));
  const size = Number.isFinite(width) && width > 0 ? width : Math.max(...cells.map((cell) => cell.x + cell.w)) + left;

  cells.sort((a, b) => a.y - b.y || a.x - b.x);
  const runs: typeof cells = [];
  for (const cell of cells) {
    const last = runs[runs.length - 1];
    if (last && last.y === cell.y && last.h === cell.h && last.x + last.w === cell.x) last.w += cell.w;
    else runs.push({ ...cell });
  }
  return { size, path: runs.map(({ x, y, w, h }) => `M${x} ${y}h${w}v${h}h-${w}z`).join("") };
}
