import { CATEGORY_LABEL, dueLabel, JOHN_COPY, pointsLabel, relative, type Category } from "@app/core";
import { CameraIcon, PlaneIcon } from "lucide-react";

import { DisputeButton, MarkDone, UndoDone, UseImmunity, VoteButtons } from "@/components/johns/john-actions";
import { lidStyle } from "@/components/johns/lid";
import { StatusChip } from "@/components/johns/status-chip";
import { Avatar } from "@/components/ui/avatar";
import type { BoardItem } from "@/lib/data/week";
import { cn } from "@/lib/utils";

const OPEN = new Set(["upcoming", "due-soon", "overdue"]);

/**
 * One John, wearing its bin lid along the top. What you can do with it
 * depends on whose it is and where it has got to, and nothing else.
 */
export function JohnCard({
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
  // "it was due tomorrow 20:00", mid-sentence.
  const was = (at: Date) => dueLabel(at, now, zone).replace(/^(Today|Tomorrow|Yesterday)/, (w) => w.toLowerCase());

  return (
    <article
      data-testid="john-card"
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
              <span>{item.groupName ?? CATEGORY_LABEL[item.category as Category] ?? "John"}</span>
              <span aria-hidden>·</span>
              <span className="tabular">{dueLabel(item.dueAt, now, zone)}</span>
              {item.needsPhoto ? (
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden>·</span>
                  <CameraIcon className="size-3.5" aria-hidden />
                  {JOHN_COPY.photo}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <StatusChip status={item.status} />
            <span className="text-xs font-extrabold tabular">{pointsLabel(item.points)}</span>
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
            <p className="font-bold text-hazard">{JOHN_COPY.disputed(item.dispute.reason)}</p>
            <p className="mt-1 text-muted-foreground tabular">
              {JOHN_COPY.votes(item.dispute.uphold, item.dispute.reject, relative(item.dispute.closesAt, now))}
            </p>
            {!mine ? (
              <div className="mt-3">
                <VoteButtons disputeId={item.dispute.id} myVote={item.dispute.myVote} />
              </div>
            ) : null}
          </div>
        ) : null}

        {open && item.movedFrom ? (
          <p className="flex items-start gap-2 rounded-md bg-secondary p-3 text-sm" data-testid="due-before-you-go">
            <PlaneIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{mine ? JOHN_COPY.dueBeforeYouGo(was(item.movedFrom)) : JOHN_COPY.dueBeforeTheyGo(ownerName, was(item.movedFrom))}</span>
          </p>
        ) : null}

        {mine && open ? (
          <div className="flex flex-col gap-1">
            <MarkDone assignmentId={item.id} houseId={houseId} needsPhoto={item.needsPhoto} />
            <UseImmunity assignmentId={item.id} tokens={immunityTokens} />
          </div>
        ) : null}

        {item.status === "checking" && item.standsAt ? (
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>{JOHN_COPY.standsIn(relative(item.standsAt, now))}</span>
            {mine ? (
              <UndoDone assignmentId={item.id} />
            ) : (
              <DisputeButton assignmentId={item.id} john={item.name} owner={ownerName} />
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}
