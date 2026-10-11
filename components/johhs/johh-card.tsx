import { CameraIcon } from "lucide-react";

import { DisputeButton, MarkDone, UndoDone, UseImmunity, VoteButtons } from "@/components/johhs/johh-actions";
import { lidStyle } from "@/components/johhs/lid";
import { StatusChip } from "@/components/johhs/status-chip";
import { Avatar } from "@/components/ui/avatar";
import type { BoardItem } from "@/lib/data/week";
import { CATEGORY_LABEL, type Category } from "@/lib/domain";
import { dueLabel, relative } from "@/lib/format";
import { cn } from "@/lib/utils";

const OPEN = new Set(["upcoming", "due-soon", "overdue"]);

/**
 * One Johh, wearing its bin lid along the top. What you can do with it
 * depends on whose it is and where it has got to, and nothing else.
 */
export function JohhCard({
  item,
  ownerName,
  mine,
  houseId,
  zone,
  now,
  immunityTokens = 0,
  showOwner = false,
}: {
  item: BoardItem;
  ownerName: string;
  mine: boolean;
  houseId: string;
  zone: string;
  now: Date;
  immunityTokens?: number;
  showOwner?: boolean;
}) {
  const open = OPEN.has(item.status);
  const finished = item.status === "done" || item.status === "late" || item.status === "checking";
  const alarming = item.status === "overdue" || item.status === "missed";

  return (
    <article
      data-testid="johh-card"
      data-status={item.status}
      className="relative overflow-hidden rounded-lg border border-border border-t-[6px] bg-card"
      style={lidStyle(item.category)}
    >
      {alarming ? <span aria-hidden className="hazard-tape absolute inset-y-0 left-0 w-2" /> : null}
      <div className={cn("flex flex-col gap-3 p-4", alarming && "pl-5")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              className={cn(
                "text-[17px] leading-tight font-extrabold",
                finished && "text-muted-foreground line-through decoration-2",
              )}
            >
              {item.name}
            </h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
              <span>{CATEGORY_LABEL[item.category as Category] ?? "Johh"}</span>
              <span aria-hidden>·</span>
              <span className="tabular">{dueLabel(item.dueAt, now, zone)}</span>
              {item.needsPhoto ? (
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden>·</span>
                  <CameraIcon className="size-3.5" aria-hidden />
                  photo
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <StatusChip status={item.status} />
            <span className="text-xs font-extrabold tabular">{item.points} pts</span>
          </div>
        </div>

        {showOwner ? (
          <div className="flex items-center gap-2 text-sm font-bold">
            <Avatar name={ownerName} me={mine} className="size-6 text-[10px]" />
            {mine ? "You" : ownerName}
          </div>
        ) : null}

        {item.dispute ? (
          <div className="rounded-md bg-hazard/10 p-3 text-sm">
            <p className="font-bold text-hazard">Disputed: &ldquo;{item.dispute.reason}&rdquo;</p>
            <p className="mt-1 text-muted-foreground tabular">
              {item.dispute.uphold} say not done, {item.dispute.reject} say fine · closes{" "}
              {relative(item.dispute.closesAt, now)}
            </p>
            {!mine ? (
              <div className="mt-3">
                <VoteButtons disputeId={item.dispute.id} myVote={item.dispute.myVote} />
              </div>
            ) : null}
          </div>
        ) : null}

        {mine && open ? (
          <div className="flex flex-col gap-1">
            <MarkDone assignmentId={item.id} houseId={houseId} needsPhoto={item.needsPhoto} />
            <UseImmunity assignmentId={item.id} tokens={immunityTokens} />
          </div>
        ) : null}

        {item.status === "checking" && item.standsAt ? (
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>Stands {relative(item.standsAt, now)} unless someone disputes it.</span>
            {mine ? (
              <UndoDone assignmentId={item.id} />
            ) : (
              <DisputeButton assignmentId={item.id} johh={item.name} owner={ownerName} />
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}
