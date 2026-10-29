// Draws every brand image from one mark (packages/core/src/mark.ts): the app
// icons, the favicons, the link-preview card, the email header, the README
// banner and the files for dashboards that take a logo by hand (Stripe,
// Google, Microsoft, the stores). Run `npm run brand` after changing the mark
// or the colours; it rewrites every file below at its size. docs/brand/README.md
// says where each one goes. The join links' cards are drawn per house on
// request instead (apps/api/app/api/og), from the same mark.
//
// `npm run brand -- --store today.png week.png …` also frames phone
// screenshots for the App Store and Google Play, one headline each.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";

import { SIGN_SMALL, TILE_RADIUS, signSvg } from "../packages/core/src/mark.ts";

const AMBER = "#f3aa00";
const AMBER_DARK = "#ffb81c";
const INK = "#16181a";
const PAVEMENT = "#e7e9e5";
const TARMAC = "#111315";
const ON_TARMAC = "#edefeb";
const MUTED_DARK = "#99a0a5";

const TAGLINE = "Fair shares of the housework.";
const PUBLIC = "apps/client/public";
const IMAGES = "apps/client/assets/images";
const BRAND = "docs/brand";

const svgUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

// ── Icons: the sign alone, as each platform asks ──────────────────────────

const icon = {
  // A store icon is square and opaque: iOS and Google Play round it themselves.
  square: signSvg({ ink: INK, ground: AMBER }),
  // Android adaptive and PWA maskable icons keep only the middle, whatever
  // shape they crop to.
  maskable: signSvg({ ink: INK, ground: AMBER, safe: 0.78 }),
  foreground: signSvg({ ink: INK, safe: 0.78 }),
  monochrome: signSvg({ ink: "#000000", safe: 0.78 }),
  // iOS 18's dark home screen draws its own dark ground under a clear icon,
  // and tints a grey one to the wallpaper.
  dark: signSvg({ ink: AMBER_DARK, safe: 0.86 }),
  tinted: signSvg({ ink: "#d9d9d9", safe: 0.86 }),
  // Jonz's own rounded tile: the splash, the lockup, the cards.
  tile: signSvg({ ink: INK, ground: AMBER, radius: TILE_RADIUS }),
  // A browser tab: the small-size master, so the lines survive 16px.
  favicon: signSvg({ ink: INK, ground: AMBER, radius: 96, master: SIGN_SMALL }),
};

const SOURCES = {
  "scripts/icon-square.svg": icon.square,
  "scripts/icon-maskable.svg": icon.maskable,
  [`${PUBLIC}/favicon.svg`]: icon.favicon,
};

const ICONS = [
  [`${PUBLIC}/icon-192.png`, 192, icon.square],
  [`${PUBLIC}/icon-512.png`, 512, icon.square],
  [`${PUBLIC}/icon-maskable-512.png`, 512, icon.maskable],
  // iPhone's Add to Home Screen: 180, opaque, square (iOS rounds it).
  [`${PUBLIC}/apple-touch-icon.png`, 180, icon.square],
  [`${IMAGES}/icon.png`, 1024, icon.square],
  [`${IMAGES}/icon-dark.png`, 1024, icon.dark],
  [`${IMAGES}/icon-tinted.png`, 1024, icon.tinted],
  [`${IMAGES}/splash-icon.png`, 1024, icon.tile],
  [`${IMAGES}/favicon.png`, 48, icon.favicon],
  [`${IMAGES}/android-icon-foreground.png`, 1024, icon.foreground],
  [`${IMAGES}/android-icon-monochrome.png`, 1024, icon.monochrome],
  // For dashboards that take a logo by hand (docs/brand/README.md).
  [`${BRAND}/icon-512.png`, 512, icon.square],
  [`${BRAND}/icon-1024.png`, 1024, icon.square],
  [`${BRAND}/logo-120.png`, 120, icon.square],
  [`${BRAND}/profile-400.png`, 400, icon.square],
];

