import { TABLE_COPY, type TableRow } from "@app/core";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * The Table as bars. The leader's bar is full width and everyone else is
 * drawn to the same scale, so the gap between two people is the real gap.
 */
export function Standings({
  rows,
  names,
  me,
  dense = false,
}: {
  rows: TableRow[];
  names: Map<string, string>;
  me: string;
  dense?: boolean;
}) {
  const top = Math.max(1, ...rows.map((r) => r.points));
  const lastRank = rows.length > 1 ? Math.max(...rows.map((r) => r.rank)) : 0;
  return (
    <ol className={cn("flex flex-col", dense ? "gap-2.5" : "gap-3.5")}>
      {rows.map((r) => {
        const bottom = rows.length > 1 && r.rank === lastRank && r.points < top;
        return (
          <li key={r.userId} className="grid grid-cols-[1.25rem_auto_minmax(0,1fr)_2.5rem] items-center gap-2.5">
            <span className="text-xs font-extrabold text-muted-foreground tabular">{r.rank}</span>
            <Avatar name={names.get(r.userId) ?? "?"} me={r.userId === me} className="size-7 text-[10px]" />
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn("truncate text-sm", r.userId === me ? "font-extrabold" : "font-semibold")}>
                  {r.userId === me ? "You" : names.get(r.userId)}
                </span>
                {!dense ? (
                  <span className="shrink-0 text-xs text-muted-foreground tabular">{TABLE_COPY.record(r)}</span>
                ) : null}
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-sm bg-secondary">
                <div
                  className={cn("h-full rounded-sm", bottom ? "bg-hazard" : "bg-hivis")}
                  style={{ width: `${(r.points / top) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-right text-base font-black tabular">{r.points}</span>
          </li>
        );
      })}
    </ol>
  );
}
