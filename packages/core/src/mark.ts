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