/** The favicon.ico sizes, every one from the small-size master. */
const ICO_SIZES = [16, 32, 48];

// ── Cards: the lockup and a line, in Overpass ─────────────────────────────

const FONTS = [
  [400, "Overpass_400Regular"],
  [700, "Overpass_700Bold"],
  [800, "Overpass_800ExtraBold"],
  [900, "Overpass_900Black"],
]
  .map(
    ([weight, file]) =>
      `@font-face{font-family:Overpass;font-weight:${weight};src:url(data:font/ttf;base64,${readFileSync(
        `apps/client/assets/fonts/${file}.ttf`,
      ).toString("base64")}) format("truetype")}`,
  )
  .join("");

const CSS = `${FONTS}
*{box-sizing:border-box;margin:0}
html,body{background:transparent}
.card{display:flex;flex-direction:column;justify-content:space-between;font-family:Overpass;overflow:hidden}
.lock{display:flex;align-items:center;gap:.32em;line-height:1}
.lock img{width:1.25em;height:1.25em;display:block}
.wm{font-weight:900;text-transform:uppercase;letter-spacing:.02em;transform:translateY(.06em)}
.head{font-weight:900;text-transform:uppercase;line-height:1;letter-spacing:.005em}
.sub{font-weight:700}`;

/** The lockup: the sign (a tile, or one colour on amber) and JONZ beside it. */
function lockup({ size, ink, tile }) {
  const sign = tile ? icon.tile : signSvg({ ink });
  return `<div class="lock" style="font-size:${size}px;color:${ink}"><img src="${svgUri(sign)}" alt=""><span class="wm">Jonz</span></div>`;
}

const dot = `<span style="display:inline-block;margin:0 .45em">·</span>`;

/** The card every jonz.app link previews with, and the repo's social preview. */
function shareCard(width, height) {
  const pad = Math.round(width * 0.065);
  return `<div class="card" style="width:${width}px;height:${height}px;background:${AMBER};color:${INK};padding:${pad}px">
    ${lockup({ size: Math.round(width * 0.065), ink: INK })}
    <div style="display:flex;flex-direction:column;gap:${Math.round(width * 0.02)}px">
      <div class="head" style="font-size:${Math.round(width * 0.084)}px">Fair shares of<br>the housework.</div>
      <div class="sub" style="font-size:${Math.round(width * 0.027)}px">A house that keeps score${dot}jonz.app</div>
    </div></div>`;
}

const CARDS = [
  [`${PUBLIC}/og.png`, 1200, 630, shareCard(1200, 630)],
  [`${BRAND}/social-preview.png`, 1280, 640, shareCard(1280, 640)],
  // The README's banner, one per GitHub theme.
  ...[
    ["light", PAVEMENT, INK, "#596066"],
    ["dark", TARMAC, ON_TARMAC, MUTED_DARK],
  ].map(([look, ground, ink, muted]) => [
    `${BRAND}/readme-banner-${look}.png`,
    1280,
    360,
    `<div class="card" style="width:1280px;height:360px;background:${ground};padding:0 88px;flex-direction:row;align-items:center">
      ${lockup({ size: 104, ink, tile: true })}
      <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-end;text-align:right">
        <div class="head" style="font-size:40px;color:${ink}">Fair shares of<br>the housework.</div>
        <div class="sub" style="font-size:22px;color:${muted}">And a house that keeps score.</div>
      </div></div>`,
  ]),
  // An email's header strip, shown at 600×120.
  [
    `${BRAND}/email-header.png`,
    1200,
    240,
    `<div class="card" style="width:1200px;height:240px;background:${AMBER};padding:0 64px;justify-content:center">${lockup({ size: 88, ink: INK })}</div>`,
  ],
  // Google Play's feature graphic, which it shows over the listing.
  [
    `${BRAND}/play-feature.png`,
    1024,
    500,
    `<div class="card" style="width:1024px;height:500px;background:${AMBER};color:${INK};padding:64px">
      ${lockup({ size: 72, ink: INK })}
      <div class="head" style="font-size:76px">Fair shares of<br>the housework.</div></div>`,
  ],
];

