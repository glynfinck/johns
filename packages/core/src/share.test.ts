import { describe, expect, it } from "vitest";

import { SIGN, SIGN_SMALL, signParts, signSvg } from "./mark";
import { escapeHtml, joinCodeIn, joinPreview, pagePreview, shareHtml } from "./share";

describe("a pasted link's card", () => {
  it("names the page, and the front door and anything unknown just Jonz", () => {
    expect(pagePreview("/today").title).toBe("Today · Jonz");
    expect(pagePreview("/house/wall/").title).toBe("The Wall · Jonz");
    expect(pagePreview("/week/record/abc?userId=1").title).toBe("Track record · Jonz");
    expect(pagePreview("/").title).toBe("Jonz");
    expect(pagePreview("/somewhere/else").title).toBe("Jonz");
  });

  it("opens the page it was pasted from, with the brand card", () => {
    expect(pagePreview("/house/pass")).toMatchObject({
      url: "https://jonz.app/house/pass",
      image: "https://jonz.app/og.png",
    });
    expect(pagePreview("/").url).toBe("https://jonz.app");
  });

  it("finds a join link's code, and nothing in any other path", () => {
    expect(joinCodeIn("/join/TRC4QX7M")).toBe("TRC4QX7M");
    expect(joinCodeIn("/join/trc4qx7m/")).toBe("trc4qx7m");
    expect(joinCodeIn("/join")).toBeNull();
    expect(joinCodeIn("/join/A/B")).toBeNull();
    expect(joinCodeIn("/today")).toBeNull();
  });

  it("names a join link's house and how many live there, with a card drawn for it", () => {
    expect(joinPreview("TRC4QX7M", { name: "The Terrace", members: 4 })).toEqual({
      title: "Join The Terrace on Jonz",
      description: "4 housemates. Sign in to join and get your Johns.",
      url: "https://jonz.app/join/TRC4QX7M",
      image: "https://jonz.app/api/og/join/TRC4QX7M",
      imageAlt: "Join The Terrace on Jonz",
    });
    expect(joinPreview("TRC4QX7M", { name: "Flat 3", members: 1 }).description).toMatch(/^1 housemate\./);
  });

  it("can keep the house out of it, and says so when a code opens nothing", () => {
    expect(joinPreview("TRC4QX7M", { name: "The Terrace", members: 4 }, false).title).toBe("You're invited to a house on Jonz");
    expect(joinPreview("TRC4QX7M", null).title).toBe("This invite has expired");
  });

  it("escapes what a house's admin typed", () => {
    expect(escapeHtml(`"><script>alert('x')</script>&`)).toBe("&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;");
    const html = shareHtml(joinPreview("TRC4QX7M", { name: `<b>"Flat"</b>`, members: 2 }));
    expect(html).not.toContain("<b>");
    expect(html).toContain('<meta property="og:title" content="Join &lt;b&gt;&quot;Flat&quot;&lt;/b&gt; on Jonz" />');
    expect(html).toContain('<meta property="og:image" content="https://jonz.app/api/og/join/TRC4QX7M" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });
});

describe("the sign", () => {
  it("centres the J in the frame, at both masters", () => {
    for (const master of [SIGN, SIGN_SMALL]) {
      const { j } = signParts(master);
      const [, dx, dy] = /translate\(([\d.-]+) ([\d.-]+)\)/.exec(j.transform)!.map(Number);
      // The J's ink spans x 168–323 and y 162–385: its middle lands on 256.
      expect(dx + 245.5 * master.j.scale).toBeCloseTo(256, 2);
      expect(dy + 273.5 * master.j.scale).toBeCloseTo(256, 2);
    }
  });

  it("draws the J at its stroke whatever the scale", () => {
    expect(signParts(SIGN).j.stroke * SIGN.j.scale).toBeCloseTo(46, 2);
  });

  it("draws a tile only when asked, and shrinks into the safe zone", () => {
    expect(signSvg({ ink: "#000" })).not.toContain('width="512" height="512"');
    expect(signSvg({ ink: "#000", ground: "#f3aa00", radius: 112 })).toContain('rx="112" fill="#f3aa00"');
    expect(signSvg({ ink: "#000", safe: 0.78 })).toContain("scale(0.78)");
  });
});
