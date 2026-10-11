import { AppShell } from "@/components/shell/app-shell";
import { requireHouse } from "@/lib/data/house";

export default async function HouseLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireHouse();
  return (
    <AppShell houseId={ctx.house.id} houseName={ctx.house.name} memberCount={ctx.members.length} me={ctx.me}>
      {children}
    </AppShell>
  );
}
