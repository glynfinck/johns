import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A housemate's initials on a plate. Google photos are deliberately not
 * shown: initials stay legible at 24px on a crowded board, in both themes.
 */
export function Avatar({
  name,
  me = false,
  className,
}: {
  name: string;
  me?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold tracking-wide",
        me ? "bg-hivis text-on-hivis" : "bg-secondary text-secondary-foreground",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
