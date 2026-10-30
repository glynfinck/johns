/**
 * The budget sheet's words: what each budget does to a house's own list,
 * from running that list forward through the deal (steadyRun) for half a
 * year, and which one fits. Pure, so the sheet and the tests agree.
 *
 * Suggested is the smallest budget at which every John still comes round
 * within three times its own schedule (a weekly John at least every three
 * weeks): small enough that nobody faces a pile, big enough that nothing
 * fades away. A list too long for even Busy says so, and how much it asks.
 */
import type { JohnDef } from "./board";
import { weeklyEffort } from "./board";
import { STEADY_COPY } from "./copy";
import type { DealMode } from "./domain";
import type { RunHouse, RunJohn } from "./steady-run";
import { periodOf, steadyRun } from "./steady-run";

/** Weeks run forward, and the first few left out while a fresh list settles. */
const RUN_WEEKS = 26;
const SETTLE_WEEKS = 4;
/** A John may come round at most this many times less often than its schedule on the suggested budget. */
const MOST_SLIP = 3;

export type BudgetJohn = Pick<
  JohnDef,
  "id" | "points" | "everyWeeks" | "everyMonths" | "weekOfMonth" | "dueDow" | "when" | "perWeek" | "crew" | "groupId"
> & { keepDay?: boolean };

/** How often each John came round in the run, in weeks between turns (Infinity: never). */
export function comesRound(
  johns: readonly BudgetJohn[],
  people: readonly string[],
  groups: Readonly<Record<string, readonly string[]>>,
  mode: DealMode,
  budget: number,
): { gaps: Map<string, number>; each: number } {
  const house: RunHouse = {
    id: "list",
    name: "list",
    people: people.map((id) => ({ id, name: id })),
    johns: johns.map((j): RunJohn => {
      const group = j.groupId ? groups[j.groupId]?.filter((id) => people.includes(id)) : undefined;
      return {
        name: j.id,
        pts: j.when === "on_call" ? j.points * j.perWeek : j.points,
        day: j.dueDow,
        sched: j.everyMonths ? { months: j.everyMonths, nth: j.weekOfMonth ?? 1 } : { every: j.everyWeeks },
        ...(j.when === "on_call" ? { onCall: true } : {}),
        ...(j.keepDay && j.when !== "on_call" ? { fixed: true } : {}),
        ...(j.when !== "on_call" && j.crew !== 1 ? { crew: j.crew } : {}),
        ...(group?.length ? { group } : {}),
      };
    }),
  };
  const run = steadyRun(house, { mode, budget, weeks: RUN_WEEKS });
  const counted = run.weeks.filter((w) => w.w > SETTLE_WEEKS);
  const turns = new Map<string, number>();
  let items = 0;
  for (const w of counted) {
    for (const got of Object.values(w.got)) {
      items += got.filter((i) => !i.onCall).length;
      for (const id of new Set(got.map((i) => i.name))) turns.set(id, (turns.get(id) ?? 0) + 1);
    }
  }
  // A John done together is one turn, however many hands.
  for (const j of house.johns) {
    if (j.crew === undefined) continue;
    const weeks = counted.filter((w) => Object.values(w.got).some((g) => g.some((i) => i.name === j.name))).length;
    turns.set(j.name, weeks);
  }
  const gaps = new Map(house.johns.map((j) => [j.name, turns.get(j.name) ? counted.length / turns.get(j.name)! : Infinity]));
  return { gaps, each: people.length ? items / counted.length / people.length : 0 };
}

export interface BudgetChoice {
  budget: number;
  label: string;
  /** What it does to this list, in a sentence or two. */
  effect: string;
  suggested: boolean;
}

/** Each budget, what it does to the list, and the one that fits. */
export function budgetChoices(
  johns: readonly BudgetJohn[],
  people: readonly string[],
  groups: Readonly<Record<string, readonly string[]>>,
  mode: DealMode,
): { choices: BudgetChoice[]; need: number; tooLong: boolean } {
  const need = people.length ? weeklyEffort(johns, people.length) / people.length : 0;
  const day = johns.filter((j) => j.when !== "on_call");
  const slipOf = (gaps: Map<string, number>) =>
    day.map((j) => ({ j, slip: gaps.get(j.id)! / periodOf(j.everyMonths ? { months: j.everyMonths, nth: 1 } : { every: j.everyWeeks }) }));

  const runs = [2, 4, 6].map((budget) => {
    const { gaps, each } = comesRound(johns, people, groups, mode, budget);
    return { budget, gaps, each, slips: slipOf(gaps) };
  });
  const fits = runs.find((r) => r.slips.every((s) => s.slip <= MOST_SLIP));
  const suggested = fits?.budget ?? 6;

  const choices: BudgetChoice[] = runs.map((r) => ({
    budget: r.budget,
    label: STEADY_COPY.budgetName(r.budget),
    effect: `${STEADY_COPY.johnsEach(r.each)} ${often(r.slips, r.gaps)}`,
    suggested: r.budget === suggested,
  }));
  choices.push({ budget: 0, label: STEADY_COPY.budgetName(0), effect: STEADY_COPY.noLimit, suggested: false });
  return { choices, need, tooLong: !fits };
}

/** How often the list's Johns come round on a budget, in words. */
function often(slips: readonly { j: BudgetJohn; slip: number }[], gaps: Map<string, number>): string {
  if (slips.every((s) => s.slip <= 1.15)) return slips.every((s) => s.j.everyWeeks === 1 && !s.j.everyMonths) ? STEADY_COPY.everyWeek : STEADY_COPY.onTime;
  const weekly = slips.filter((s) => s.j.everyWeeks === 1 && !s.j.everyMonths);
  if (!weekly.length) return STEADY_COPY.someWait;
  const onTime = weekly.filter((s) => s.slip <= 1.15).length;
  if (onTime / weekly.length >= 0.75) return STEADY_COPY.mostWeekly;
  const weeks = weekly.map((s) => gaps.get(s.j.id)!);
  const lo = Math.max(1, Math.round(Math.min(...weeks)));
  const hi = Math.max(lo, Math.min(26, Math.round(Math.max(...weeks))));
  return STEADY_COPY.weeklyEvery(lo, hi, weekly.length === slips.length);
}
