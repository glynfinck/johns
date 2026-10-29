import { describe, expect, it } from "vitest";

import { DEFAULT_PREFS, inQuietHours, NotificationPrefsDraft, prefsOf, pushFor, reminderFor, type NotificationPrefs } from "./notify";

const LONDON = "Europe/London";
const quiet = (from: number, until: number, timezone: string | null = null): NotificationPrefs => ({
  ...DEFAULT_PREFS,
  quietFrom: from,
  quietUntil: until,
  timezone,
});

describe("prefsOf", () => {
  it("is everything on, never quiet, with no row", () => {
    expect(prefsOf(null)).toEqual(DEFAULT_PREFS);
  });

  it("reads a row", () => {
    expect(
      prefsOf({ reminders: false, checks: true, flags: true, deal: false, quiet_from: 22, quiet_until: 7, timezone: LONDON }),
    ).toEqual({ reminders: false, checks: true, flags: true, deal: false, quietFrom: 22, quietUntil: 7, timezone: LONDON });
  });
});

describe("inQuietHours", () => {
  it("is never quiet without hours", () => {
    expect(inQuietHours(DEFAULT_PREFS, new Date("2026-10-28T03:00:00Z"), LONDON)).toBe(false);
  });

  it("runs past midnight when it starts later than it ends", () => {
    const p = quiet(22, 7);
    expect(inQuietHours(p, new Date("2026-10-28T21:59:00Z"), LONDON)).toBe(false);
    expect(inQuietHours(p, new Date("2026-10-28T22:00:00Z"), LONDON)).toBe(true);
    expect(inQuietHours(p, new Date("2026-10-29T03:00:00Z"), LONDON)).toBe(true);
    expect(inQuietHours(p, new Date("2026-10-29T06:59:00Z"), LONDON)).toBe(true);
    expect(inQuietHours(p, new Date("2026-10-29T07:00:00Z"), LONDON)).toBe(false);
  });

  it("runs within a day when it starts earlier", () => {
    const p = quiet(9, 17);
    expect(inQuietHours(p, new Date("2026-10-28T12:00:00Z"), LONDON)).toBe(true);
    expect(inQuietHours(p, new Date("2026-10-28T17:00:00Z"), LONDON)).toBe(false);
  });

  it("reads the hours in the zone they were saved in, not the house's", () => {
    // 02:00 in London is 22:00 the night before in Toronto.
    const now = new Date("2026-10-28T02:00:00Z");
    expect(inQuietHours(quiet(23, 7), now, LONDON)).toBe(true);
    expect(inQuietHours(quiet(23, 7, "America/Toronto"), now, LONDON)).toBe(false);
  });

  it("follows the clocks changing", () => {
    // British Summer Time: 06:30Z is 07:30 local, so quiet hours are over.
    expect(inQuietHours(quiet(22, 7), new Date("2026-07-01T06:30:00Z"), LONDON)).toBe(false);
    expect(inQuietHours(quiet(22, 7), new Date("2026-12-01T06:30:00Z"), LONDON)).toBe(true);
  });
});

describe("pushFor and reminderFor", () => {
  const night = new Date("2026-10-28T23:30:00Z");
  const day = new Date("2026-10-28T12:00:00Z");

  it("skips a kind that's off", () => {
    expect(pushFor({ ...DEFAULT_PREFS, checks: false }, "checks", day, LONDON)).toBe("skip");
    expect(pushFor({ ...DEFAULT_PREFS, checks: false }, "flags", day, LONDON)).toBe("send");
    expect(reminderFor({ ...DEFAULT_PREFS, reminders: false }, day, LONDON)).toBe("skip");
  });

  it("sends a happening quietly in quiet hours, and holds a reminder", () => {
    expect(pushFor(quiet(22, 7), "checks", night, LONDON)).toBe("quiet");
    expect(pushFor(quiet(22, 7), "checks", day, LONDON)).toBe("send");
    expect(reminderFor(quiet(22, 7), night, LONDON)).toBe("wait");
    expect(reminderFor(quiet(22, 7), day, LONDON)).toBe("send");
  });
});

describe("NotificationPrefsDraft", () => {
  const base = { reminders: true, checks: true, flags: true, deal: true, timezone: LONDON };

  it("takes both quiet hours or neither", () => {
    expect(NotificationPrefsDraft.safeParse({ ...base, quietFrom: 22, quietUntil: 7 }).success).toBe(true);
    expect(NotificationPrefsDraft.safeParse({ ...base, quietFrom: null, quietUntil: null }).success).toBe(true);
    expect(NotificationPrefsDraft.safeParse({ ...base, quietFrom: 22, quietUntil: null }).success).toBe(false);
  });

  it("refuses hours that start and end together, or aren't hours", () => {
    expect(NotificationPrefsDraft.safeParse({ ...base, quietFrom: 7, quietUntil: 7 }).success).toBe(false);
    expect(NotificationPrefsDraft.safeParse({ ...base, quietFrom: 24, quietUntil: 7 }).success).toBe(false);
  });
});
