import { CATEGORY_LABEL, type Category } from "@app/core";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/** The bin-lid colour for a kind of John, as a CSS variable reference. */
export function lidColor(category: string): string {
  return `var(--bin-${category in CATEGORY_LABEL ? category : "other"})`;
}

/** Style for a card whose top edge is its bin lid. */
export function lidStyle(category: string): CSSProperties {
  return { borderTopColor: lidColor(category) };
}

/** A small square of lid colour with the category's name, for legends and forms. */
export function LidSwatch({ category, className }: { category: Category; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span aria-hidden className="size-3 rounded-sm" style={{ background: lidColor(category) }} />
      {CATEGORY_LABEL[category]}
    </span>
  );
}
