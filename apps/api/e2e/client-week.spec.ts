import { DISPUTE_COPY, PAGE_TITLE, SECTION_LABEL } from "@app/core";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { admin, CLIENT_URL, cleanUp, dealtHouseInClient } from "./auth";

// The board in the Expo app's web build: two housemates, one ticks, the
// other disputes it, and in a house of two that decides at once. A phone
// shows each person's cards; a laptop shows the house as a table.
test.use({ baseURL: CLIENT_URL });

const made: string[] = [];
test.afterAll(async () => cleanUp(made));

/** Where a John shows on the board: its card on a phone, its row on a laptop. */
function onBoard(page: Page, john: string): Locator {
  return page.locator('[data-testid="john-card"], [data-testid="week-row"]').filter({ hasText: john }).filter({ visible: true });
}

test("dispute a housemate's tick from the board, and the house of two decides at once", async ({ browser }) => {
  const avaContext = await browser.newContext();
  const benContext = await browser.newContext();
  const { userId, houseId, housemateIds } = await dealtHouseInClient(
    avaContext,
    "Ava Board",
    "Flat 21",
    [
      { name: "Bins out", category: "bins" },
      { name: "Wipe the hob", category: "kitchen" },
    ],
    [{ context: benContext, name: "Ben Board" }],
  );
  made.push(userId, ...housemateIds);
  const { data: bens } = await admin().from("assignments").select("name").eq("house_id", houseId).eq("user_id", housemateIds[0]);
  expect(bens).toHaveLength(1);
  const benJohn = bens![0].name;

  // Ben ticks his.
  const ben = await benContext.newPage();
  await ben.goto("/today");
  const mine = ben.getByTestId("john-card").filter({ hasText: benJohn });
  await mine.getByRole("button", { name: "Mark done", exact: true }).click();
  await expect(mine.getByText("Done, being checked")).toBeVisible();

  // Ava goes from Today to the board by its tab, and sees it being checked.
  const ava = await avaContext.newPage();
  await ava.goto("/today");
  await ava.getByRole("tab", { name: SECTION_LABEL.week }).click();
  await expect(ava).toHaveURL(/\/week$/);
  await expect(ava.getByRole("heading", { name: PAGE_TITLE.week })).toBeVisible();
  const theirs = onBoard(ava, benJohn);
  await expect(theirs.getByText("Done, being checked")).toBeVisible();

  // She disputes it. Her vote is already the majority, so it's struck at once.
  await theirs.getByRole("button", { name: DISPUTE_COPY.open }).click();
  await ava.getByLabel(DISPUTE_COPY.label).fill("Still greasy");
  await ava.getByRole("button", { name: DISPUTE_COPY.send }).click();
  await expect(theirs.getByText("Done, being checked")).toHaveCount(0);
  await expect(theirs.getByRole("button", { name: DISPUTE_COPY.open })).toHaveCount(0);

  // Ben's board follows, live: his John is open again.
  await expect(mine.getByRole("button", { name: "Mark done", exact: true })).toBeVisible();
  const { data: struck } = await admin().from("disputes").select("resolution").eq("house_id", houseId);
  expect(struck).toEqual([{ resolution: "upheld" }]);
});
