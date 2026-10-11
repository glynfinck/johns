import { cn } from "@/lib/utils";

/**
 * The mark: the name boxed like a road sign, in whatever ink surrounds it.
 * Text rather than artwork, so it is sharp at every size and both themes.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span aria-label="Johhs" className={cn("road-sign inline-block text-2xl", className)}>
      Johhs
    </span>
  );
}
