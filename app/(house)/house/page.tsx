import type { Metadata } from "next";

import { AwayCalendar } from "@/components/house/away-calendar";
import { AwayForm, MyTrips } from "@/components/house/away-form";
import { GroupsList } from "@/components/house/groups-list";
import { InviteCard } from "@/components/house/invite-card";
import { JohnList, type JohnDef } from "@/components/house/john-list";
import { MeCard } from "@/components/house/me-card";
import { MembersList } from "@/components/house/members-list";
import { SettingsForm } from "@/components/house/settings-form";
import { DealButton } from "@/components/house/deal-button";
import { PageHeader } from "@/components/shell/app-shell";
import { SITE_URL, VAPID_PUBLIC_KEY } from "@/lib/config";
import { getAway } from "@/lib/data/away";
import { getGroups } from "@/lib/data/groups";
import { requireHouse } from "@/lib/data/house";
import type { Category, IsoDow } from "@/lib/domain";

export const metadata: Metadata = { title: "House" };

function Panel({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-lg border border-border bg-card p-5">
      <h2 className="eyebrow mb-4">{title}</h2>
      {children}
    </section>
  );
}

export default async function HousePage() {
  const ctx = await requireHouse();
  const { supabase, house, rules } = ctx;
  const [{ data: rows }, groups, away] = await Promise.all([
    supabase
      .from("johns")
      .select("id, name, category, points, every_weeks, due_dow, due_time, needs_photo, group_id")
      .eq("house_id", house.id)
      .is("archived_at", null)
      .order("created_at"),
    getGroups(ctx),
    getAway(ctx),
  ]);
  const people = ctx.members.map((m) => ({ userId: m.userId, name: m.name }));
  const myTrips = away.periods.filter((p) => p.userId === ctx.userId && p.endsOn >= away.today);
  const johns: JohnDef[] = (rows ?? []).map((j) => ({
    id: j.id,
    name: j.name,
    category: j.category as Category,
    points: j.points,
    everyWeeks: j.every_weeks,
    dueDow: j.due_dow as IsoDow,
    dueTime: j.due_time.slice(0, 5),
    needsPhoto: j.needs_photo,
    groupId: j.group_id,
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Settings" title={house.name} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel id="johns" title="The John list">
            <JohnList johns={johns} groups={groups} editable={ctx.isAdmin} />
            {ctx.isAdmin && johns.length > 0 ? (
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-3 text-sm text-muted-foreground">
                  {house.first_dealt_at
                    ? "Re-deal this week to include new Johns or housemates. Only works while nothing this week has been ticked."
                    : "When the list is ready and the house has joined, hand out the first week."}
                </p>
                <DealButton started={Boolean(house.first_dealt_at)} />
              </div>
            ) : null}
          </Panel>
          <Panel id="groups" title="Groups">
            <GroupsList groups={groups} people={people} me={ctx.userId} editable={ctx.isAdmin} />
          </Panel>
          <Panel title="House rules">
            <SettingsForm
              editable={ctx.isAdmin}
              values={{
                name: house.name,
                timezone: rules.timezone,
                currency: rules.currency,
                weekStarts: rules.weekStarts,
                stakeMinor: rules.stakeMinor,
                lateForfeitMinor: rules.lateForfeitMinor,
                missedForfeitMinor: rules.missedForfeitMinor,
                disputeHours: rules.disputeHours,
                awayMakeup: house.away_makeup,
              }}
            />
          </Panel>
        </div>
        <div className="flex flex-col gap-5">
          <InviteCard url={`${SITE_URL}/join/${house.join_code}`} code={house.join_code} houseName={house.name} />
          <Panel id="away" title="Time away">
            <div className="flex flex-col gap-5">
              <AwayCalendar
                periods={away.periods}
                people={people}
                me={ctx.userId}
                today={away.today}
                weekStarts={rules.weekStarts}
              />
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <h3 className="text-sm font-extrabold">Your time away</h3>
                <MyTrips periods={myTrips} today={away.today} />
                <p className="text-sm text-muted-foreground">
                  Book it before the week is handed out and you won&rsquo;t be given Johns due while you&rsquo;re
                  gone. Any you already have become due before you go.
                </p>
                <AwayForm today={away.today} />
              </div>
            </div>
          </Panel>
          <Panel title="Who lives here">
            <MembersList
              members={ctx.members.map((m) => ({ userId: m.userId, name: m.name, role: m.role, streak: m.streak }))}
              me={ctx.userId}
              isAdmin={ctx.isAdmin}
            />
          </Panel>
          <Panel title="You">
            <MeCard name={ctx.me.name} userId={ctx.userId} houseId={house.id} vapidKey={VAPID_PUBLIC_KEY} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
