import { monthOf, SECTION_LABEL, STAKE_COPY } from "@app/core";
import { expect, test } from "@playwright/test";

import { admin, CLIENT_URL, cleanUp, dealtHouseInClient } from "./auth";

// The Stake in the Expo app's web build: what a closed month left owing,
// and the person paid marking it received.
test.use({ baseURL: CLIENT_URL });

const made: string[] = [];
test.afterAll(async () => cleanUp(made));

/** The month before this one, as `yyyy-MM`. */
function lastMonth(): string {
  const [y, m] = monthOf(new Date(), "Europe/London").split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

test("a closed month's debt is settled once the person paid marks it received", async ({ browser }) => {
  const avaContext = await browser.newContext();
  const benContext = await browser.newContext();
  const { userId: ava, houseId, housemateIds } = await dealtHouseInClient(
    avaContext,
    "Ava Stake",
    "Flat 50",
    [{ name: "Bins out", category: "bins" }],
    [{ context: benContext, name: "Ben Stake" }],
  );
  const ben = housemateIds[0];
  made.push(ava, ben);

  // Last month Ben forfeited £4 and it went to Ava; the month is closed.
  const month = lastMonth();
  const db = admin();
  const { error } = await db.from("ledger").insert([
    { house_id: houseId, user_id: ben, kind: "forfeit", amount_minor: -400, month },
    { house_id: houseId, user_id: ava, kind: "share", amount_minor: 400, month },
  ]);
  expect(error).toBeNull();
  expect((await db.from("month_closes").insert({ house_id: houseId, month })).error).toBeNull();

  // Ben sees what he owes, with nothing to mark.
  const benPage = await benContext.newPage();
  await benPage.goto("/stake");
  const owed = benPage.getByTestId("stake-screen").getByTestId("transfer");
  await expect(owed).toContainText("You");
  await expect(owed).toContainText("Ava Stake");
  await expect(owed).toContainText("£4");
  await expect(owed.getByRole("button", { name: STAKE_COPY.markReceived })).toHaveCount(0);

  // Ava, paid, marks it received; the house is square.
  const avaPage = await avaContext.newPage();
  await avaPage.goto("/today");
  await avaPage.getByRole("tab", { name: SECTION_LABEL.stake }).click();
  await expect(avaPage).toHaveURL(/\/stake$/);
  const stake = avaPage.getByTestId("stake-screen");
  await stake.getByTestId("transfer").getByRole("button", { name: STAKE_COPY.markReceived }).click();
  await expect(stake.getByText(STAKE_COPY.square)).toBeVisible();
  await expect(stake.getByTestId("ledger-entry").filter({ hasText: "Payment" })).toHaveCount(2);
});
