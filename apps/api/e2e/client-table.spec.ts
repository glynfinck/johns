import { SECTION_LABEL, TABLE_COPY } from "@app/core";
import { expect, test } from "@playwright/test";

import { admin, CLIENT_URL, cleanUp, dealtHouseInClient } from "./auth";

// The Table in the Expo app's web build: a tick scores at once, for the
// week and the month, beside everyone's fair share and streak.
test.use({ baseURL: CLIENT_URL });

const made: string[] = [];
test.afterAll(async () => cleanUp(made));

test("a tick scores on the Table at once, beside fair shares and streaks", async ({ browser }) => {
  const avaContext = await browser.newContext();
  const benContext = await browser.newContext();
  const { userId, houseId, housemateIds } = await dealtHouseInClient(
    avaContext,
    "Ava Table",
    "Flat 40",
    [
      { name: "Bins out", category: "bins" },
      { name: "Wipe the hob", category: "kitchen" },
    ],
    [{ context: benContext, name: "Ben Table" }],
  );
  made.push(userId, ...housemateIds);
  const { data: mine } = await admin().from("assignments").select("name, points").eq("house_id", houseId).eq("user_id", userId);

  const ava = await avaContext.newPage();
  await ava.goto("/today");
  await ava.getByTestId("john-card").filter({ hasText: mine![0].name }).getByTestId("mark-done").click();
  await expect(ava.getByText("Done, being checked")).toBeVisible();

  // The Table lives at the foot of House for now.
  await ava.getByRole("tab", { name: SECTION_LABEL.house }).click();
  await expect(ava).toHaveURL(/\/house$/);
  await expect(ava.getByRole("heading", { name: TABLE_COPY.beside })).toBeVisible();
  // Two tables, this week's then this month's, each with everyone on it. This
  // week Ava leads with her John's points (the month's depends on whether it
  // falls due this month).
  // (Tabs keep Today mounted underneath, with its own week Table: look on this screen.)
  const table = ava.getByTestId("house-table");
  const standings = table.getByTestId("standing");
  await expect(standings).toHaveCount(4);
  await expect(standings.first()).toContainText("You");
  await expect(standings.first()).toContainText(`1 done${mine![0].points}`);
  await expect(table.getByTestId("fair-share")).toHaveCount(2);
  await expect(table.getByTestId("streak")).toHaveCount(2);
});
