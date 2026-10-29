import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";

import { BIN_NIGHT, PLATE, SHARE_IMAGE, SHIELD, signLegendSize, signSvg, signWidth, type ShareSign } from "@app/core";

/**
 * A join link's card, drawn by `next/og` (Satori) at 1200×630, the way
 * scripts/brand.mjs draws every other card: a sign posted on the pavement.
 * The amber plate carries the J like a route shield and the house's name in
 * Overpass Black caps; the plate under it says who's in. Never on black: an
 * amber plate with black words on black reads as another brand's logo. Satori lays
 * out with flexbox only and can't read the app's theme, so the colours come
 * from Bin Night directly, and every element with more than one child says
 * `display: flex`.
 */

const INK = BIN_NIGHT.light.foreground;
const AMBER = BIN_NIGHT.light.hivis;
const PAVEMENT = BIN_NIGHT.light.background;
const CARD = BIN_NIGHT.light.card;

/** Overpass, vendored beside the API (next.config.ts keeps it in the bundle). */
export async function cardFonts() {
  const read = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));
  const [bold, black] = await Promise.all([read("Overpass_700Bold.ttf"), read("Overpass_900Black.ttf")]);
  return [
    { name: "Overpass", data: bold, weight: 700 as const, style: "normal" as const },
    { name: "Overpass", data: black, weight: 900 as const, style: "normal" as const },
  ];
}

const SHIELD_IMAGE = `data:image/svg+xml;base64,${Buffer.from(signSvg({ ink: INK, safe: SHIELD })).toString("base64")}`;

/** One plate: its ground, then the ink border inset from its edge, holding `children`. */
function Plate({ ground, height, children }: { ground: string; height: number; children: ReactNode }) {
  return (
    <div style={{ display: "flex", height, padding: PLATE.inset, borderRadius: PLATE.radius, backgroundColor: ground }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          padding: "0 44px",
          border: `${PLATE.stroke}px solid ${INK}`,
          borderRadius: PLATE.radius - PLATE.inset,
          color: INK,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function Card({ sign }: { sign: ShareSign }) {
  return (
    <div
      style={{
        width: SHARE_IMAGE.width,
        height: SHARE_IMAGE.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: PAVEMENT,
        fontFamily: "Overpass",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: signWidth(sign.legend, sign.plate) }}>
        <Plate ground={AMBER} height={300}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SHIELD_IMAGE} width={168} height={168} alt="" style={{ flexShrink: 0 }} />
          <div
            style={{
              marginLeft: 40,
              paddingTop: 10,
              fontSize: signLegendSize(sign.legend),
              fontWeight: 900,
              lineHeight: 0.98,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            {sign.legend}
          </div>
        </Plate>
        <div style={{ display: "flex", height: PLATE.gap }} />
        <Plate ground={CARD} height={116}>
          <div style={{ paddingTop: 4, fontSize: 44, fontWeight: 700 }}>{sign.plate}</div>
        </Plate>
      </div>
    </div>
  );
}
