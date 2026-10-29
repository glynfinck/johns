import { SHARE_COPY, SHARE_IMAGE, SHARE_NAMES_HOUSE } from "@app/core";
import { ImageResponse } from "next/og";

import { Card, cardFonts } from "@/lib/share/card";
import { inviteFor } from "@/lib/share/invite";

/**
 * A join link's picture in the chat it was pasted into: the house's name and
 * how many live there (or the generic invite, with SHARE_NAMES_HOUSE off).
 * A code that opens nothing still gets a picture, "This invite has expired",
 * so the chat never shows a broken one. Never the code itself.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [found, fonts] = await Promise.all([inviteFor(code), cardFonts()]);
  const invite = found?.invite ?? null;
  const card = !invite ? (
    <Card title={SHARE_COPY.expiredTitle} meta={SHARE_COPY.expiredLine} />
  ) : SHARE_NAMES_HOUSE ? (
    <Card
      eyebrow={SHARE_COPY.invited}
      title={invite.name}
      meta={`${SHARE_COPY.housemates(invite.members)}  ·  ${SHARE_COPY.joinMeta}`}
    />
  ) : (
    <Card eyebrow={SHARE_COPY.invited} title="Join the house" meta={SHARE_COPY.joinMeta} />
  );
  return new ImageResponse(card, {
    ...SHARE_IMAGE,
    fonts,
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
