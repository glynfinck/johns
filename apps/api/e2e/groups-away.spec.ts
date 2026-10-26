import { expect, test } from "@playwright/test";

import { cleanUp, signInAs } from "./auth";
import { gotoSettled } from "./nav";

/**
 * The two ways a house is not one undivided list: a John only some of you
 * share, and a housemate who is away. The rules behind both are proved in
 * packages/core/src/deal.test.ts and tests/db/groups-away.test.ts; this
 * proves the screens reach them.
 */

const users: string[] = [];
test.afterEach(async () => {
  if (process.env.E2E_KEEP) return;
  await cleanUp(users.splice(0));
});

/** A local date some days from now, as a date input wants it. */
function daysFromNow(days: number) {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

test("make a group, give it a John, and book time away", async ({ browser }) => {
  const context = await browser.newContext();
  users.push(await signInAs(context, "Ava"));
  const ava = await context.newPage();

  await ava.goto("/house/new");
  await ava.locator("#new-house-name").fill("Flat 3");
  await ava.getByTestId("create-house").click();
  await expect(ava).toHaveURL(/\/house$/);

  // A group of the people who share the upstairs bathroom.
  await ava.getByTestId("add-group").click();
  await ava.locator("#group-name").fill("Upstairs bathroom");
  await ava.getByRole("dialog").getByRole("checkbox").first().check();
  await ava.getByRole("button", { name: "Make the group" }).click();
  await expect(ava.getByRole("dialog")).toBeHidden();
  await expect(ava.getByTestId("groups")).toContainText("Upstairs bathroom");

  // A John only that group is handed.
  await ava.getByTestId("add-john").click();
  await ava.locator("#john-name").fill("Bathroom clean");
  await ava.locator("#john-group").selectOption({ label: "Upstairs bathroom" });
  await ava.getByRole("button", { name: "Add John" }).click();
  await expect(ava.getByRole("dialog")).toBeHidden();
  await expect(ava.getByTestId("john-list")).toContainText("Upstairs bathroom");

  // Time away, booked ahead; Today says so.
  await ava.locator("#away-from").fill(daysFromNow(2));
  await ava.locator("#away-to").fill(daysFromNow(5));
  await ava.locator("#away-note").fill("Lisbon");
  await ava.getByRole("button", { name: "Book time away" }).click();
  await expect(ava.locator("#away")).toContainText("Lisbon");

  await gotoSettled(ava, "/today");
  await expect(ava.getByTestId("away-banner")).toContainText("You’re away");

  await context.close();
});
