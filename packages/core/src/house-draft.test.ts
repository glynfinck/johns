import { describe, expect, it } from "vitest";

import {
  DRAFT_MAX_GROUPS,
  DRAFT_MAX_JOHNS,
  DraftRequest,
  DraftedJohn,
  HouseDraft,
  STARTER_KINDS,
  STARTER_LISTS,
  draftPlan,
  guessStarter,
  matchPerson,
  starterDraft,
  tidyDraft,
} from "./house-draft";
import { JohnDraft } from "./schemas";

const ME = "00000000-0000-4000-8000-000000000001";
const SAM = "00000000-0000-4000-8000-000000000002";
const SAM_B = "00000000-0000-4000-8000-000000000003";
const people = [
  { userId: ME, name: "Glyn Finck" },
  { userId: SAM, name: "Sam Okafor" },
];

describe("DraftRequest", () => {
  it("asks for a sentence or so, and not an essay", () => {
    const houseId = ME;
    expect(DraftRequest.safeParse({ houseId, description: "  flat  " }).success).toBe(false);
    expect(DraftRequest.safeParse({ houseId, description: "Three of us in a flat" }).success).toBe(true);
    expect(DraftRequest.safeParse({ houseId, description: "x".repeat(801) }).success).toBe(false);
  });
});

describe("matchPerson", () => {
  it("finds a housemate by full or first name, any case", () => {
    expect(matchPerson("sam", people)).toBe(SAM);
    expect(matchPerson("Sam Okafor", people)).toBe(SAM);
    expect(matchPerson("GLYN", people)).toBe(ME);
  });

  it("finds nobody for a name nobody goes by, or one two people share", () => {
    expect(matchPerson("Priya", people)).toBeNull();
    expect(matchPerson("", people)).toBeNull();
    expect(matchPerson("Sam", [...people, { userId: SAM_B, name: "Sam Lee" }])).toBeNull();
  });
});

describe("tidyDraft", () => {
  it("puts numbers in range and fills what's missing", () => {
    const draft = tidyDraft(
      {
        johns: [
          { name: "  Oven   clean ", category: "kitchen", points: 14, everyWeeks: 0, dueDow: 9, dueTime: "7:30", why: "nobody does it" },
          { name: "Plants", category: "garden", points: "2.6", dueTime: "25:00" },
        ],
      },
      people,
      ME,
    );
    expect(draft.johns[0]).toMatchObject({ name: "Oven clean", points: 10, everyWeeks: 1, dueDow: 7, dueTime: "07:30", why: "nobody does it" });
    expect(draft.johns[1]).toMatchObject({ name: "Plants", category: "other", points: 3, everyWeeks: 1, dueTime: "21:00", when: "day", group: null });
    for (const j of draft.johns) expect(DraftedJohn.safeParse(j).success).toBe(true);
  });

  it("makes an on-call John only when asked, with its window in range", () => {
    const [bin] = tidyDraft({ johns: [{ name: "Kitchen bin", category: "bins", points: 1, onCall: true, respondHours: 200, perWeek: 0 }] }, people, ME).johns;
    expect(bin).toMatchObject({ when: "on_call", respondHours: 72, perWeek: 1 });
  });

  it("keeps the same John once, and drops nameless ones", () => {
    const draft = tidyDraft({ johns: [{ name: "Bins" }, { name: "bins" }, { name: "   " }, { name: 7 }] }, people, ME);
    expect(draft.johns.map((j) => j.name)).toEqual(["Bins"]);
  });

  it("matches a group's people to the house, with me for I, and waits for the rest", () => {
    const draft = tidyDraft(
      {
        groups: [{ name: "Upstairs", members: ["me", "sam", "Priya", "priya"] }],
        johns: [{ name: "Upstairs bathroom", category: "bathroom", group: "upstairs" }],
      },
      people,
      ME,
    );
    expect(draft.groups).toEqual([{ name: "Upstairs", memberIds: [ME, SAM], waitingFor: ["Priya"] }]);
    expect(draft.johns[0].group).toBe("Upstairs");
  });

  it("drops a John's group when no such group was drafted, and a group no John uses", () => {
    const draft = tidyDraft(
      { groups: [{ name: "Downstairs", members: ["Sam"] }, { name: "Nobody", members: [] }], johns: [{ name: "Hall", group: "Attic" }] },
      people,
      ME,
    );
    expect(draft.johns[0].group).toBeNull();
    expect(draft.groups).toEqual([]);
  });

  it("caps a long draft", () => {
    const draft = tidyDraft(
      {
        johns: Array.from({ length: 50 }, (_, i) => ({ name: `John ${i}`, group: `G${i % 10}` })),
        groups: Array.from({ length: 10 }, (_, i) => ({ name: `G${i}`, members: ["Sam"] })),
      },
      people,
      ME,
    );
    expect(draft.johns).toHaveLength(DRAFT_MAX_JOHNS);
    expect(draft.groups.length).toBeLessThanOrEqual(DRAFT_MAX_GROUPS);
  });

  it("copes with nothing at all", () => {
    expect(tidyDraft({}, [], ME)).toEqual({ johns: [], groups: [], note: null });
    expect(tidyDraft({ note: "  I put the bins on Tuesday.  " }, [], ME).note).toBe("I put the bins on Tuesday.");
  });

  it("always gives a draft the API can send", () => {
    const draft = tidyDraft({ johns: [{ name: "x".repeat(90), why: "y".repeat(300) }], groups: [{ name: "g".repeat(60), members: ["Sam"] }] }, people, ME);
    expect(HouseDraft.safeParse(draft).success).toBe(true);
    expect(draft.johns[0].name).toHaveLength(60);
  });
});

