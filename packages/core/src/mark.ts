// The sign: the J in its road-sign frame, Jonz's mark. One drawing for every
// place it shows up: the app's lockup (React Native), the link-preview cards
// (apps/api) and every icon file (scripts/icons.mjs, which imports this file
// directly, so it imports nothing and uses only syntax Node can strip).
//
// Drawn on a 512 square. The J is a centre line stroked at 46 wide; its ink
// spans x 168–323 and y 162–385, and each master scales it about its own
// middle so it sits centred in the frame.

const J_PATH = "M300 162 V300 C300 344 276 362 246 362 C214 362 196 344 190 314";
const J_MIDDLE = { x: 245.5, y: 273.5 };

export interface SignMaster {
  /** The frame's outer box, its corner radius and its stroke, all on the 512 square. */
  frame: { inset: number; radius: number; stroke: number };
  /** How much smaller or larger than drawn the J is, and its stroke after scaling. */
  j: { scale: number; stroke: number };
}

/** The sign at its own size: an app icon, a lockup, anything 48px and up. */
export const SIGN: SignMaster = {
  frame: { inset: 104, radius: 40, stroke: 30 },
  j: { scale: 0.85, stroke: 46 },
};

/**
 * Below 48px (a browser tab, a notification): a heavier frame that fills more
 * of the tile and a bigger J, so the lines stay a pixel or more wide at 16.
 */
export const SIGN_SMALL: SignMaster = {
  frame: { inset: 64, radius: 56, stroke: 56 },
  j: { scale: 0.95, stroke: 74 },
};

/** Below this many pixels, draw SIGN_SMALL. */
export const SIGN_SMALL_BELOW = 48;

/** The drawing's parts, for a renderer that draws them itself (react-native-svg). */
export function signParts(master: SignMaster = SIGN) {
  const { inset, radius, stroke } = master.frame;
  const { scale } = master.j;
  const dx = 256 - J_MIDDLE.x * scale;
  const dy = 256 - J_MIDDLE.y * scale;
  return {
    frame: { x: inset, y: inset, size: 512 - inset * 2, radius, stroke },
    j: {
      d: J_PATH,
      transform: `translate(${dx.toFixed(3)} ${dy.toFixed(3)}) scale(${scale})`,
      // The stroke is drawn inside the scaled group, so undo the scale.
      stroke: Number((master.j.stroke / scale).toFixed(3)),
    },
  };
}

export interface SignOptions {
  /** The ink: tarmac on amber, amber on tarmac. */
  ink: string;
  /** The tile under it, or none for a transparent file. */
  ground?: string | null;
  /** The tile's corner radius on the 512 square (0 for a store icon, which the store rounds). */
  radius?: number;
  /** Shrink the drawing into the middle (0–1): what Android's adaptive mask and PWA maskable icons keep. */
  safe?: number;
  master?: SignMaster;
}

/** The sign as an SVG document on a 512 viewBox. */
export function signSvg({ ink, ground = null, radius = 0, safe = 1, master = SIGN }: SignOptions): string {
  const { frame, j } = signParts(master);
  const shrink = safe === 1 ? "" : ` transform="translate(${(256 * (1 - safe)).toFixed(3)} ${(256 * (1 - safe)).toFixed(3)}) scale(${safe})"`;
  const tile = ground ? `<rect width="512" height="512" rx="${radius}" fill="${ground}"/>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${tile}<g${shrink}>` +
    `<rect x="${frame.x}" y="${frame.y}" width="${frame.size}" height="${frame.size}" rx="${frame.radius}" fill="none" stroke="${ink}" stroke-width="${frame.stroke}"/>` +
    `<path transform="${j.transform}" d="${j.d}" fill="none" stroke="${ink}" stroke-width="${j.stroke}" stroke-linecap="butt" stroke-linejoin="round"/>` +
    `</g></svg>`
  );
}

/** The rounded tile's corner radius on the 512 square, where Jonz draws its own tile (splash, lockup, cards). */
export const TILE_RADIUS = 112;

/**
 * A sign plate, the way Jonz posts anything it says out loud (a link's card,
 * a banner, a store headline): an amber plate with an ink border inset from
 * its edge, the J sign at the left like a route shield, then the legend in
 * Overpass Black caps, and under it a pavement plate with the small print,
 * as a supplementary plate hangs under a road sign. Sizes are at a 1200-wide
 * card's scale.
 */
export const PLATE = {
  /** The plate's corner radius. */
  radius: 30,
  /** From the plate's edge to its border. */
  inset: 12,
  /** The border's width. */
  stroke: 9,
  /** Between the sign and the plate under it. */
  gap: 14,
} as const;

/**
 * The legend's size on a 1200-wide card's sign, stepping down as it grows:
 * a house's name runs from "Flat 3" to sixty characters, and neither
 * renderer fits text, so a long name takes more, smaller lines.
 */
export function signLegendSize(legend: string): number {
  if (legend.length <= 6) return 150;
  if (legend.length <= 11) return 92;
  if (legend.length <= 20) return 80;
  if (legend.length <= 40) return 64;
  return 54;
}

/** How much larger the sign draws as a sign's route shield, so its frame meets the box's edge (signSvg's `safe`). */
export const SHIELD = 1.5;

/**
 * How wide a card's sign is for its words, for a renderer that can't size a
 * box to its text (Satori). Estimated from Overpass's average letter widths
 * (Black caps about 0.65 em, Bold about 0.5 em, with a little to spare),
 * plus the plates' borders and padding and the J; between 640 and 1056, and
 * a legend too long for one line takes the widest and wraps.
 */
export function signWidth(legend: string, plate: string): number {
  const frame = 2 * (PLATE.inset + PLATE.stroke + 44);
  const words = frame + 168 + 40 + 24 + legend.length * 0.65 * signLegendSize(legend);
  const under = frame + plate.length * 0.5 * 44;
  return Math.round(Math.min(1056, Math.max(640, words, under)));
}
