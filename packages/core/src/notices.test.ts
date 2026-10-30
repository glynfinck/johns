import { describe, expect, it } from "vitest";

import {
  isLive,
  noticeFromRow,
  noticeState,
  noticeToShow,
  pruneClosed,
  safeNoticeLink,
  STATUS_RETURNS_AFTER_MS,
  type Notice,
} from "./notices";

const NOW = new Date("2026-11-02T12:00:00Z");

function notice(over: Partial<Notice>): Notice {
  return {
    id: "n1",
    kind: "news",
    title: "Hello",
    body: "",
    linkLabel: null,
    linkUrl: null,
    startsAt: "2026-11-01T00:00:00Z",
    endsAt: null,
    ...over,
  };
}

describe("when a notice is on", () => {
  it("is on from its start until its end, and open-ended without one", () => {
    expect(isLive(notice({}), NOW)).toBe(true);
    expect(isLive(notice({ startsAt: "2026-11-03T00:00:00Z" }), NOW)).toBe(false);
    expect(isLive(notice({ endsAt: "2026-11-02T12:00:00Z" }), NOW)).toBe(false);
    expect(isLive(notice({ endsAt: "2026-11-02T12:00:01Z" }), NOW)).toBe(true);
  });

  it("says whether it is showing, starts later or has ended", () => {
    expect(noticeState(notice({}), NOW)).toBe("live");
    expect(noticeState(notice({ startsAt: "2026-12-01T00:00:00Z" }), NOW)).toBe("scheduled");
    expect(noticeState(notice({ endsAt: "2026-11-01T06:00:00Z" }), NOW)).toBe("ended");
  });
});

describe("which notice shows", () => {
  const status = notice({ id: "s", kind: "status", startsAt: "2026-11-01T00:00:00Z" });
  const offer = notice({ id: "o", kind: "offer", startsAt: "2026-11-02T00:00:00Z" });
  const news = notice({ id: "n", kind: "news", startsAt: "2026-11-02T06:00:00Z" });

  it("shows one at a time: status before offers before news, whatever is newer", () => {
    expect(noticeToShow([news, offer, status], {}, NOW)?.id).toBe("s");
    expect(noticeToShow([news, offer], {}, NOW)?.id).toBe("o");
  });

  it("shows the newest of the same kind", () => {
    const older = notice({ id: "a", startsAt: "2026-10-30T00:00:00Z" });
    expect(noticeToShow([older, news], {}, NOW)?.id).toBe("n");
  });

  it("shows nothing when nothing is on", () => {
    expect(noticeToShow([notice({ endsAt: "2026-11-01T01:00:00Z" })], {}, NOW)).toBeNull();
    expect(noticeToShow([], {}, NOW)).toBeNull();
  });

  it("keeps an offer or news closed for good once closed, and shows the next one", () => {
    expect(noticeToShow([offer, news], { o: "2026-10-01T00:00:00Z" }, NOW)?.id).toBe("n");
    expect(noticeToShow([news], { n: "2026-11-02T07:00:00Z" }, NOW)).toBeNull();
  });

  it("brings a closed status back a day later while it is still on", () => {
    const justBefore = new Date(NOW.getTime() - STATUS_RETURNS_AFTER_MS + 1).toISOString();
    const aDayAgo = new Date(NOW.getTime() - STATUS_RETURNS_AFTER_MS).toISOString();
    expect(noticeToShow([status], { s: justBefore }, NOW)).toBeNull();
    expect(noticeToShow([status], { s: aDayAgo }, NOW)?.id).toBe("s");
  });
});

describe("the device's record of closed notices", () => {
  it("forgets notices that are no longer sent", () => {
    expect(pruneClosed({ a: "x", b: "y" }, [notice({ id: "b" })])).toEqual({ b: "y" });
  });
});

describe("a notice from the database", () => {
  it("turns a row into a notice, and skips a kind this build doesn't know", () => {
    const row = {
      id: "r",
      kind: "offer",
      title: "Founding pass ends 30 Nov",
      body: "Lock in $49 for life.",
      link_label: "See the Pass",
      link_url: "/house/pass",
      starts_at: "2026-11-01T00:00:00Z",
      ends_at: "2026-11-30T23:59:00Z",
    };
    expect(noticeFromRow(row)).toEqual({
      id: "r",
      kind: "offer",
      title: "Founding pass ends 30 Nov",
      body: "Lock in $49 for life.",
      linkLabel: "See the Pass",
      linkUrl: "/house/pass",
      startsAt: "2026-11-01T00:00:00Z",
      endsAt: "2026-11-30T23:59:00Z",
    });
    expect(noticeFromRow({ ...row, kind: "party" })).toBeNull();
  });
});

describe("a notice's link", () => {
  it("allows a path in the app or https, and nothing else", () => {
    expect(safeNoticeLink("/house/pass")).toBe("/house/pass");
    expect(safeNoticeLink("/")).toBe("/");
    expect(safeNoticeLink("https://status.supabase.com")).toBe("https://status.supabase.com");
    expect(safeNoticeLink("//evil.example")).toBeNull();
    expect(safeNoticeLink("/\\evil.example")).toBeNull();
    expect(safeNoticeLink("http://example.com")).toBeNull();
    expect(safeNoticeLink("javascript:alert(1)")).toBeNull();
    expect(safeNoticeLink(null)).toBeNull();
  });
});
