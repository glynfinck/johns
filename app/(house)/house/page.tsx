import type { Metadata } from "next";

import { InviteCard } from "@/components/house/invite-card";
import { JohhList, type JohhDef } from "@/components/house/johh-list";
import { MeCard } from "@/components/house/me-card";
import { MembersList } from "@/components/house/members-list";
import { SettingsForm } from "@/components/house/settings-form";
import { DealButton } from "@/components/house/start-rota";
import { PageHeader } from "@/components/shell/app-shell";
import { SITE_URL, VAPID_PUBLIC_KEY } from "@/lib/config";
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
  const { data: rows } = await supabase
    .from("johhs")
    .select("id, name, category, points, every_weeks, due_dow, due_time, needs_photo")
    .eq("house_id", house.id)
    .is("archived_at", null)
    .order("created_at");
  const johhs: JohhDef[] = (rows ?? []).map((j) => ({
    id: j.id,
    name: j.name,
    category: j.category as Category,
    points: j.points,
    everyWeeks: j.every_weeks,
    dueDow: j.due_dow as IsoDow,
    dueTime: j.due_time.slice(0, 5),
    needsPhoto: j.needs_photo,
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Settings" title={house.name} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel id="johhs" title="The Johh list">
            <JohhList johhs={johhs} editable={ctx.isAdmin} />
            {ctx.isAdmin && johhs.length > 0 ? (
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-3 text-sm text-muted-foreground">
                  {house.rota_started_at
                    ? "Re-deal this week to include new Johhs or housemates. Only works while nothing this week has been ticked."
                    : "When the list is ready and the house has joined, hand out the first week."}
                </p>
                <DealButton started={Boolean(house.rota_started_at)} />
              </div>
            ) : null}
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
              }}
            />
          </Panel>
        </div>
        <div className="flex flex-col gap-5">
          <InviteCard url={`${SITE_URL}/join/${house.join_code}`} code={house.join_code} houseName={house.name} />
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
