import { expect, test, type Page } from "@playwright/test";

import { cleanUp, signInAs } from "./auth";

/**
 * A house from nothing, on two phones: set up, add Johns, join by link, deal
 * the week, tick a John, and have the other housemate dispute it. Every step
 * goes through the real UI against the real local stack.
 */

const users: string[] = [];
test.afterEach(async () => {
  // E2E_KEEP=1 leaves a run's house in the database to inspect after a failure.
  if (process.env.E2E_KEEP) return;
  await cleanUp(users.splice(0));
});

async function addJohn(page: Page, name: string) {
  await page.getByTestId("add-john").click();
  await page.locator("#john-name").fill(name);
  await page.getByRole("button", { name: "Add John" }).click();
  // The list refreshes a beat before the sheet finishes closing; a tap in
  // that beat lands on the sheet's backdrop. Wait for what a person waits for.
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByTestId("john-list")).toContainText(name);
}

test("set up a house, deal a week, tick a John, dispute it", async ({ browser }) => {
  const avaContext = await browser.newContext();
  const benContext = await browser.newContext();
  users.push(await signInAs(avaContext, "Ava"), await signInAs(benContext, "Ben"));
  const ava = await avaContext.newPage();
  const ben = await benContext.newPage();

  // Ava sets the house up and is sent to its settings.
  await ava.goto("/");
  await expect(ava).toHaveURL(/\/house\/new$/);
  await ava.locator("#new-house-name").fill("Flat 3");
  await ava.getByTestId("create-house").click();
  await expect(ava).toHaveURL(/\/house$/);

  await addJohn(ava, "Bins");
  await addJohn(ava, "Bathroom");
  const invite = (await ava.getByTestId("invite-url").first().textContent())!.trim();
  expect(invite).toMatch(/\/join\/[A-Z0-9]{8}$/);

  // Ben follows the link and joins. Nothing is dealt yet.
  await ben.goto(new URL(invite).pathname);
  await expect(ben.getByRole("heading", { name: "Flat 3" })).toBeVisible();
  await ben.getByTestId("join-house").click();
  await expect(ben).toHaveURL(/\/today$/);
  await expect(ben.getByText("The rota hasn’t started yet.")).toBeVisible();

  // Ava hands out the first week; two Johns, two people, one each.
  await ava.getByTestId("deal-week").click();
  await expect(ava.getByTestId("deal-week")).toHaveText(/Re-deal this week/);
  await ava.goto("/today");
  await expect(ava.getByTestId("john-card")).toHaveCount(1);
  await expect(ava.getByTestId("johns-left")).toHaveText("1");

  // Live: Ava watches the board while Ben ticks his. Her page follows
  // without a reload, over realtime.
  // A phone shows the board as cards and a laptop as a table; the status
  // reads the same in both, so that is what to watch.
  await ava.goto("/week");
  await expect(ava.getByRole("heading", { name: "The board" })).toBeVisible();
  const checking = ava.getByText("Done, being checked").filter({ visible: true });
  await expect(checking).toHaveCount(0);
  await ben.goto("/today");
  await ben.getByTestId("mark-done").first().click();
  await expect(ben.locator('[data-testid="john-card"][data-status="checking"]')).toHaveCount(1);
  await expect(checking).toHaveCount(1);
  await ava.goto("/today");

  // She ticks hers. It counts, provisionally, while the house can check it.
  await ava.getByTestId("mark-done").first().click();
  await expect(ava.locator('[data-testid="john-card"][data-status="checking"]')).toHaveCount(1);
  await expect(ava.getByTestId("johns-left")).toHaveText("0");

  // Ben sees it on the Wall.
  await ben.goto("/wall");
  await expect(ben.getByTestId("wall-event").first()).toContainText("Ava did");

  // Ben disputes it. In a house of two his vote is the majority, so the tick
  // is struck at once and Ava's John is open again.
  await ben.goto("/week");
  await ben.getByRole("button", { name: "Dispute" }).click();
  await ben.locator("#dispute-reason").fill("The bin's still full");
  await ben.getByRole("button", { name: "Put it to the house" }).click();
  // The sheet closes once the action has landed and the tick has decided it.
  // (Not the button: its label changes to "Sending…" the moment it is pressed.)
  await expect(ben.getByRole("dialog")).toBeHidden();

  await ava.goto("/today");
  await expect(ava.locator('[data-testid="john-card"][data-status="checking"]')).toHaveCount(0);
  await expect(ava.getByTestId("johns-left")).toHaveText("1");
  await ava.goto("/wall");
  await expect(ava.getByTestId("wall-event").first()).toContainText("The house struck your tick");

  await avaContext.close();
  await benContext.close();
});

test("a signed-out visitor sees the front door, not the house", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("who’s on what this week");
  await page.goto("/today");
  await expect(page).toHaveURL(/\/signin$/);
});
