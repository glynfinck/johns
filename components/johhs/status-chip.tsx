import { CheckIcon, ClockIcon, EyeIcon, ShieldIcon, TriangleAlertIcon, XIcon } from "lucide-react";

import { STATUS_LABEL } from "@/lib/format";
import type { LiveStatus } from "@/lib/outcome";
import { cn } from "@/lib/utils";

const STYLE: Record<LiveStatus, string> = {
  upcoming: "text-muted-foreground ring-1 ring-inset ring-border",
  "due-soon": "bg-hivis text-on-hivis",
  overdue: "bg-hazard/15 text-hazard",
  checking: "bg-good/15 text-good",
  disputed: "bg-hazard/15 text-hazard",
  done: "bg-good/15 text-good",
  late: "bg-hazard/15 text-hazard",
  missed: "bg-hazard text-on-hazard",
  excused: "text-muted-foreground ring-1 ring-inset ring-border",
};

const ICON: Partial<Record<LiveStatus, typeof CheckIcon>> = {
  "due-soon": ClockIcon,
  overdue: TriangleAlertIcon,
  checking: CheckIcon,
  disputed: EyeIcon,
  done: CheckIcon,
  late: CheckIcon,
  missed: XIcon,
  excused: ShieldIcon,
};

export function StatusChip({ status, className }: { status: LiveStatus; className?: string }) {
  const Icon = ICON[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] font-extrabold tracking-wide whitespace-nowrap uppercase",
        STYLE[status],
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
      {STATUS_LABEL[status]}
    </span>
  );
}