describe("draftPlan", () => {
  const draft = tidyDraft(
    {
      groups: [
        { name: "Upstairs", members: ["me", "Sam"] },
        { name: "Downstairs", members: ["Priya", "Tom"] },
        { name: "Garden", members: ["Sam"] },
      ],
      johns: [
        { name: "Upstairs bathroom", category: "bathroom", group: "Upstairs" },
        { name: "Downstairs bathroom", category: "bathroom", group: "Downstairs" },
        { name: "Mow", category: "other", group: "Garden" },
        { name: "Kitchen", category: "kitchen" },
      ],
    },
    people,
    ME,
  );

  it("makes the groups the kept Johns need, and leaves the rest", () => {
    const plan = draftPlan(draft, [0, 1, 3], []);
    expect(plan.makeGroups).toEqual([{ name: "Upstairs", members: [ME, SAM] }]);
    expect(plan.johns.map((j) => [j.john.name, j.groupName])).toEqual([
      ["Upstairs bathroom", "Upstairs"],
      ["Downstairs bathroom", null],
      ["Kitchen", null],
    ]);
    expect(plan.everyoneForNow).toEqual(["Downstairs bathroom"]);
  });

  it("uses a group the house already has", () => {
    const plan = draftPlan(draft, [2], [{ name: "garden" }]);
    expect(plan.makeGroups).toEqual([]);
    expect(plan.johns[0].groupName).toBe("garden");
  });

  it("writes Johns the John list takes", () => {
    for (const { john } of draftPlan(draft, [0, 1, 2, 3], []).johns) {
      expect(JohnDraft.safeParse({ ...john, groupId: null }).success).toBe(true);
      expect(john).not.toHaveProperty("why");
    }
  });

  it("keeps nothing when nothing is picked", () => {
    expect(draftPlan(draft, [], [])).toEqual({ makeGroups: [], johns: [], everyoneForNow: [] });
  });
});

describe("starter lists", () => {
  it.each(STARTER_KINDS)("%s is a valid draft of Johns the list takes", (kind) => {
    const draft = starterDraft(kind);
    expect(HouseDraft.safeParse(draft).success).toBe(true);
    expect(draft.johns.length).toBeGreaterThan(4);
    for (const j of draft.johns) expect(JohnDraft.safeParse({ ...j, groupId: null }).success).toBe(true);
  });

  it("hands out copies, so ticking a draft never changes the list", () => {
    starterDraft("couple").johns[0].name = "changed";
    expect(STARTER_LISTS.couple[0].name).not.toBe("changed");
  });
});

describe("guessStarter", () => {
  it.each([
    ["Me, my wife and our two kids in a semi", "family"],
    ["Just me and my boyfriend in a one-bed", "couple"],
    ["Two of us in a flat", "couple"],
    ["Five students, one kitchen", "flat_share"],
    ["", "flat_share"],
  ] as const)("%s → %s", (description, kind) => {
    expect(guessStarter(description)).toBe(kind);
  });
});
