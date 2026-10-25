import { addDaysTo, awayOn, dateRange, datesBetween, firstName, type AwayPeriod, type IsoDow } from "@app/core";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const isoDay = (date: string): IsoDow => {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (day === 0 ? 7 : day) as IsoDow;
};

const short = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};

/**
 * Who's away over the next four weeks, one row each, a square a day. The
 * house's weeks are marked so it is plain which deal a trip falls in. The
 * squares are a picture; the list under them says the same in words.
 */
export function AwayCalendar({
  periods,
  people,
  me,
  today,
  weekStarts,
  days = 28,
}: {
  periods: AwayPeriod[];
  people: { userId: string; name: string }[];
  me: string;
  today: string;
  weekStarts: IsoDow;
  days?: number;
}) {
  const dates = datesBetween(today, addDaysTo(today, days - 1));
  const columns = { gridTemplateColumns: `4.75rem repeat(${days}, minmax(0, 1fr))` };
  const upcoming = periods.filter((p) => p.endsOn >= today);

  return (
    <div className="flex flex-col gap-4">
      <div aria-hidden className="flex flex-col gap-1.5">
        <div className="grid items-end gap-[3px] text-[10px] font-bold text-muted-foreground" style={columns}>
          <span />
          {dates.map((d) => (
            <span key={d} className="h-3.5 overflow-visible whitespace-nowrap">
              {isoDay(d) === weekStarts ? short(d) : d === today ? "Today" : ""}
            </span>
          ))}
        </div>
        {people.map((p) => (
          <div key={p.userId} className="grid items-center gap-[3px]" style={columns}>
            <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold">
              <Avatar name={p.name} me={p.userId === me} className="size-5 shrink-0 text-[9px]" />
              <span className="truncate">{p.userId === me ? "You" : firstName(p.name)}</span>
            </span>
            {dates.map((d) => {
              const away = awayOn(periods, p.userId, d);
              return (
                <span
                  key={d}
                  className={cn(
                    "h-4 rounded-[2px]",
                    away ? "bg-foreground" : "bg-secondary",
                    isoDay(d) === weekStarts && "ml-[3px]",
                    d === today && "ring-2 ring-hivis ring-inset",
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody&rsquo;s booked any time away.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm">
          {upcoming.map((p) => (
            <li key={p.id} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-bold">{p.userId === me ? "You" : people.find((x) => x.userId === p.userId)?.name}</span>
              <span className="tabular">{dateRange(p.startsOn, p.endsOn)}</span>
              {p.note ? <span className="text-muted-foreground">{p.note}</span> : null}
              {p.startsOn <= today ? <span className="text-xs font-bold text-muted-foreground uppercase">away now</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
