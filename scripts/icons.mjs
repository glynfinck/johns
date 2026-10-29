// Draws every app icon from one mark: the J in its road-sign frame, on Bin
// Night amber. Run `node scripts/icons.mjs` after changing the mark; it
// rewrites the SVG sources and renders each PNG at its size.
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const AMBER = "#F3AA00";
const INK = "#16181A";

// The J's centre line, drawn at 46 wide. Its ink spans x 168–323 and
// y 162–385; MARK puts that box in the middle of the frame's inside
// (119–393), 15% smaller so it has room on every side.
const J = "M300 162 V300 C300 344 276 362 246 362 C214 362 196 344 190 314";
const J_SCALE = 0.85;
const J_MOVE = `translate(${(256 - 245.5 * J_SCALE).toFixed(3)} ${(256 - 273.5 * J_SCALE).toFixed(3)}) scale(${J_SCALE})`;

function mark(ink) {
  return (
    `<rect x="104" y="104" width="304" height="304" rx="40" fill="none" stroke="${ink}" stroke-width="30"/>` +
    `<path transform="${J_MOVE}" d="${J}" fill="none" stroke="${ink}" stroke-width="${(46 / J_SCALE).toFixed(3)}" stroke-linecap="butt" stroke-linejoin="round"/>`
  );
}

// full: the frame at its own size. safe: shrunk into the middle 78%, which
// maskable and Android adaptive icons keep whatever shape they crop to.
function svg({ safe = false, background = AMBER, radius = 0, ink = INK } = {}) {
  const group = safe ? "translate(56.3 56.3) scale(0.78)" : "translate(0 0) scale(1)";
  const ground = background ? `<rect width="512" height="512" rx="${radius}" fill="${background}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${ground}<g transform="${group}">${mark(ink)}</g></svg>`;
}

const SOURCES = {
  "scripts/icon-square.svg": svg(),
  "scripts/icon-maskable.svg": svg({ safe: true }),
};

const PNGS = [
  ["apps/client/public/icon-192.png", 192, svg()],
  ["apps/client/public/icon-512.png", 512, svg()],
  ["apps/client/public/icon-maskable-512.png", 512, svg({ safe: true })],
  ["apps/client/assets/images/icon.png", 1024, svg()],
  ["apps/client/assets/images/splash-icon.png", 1024, svg()],
  ["apps/client/assets/images/favicon.png", 48, svg()],
  ["apps/client/assets/images/android-icon-foreground.png", 1024, svg({ safe: true, background: null })],
  ["apps/client/assets/images/android-icon-monochrome.png", 1024, svg({ safe: true, background: null, ink: "#000000" })],
];

for (const [path, text] of Object.entries(SOURCES)) writeFileSync(path, text);

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [path, size, text] of PNGS) {
  await page.setViewportSize({ width: size, height: size });
  const sized = text.replace("<svg ", `<svg width="${size}" height="${size}" `);
  await page.setContent(`<body style="margin:0;background:transparent">${sized}</body>`);
  await page.screenshot({ path, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await browser.close();
