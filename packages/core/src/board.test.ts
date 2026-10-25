import { describe, expect, it } from "vitest";

import {
  buildWeekBoard,
  isOpen,
  rulesOf,
  TODAY_ORDER,
  todayView,
  type AssignmentRow,
  type DisputeRow,
  type WeekRow,
} from "./board";

const HOUR = 3_600_000;
// Wednesday 14 Oct 2026, noon in London (BST).
const now = new Date("2026-10-14T11:00:00Z");
const at = (hours: number) => new Date(now.getTime() + hours * HOUR).toISOString();

const WEEK: WeekRow = {
  id: "w1",
  starts_on: "2026-10-12",
  starts_at: "2026-10-11T23:00:00Z",
  ends_at: "2026-10-18T23:00:00Z",
};
const ME = "me";
const YOU = "you";

function john(id: string, overrides: Partial<AssignmentRow> = {}): AssignmentRow {
  return {
    id,
    user_id: ME,
    name: id,
    category: "kitchen",
    points: 2,
    needs_photo: false,
    due_at: at(48),
    due_moved_from: null,
    group_name: null,
    done_at: null,
    photo_path: null,
    outcome: null,
    excused: false,
    ...overrides,
  };
}

function board(assignments: AssignmentRow[], disputes: DisputeRow[] = [], week: WeekRow | null = WEEK, everDealt = true) {
  return buildWeekBoard({ week, assignments, disputes, memberIds: [ME, YOU], userId: ME, everDealt, disputeHours: 24, now });
}

describe("rulesOf", () => {
  it("reads a house's rules from its row", () => {
    expect(
      rulesOf({
        timezone: "Europe/London",
        currency: "GBP",
        week_starts: 1,
        stake_minor: 2000,
        late_forfeit_minor: 200,
        missed_forfeit_minor: 500,
        dispute_hours: 24,
      }),
    ).toEqual({
      timezone: "Europe/London",
      currency: "GBP",
      weekStarts: 1,
      stakeMinor: 2000,
      lateForfeitMinor: 200,
      missedForfeitMinor: 500,
      disputeHours: 24,
    });
  });
});

describe("buildWeekBoard", () => {
  it("is empty, and says whether anything was ever dealt, when this week wasn't", () => {
    expect(board([], [], null, false)).toMatchObject({ week: null, items: [], notStarted: true });
    expect(board([], [], null, true)).toMatchObject({ week: null, notStarted: false });
    expect(board([], [], null).table.map((r) => r.userId).sort()).toEqual([ME, YOU]);
  });

  it("gives every John its live status, in due order", () => {
    const items = board([
      john("later", { due_at: at(48) }),
      john("soon", { due_at: at(6) }),
      john("late", { due_at: at(-6) }),
      john("ticked", { due_at: at(-2), done_at: at(-3) }),
      john("settled", { outcome: "done", done_at: at(-40), due_at: at(-30) }),
      john("excused", { excused: true, due_at: at(5) }),
    ]).items;
    expect(items.map((i) => i.name)).toEqual(["settled", "late", "ticked", "excused", "soon", "later"]);
    expect(Object.fromEntries(items.map((i) => [i.name, i.status]))).toEqual({
      later: "upcoming",
      soon: "due-soon",
      late: "overdue",
      ticked: "checking",
      settled: "done",
      excused: "excused",
    });
  });

  it("says when a tick stands, only while it can still be disputed", () => {
    const [ticked, settled] = board([
      john("ticked", { done_at: at(-3) }),
      john("settled", { done_at: at(-40), outcome: "done", due_at: at(60) }),
    ]).items;
    expect(ticked.standsAt).toEqual(new Date(now.getTime() + 21 * HOUR));
    expect(settled.standsAt).toBeNull();
  });

  it("counts a dispute's votes and finds mine", () => {
    const disputes: DisputeRow[] = [
      {
        id: "d1",
        assignment_id: "theirs",
        raised_by: ME,
        reason: "Still filthy",
        closes_at: at(20),
        dispute_votes: [
          { user_id: ME, uphold: true },
          { user_id: "third", uphold: false },
        ],
      },
    ];
    const [item] = board([john("theirs", { user_id: YOU, done_at: at(-1) })], disputes).items;
    expect(item.status).toBe("disputed");
    expect(item.dispute).toEqual({
      id: "d1",
      assignmentId: "theirs",
      raisedBy: ME,
      reason: "Still filthy",
      closesAt: new Date(at(20)),
      uphold: 1,
      reject: 1,
      myVote: true,
    });
  });

  it("keeps the dates as dates, and the move made for time away", () => {
    const [item] = board([john("moved", { due_moved_from: at(72), due_at: at(10) })]).items;
    expect(item.dueAt).toEqual(new Date(at(10)));
    expect(item.movedFrom).toEqual(new Date(at(72)));
  });

  it("scores the week for the table", () => {
    const { table } = board([
      john("a", { outcome: "done", done_at: at(-30), due_at: at(-20), points: 3 }),
      john("b", { user_id: YOU, outcome: "missed", due_at: at(-20), points: 5 }),
    ]);
    expect(table.find((r) => r.userId === ME)).toMatchObject({ points: 3, done: 1, rank: 1 });
    expect(table.find((r) => r.userId === YOU)).toMatchObject({ points: 0, missed: 1, rank: 2 });
  });
});

describe("todayView", () => {
  it("puts what needs doing first, and counts what's left", () => {
    const view = todayView(
      board([
        john("done", { outcome: "done", done_at: at(-30), due_at: at(-20) }),
        john("later", { due_at: at(50) }),
        john("overdue", { due_at: at(-2) }),
        john("ticked", { done_at: at(-1) }),
        john("soon", { due_at: at(3) }),
        john("someone else's", { user_id: YOU }),
      ]),
      ME,
    );
    expect(view.mine.map((i) => i.name)).toEqual(["overdue", "soon", "later", "ticked", "done"]);
    expect(view.left).toBe(3);
  });

  it("asks for my vote only on a housemate's disputed John I haven't voted on", () => {
    const dispute = (id: string, assignment: string, votes: DisputeRow["dispute_votes"]): DisputeRow => ({
      id,
      assignment_id: assignment,
      raised_by: "third",
      reason: "No",
      closes_at: at(10),
      dispute_votes: votes,
    });
    const view = todayView(
      board(
        [
          john("theirs", { user_id: YOU, done_at: at(-1) }),
          john("voted", { user_id: YOU, done_at: at(-1) }),
          john("mine", { done_at: at(-1) }),
        ],
        [dispute("d1", "theirs", null), dispute("d2", "voted", [{ user_id: ME, uphold: false }]), dispute("d3", "mine", [])],
      ),
      ME,
    );
    expect(view.toVote.map((i) => i.name)).toEqual(["theirs"]);
  });

  it("is empty for someone with nothing this week", () => {
    expect(todayView(board([]), ME)).toEqual({ mine: [], left: 0, toVote: [] });
  });
});

describe("isOpen and TODAY_ORDER", () => {
  it("counts only what's still to do as open", () => {
    const open = (Object.keys(TODAY_ORDER) as (keyof typeof TODAY_ORDER)[]).filter(isOpen);
    expect(open.sort()).toEqual(["due-soon", "overdue", "upcoming"]);
  });
});
