import { SHARE_IMAGE, joinSign } from "@app/core";
import { ImageResponse } from "next/og";

import { Card, cardFonts } from "@/lib/share/card";
import { inviteFor } from "@/lib/share/invite";

/**
 * A join link's picture in the chat it was pasted into: the house's own sign,
 * its name beside the J and "Join 4 housemates on Jonz." under it (or the
 * brand's sign, with SHARE_NAMES_HOUSE off). A code that opens nothing still
 * gets a picture, "Invite expired", so the chat never shows a broken one.
 * Never the code itself.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [found, fonts] = await Promise.all([inviteFor(code), cardFonts()]);
  return new ImageResponse(<Card sign={joinSign(found?.invite ?? null)} />, {
    ...SHARE_IMAGE,
    fonts,
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