/** The lockup on clear, for anywhere else it's placed by hand: tarmac ink, and light ink for dark grounds. */
const LOCKUPS = [
  [`${BRAND}/lockup.png`, INK],
  [`${BRAND}/lockup-on-dark.png`, ON_TARMAC],
].map(([path, ink]) => [path, 1200, 300, `<div style="width:1200px;height:300px;display:flex;align-items:center;justify-content:center;font-family:Overpass">${lockup({ size: 150, ink, tile: true })}</div>`]);

// ── Store frames ──────────────────────────────────────────────────────────

/** Headlines for the store frames, in order: caps, five words at most. */
const STORE_HEADLINES = [
  ["Johns, dealt fair.", AMBER, INK],
  ["The bathroom moves around.", TARMAC, AMBER_DARK],
  ["Tick it. The house checks.", AMBER, INK],
  ["Away? Your share waits.", TARMAC, AMBER_DARK],
];

const STORES = [
  ["ios", 1290, 2796],
  ["play", 1080, 1920],
];

function storeFrame(width, height, screen, [headline, ground, ink]) {
  const pad = Math.round(width * 0.08);
  return `<div class="card" style="width:${width}px;height:${height}px;background:${ground};justify-content:flex-start">
    <div class="head" style="color:${ink};font-size:${Math.round(width * 0.105)}px;line-height:.98;padding:${Math.round(height * 0.05)}px ${pad}px ${Math.round(height * 0.03)}px">${headline}</div>
    <div style="flex:1;margin:0 ${Math.round(width * 0.09)}px;background:#16181a;border-radius:${Math.round(width * 0.09)}px ${Math.round(width * 0.09)}px 0 0;padding:${Math.round(width * 0.026)}px ${Math.round(width * 0.026)}px 0;overflow:hidden">
      <img src="data:image/png;base64,${readFileSync(screen).toString("base64")}" style="width:100%;display:block;border-radius:${Math.round(width * 0.07)}px ${Math.round(width * 0.07)}px 0 0">
    </div></div>`;
}

// ── Drawing ───────────────────────────────────────────────────────────────

/** favicon.ico: each size's PNG, packed into one file (the format allows PNG entries). */
function ico(pngs) {
  const header = Buffer.alloc(6 + pngs.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(([size, png], i) => {
    const entry = 6 + i * 16;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...pngs.map(([, png]) => png)]);
}

const write = (path, data) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
};

const store = process.argv.indexOf("--store");
const screens = store === -1 ? [] : process.argv.slice(store + 1);

for (const [path, text] of Object.entries(SOURCES)) write(path, text);

// A sandbox with its own Chromium points at it (PW_CHROMIUM), as the e2e do.
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage();

async function draw(html, width, height, path) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><head><style>${CSS}</style></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width, height } });
  if (path) write(path, png);
  return png;
}

const sized = (svg, size) => svg.replace("<svg ", `<svg width="${size}" height="${size}" style="display:block" `);

for (const [path, size, svg] of ICONS) await draw(sized(svg, size), size, size, path);

const icoPngs = [];
for (const size of ICO_SIZES) icoPngs.push([size, await draw(sized(icon.favicon, size), size, size)]);
write(`${PUBLIC}/favicon.ico`, ico(icoPngs));

for (const [path, width, height, html] of [...CARDS, ...LOCKUPS]) await draw(html, width, height, path);

for (const [i, screen] of screens.entries()) {
  const headline = STORE_HEADLINES[i % STORE_HEADLINES.length];
  for (const [store, width, height] of STORES) {
    await draw(storeFrame(width, height, screen, headline), width, height, join(BRAND, "store", `${store}-${i + 1}.png`));
  }
}

await browser.close();
