import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { APP_NAME, BIN_NIGHT, SHARE_IMAGE, TILE_RADIUS, signSvg } from "@app/core";

/**
 * A join link's card, drawn by `next/og` (Satori) at 1200×630: tarmac, the
 * lockup, then "You're invited" over the house's name in Overpass Black.
 * Satori lays out with flexbox only and can't read the app's theme, so the
 * colours come from Bin Night's dark look directly, and every element with
 * more than one child says `display: flex`.
 */

const LOOK = BIN_NIGHT.dark;

/** Overpass, vendored beside the API (next.config.ts keeps it in the bundle). */
export async function cardFonts() {
  const read = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));
  const [bold, extrabold, black] = await Promise.all([
    read("Overpass_700Bold.ttf"),
    read("Overpass_800ExtraBold.ttf"),
    read("Overpass_900Black.ttf"),
  ]);
  return [
    { name: "Overpass", data: bold, weight: 700 as const, style: "normal" as const },
    { name: "Overpass", data: extrabold, weight: 800 as const, style: "normal" as const },
    { name: "Overpass", data: black, weight: 900 as const, style: "normal" as const },
  ];
}

const TILE = `data:image/svg+xml;base64,${Buffer.from(
  signSvg({ ink: BIN_NIGHT.light.onHivis, ground: BIN_NIGHT.light.hivis, radius: TILE_RADIUS }),
).toString("base64")}`;

/** Names run from "Flat 3" to sixty characters; Satori doesn't fit text, so step down as they grow. */
export function titleSize(title: string): number {
  if (title.length <= 14) return 120;
  if (title.length <= 24) return 96;
  if (title.length <= 40) return 76;
  return 60;
}

export function Card({ eyebrow, title, meta }: { eyebrow?: string; title: string; meta: string }) {
  return (
    <div
      style={{
        width: SHARE_IMAGE.width,
        height: SHARE_IMAGE.height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 78,
        backgroundColor: LOOK.background,
        fontFamily: "Overpass",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={TILE} width={75} height={75} alt="" />
        <div style={{ marginLeft: 20, marginTop: 8, fontSize: 60, fontWeight: 900, letterSpacing: 1.2, color: LOOK.foreground }}>
          {APP_NAME.toUpperCase()}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {eyebrow ? (
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: 4, color: LOOK.hivis }}>{eyebrow.toUpperCase()}</div>
        ) : null}
        <div
          style={{
            marginTop: 12,
            fontSize: titleSize(title),
            fontWeight: 900,
            lineHeight: 1,
            color: LOOK.foreground,
            maxWidth: 1044,
          }}
        >
          {title.toUpperCase()}
        </div>
        <div style={{ marginTop: 24, fontSize: 32, fontWeight: 700, color: LOOK.mutedForeground }}>{meta}</div>
      </div>
    </div>
  );
}
