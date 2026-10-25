import { addDaysTo, AWAY_COPY, DOW_LABEL, GROUPS_COPY, isoDayOf, JOHN_LIST_COPY, localDate, monthLabel, SECTION_LABEL } from "@app/core";
import { expect, test, type Page } from "@playwright/test";

import { admin, CLIENT_URL, cleanUp, dealtHouseInClient } from "./auth";

// Groups and time away in the Expo app's web build: a John only some of the
// house shares, and a trip booked from the calendar. The rules behind both
// are proved in packages/core and tests/db/groups-away.test.ts; this proves
// the app's screens reach them.
test.use({ baseURL: CLIENT_URL });

const made: string[] = [];
test.afterAll(async () => cleanUp(made));

/** How the calendar names a day to a screen reader: "Monday 26 October". */
const dayName = (date: string) =>
  `${DOW_LABEL[isoDayOf(date)]} ${Number(date.slice(8))} ${monthLabel(date.slice(0, 7)).split(" ")[0]}`;

/** Tap a day in the booking calendar, turning the month on first if it's in the next one. */
async function tapDay(page: Page, date: string) {
  const form = page.getByTestId("away-form");
  const month = monthLabel(date.slice(0, 7));
  if (!(await form.getByText(month).isVisible())) await form.getByRole("button", { name: AWAY_COPY.nextMonth }).click();
  await expect(form.getByText(month)).toBeVisible();
  await form.getByRole("button", { name: dayName(date), exact: true }).click();
}

test("make a group, give it a John, and book time away", async ({ browser }) => {
  const avaContext = await browser.newContext();
  const benContext = await browser.newContext();
  const { userId: ava, houseId, housemateIds } = await dealtHouseInClient(
    avaContext,
    "Ava Away",
    "Flat 70",
    [{ name: "Bins out", category: "bins" }],
    [{ context: benContext, name: "Ben Away" }],
  );
  made.push(ava, ...housemateIds);
  const db = admin();

  const page = await avaContext.newPage();
  await page.goto("/house");
  const house = page.getByTestId("house-screen");
  await expect(house.getByText(GROUPS_COPY.empty)).toBeVisible();

  // A group of the people who share the upstairs bathroom: Ava alone.
  await house.getByTestId("add-group").click();
  const groupForm = page.getByTestId("group-form");
  await groupForm.getByLabel(GROUPS_COPY.name).fill("Upstairs bathroom");
  await groupForm.getByRole("checkbox", { name: "You" }).click();
  await groupForm.getByTestId("save-group").click();
  await expect(groupForm).toBeHidden();
  await expect(house.getByTestId("group")).toContainText("Upstairs bathroom");

  // A John only that group is handed.
  await house.getByTestId("add-john").click();
  const johnForm = page.getByTestId("john-form");
  await johnForm.getByLabel(JOHN_LIST_COPY.name).fill("Bathroom clean");
  await johnForm.getByRole("radio", { name: "Upstairs bathroom" }).click();
  await johnForm.getByTestId("save-john").click();
  await expect(johnForm).toBeHidden();
  await expect(house.getByTestId("john-def").filter({ hasText: "Bathroom clean" })).toContainText("Upstairs bathroom");
  const { data: group } = await db.from("groups").select("id, group_members(user_id)").eq("house_id", houseId).single();
  expect(group!.group_members).toEqual([{ user_id: ava }]);
  const { data: john } = await db.from("johns").select("group_id").eq("house_id", houseId).eq("name", "Bathroom clean").single();
  expect(john!.group_id).toBe(group!.id);

  // Time away, booked ahead from the calendar.
  const today = localDate(new Date(), "Europe/London");
  const from = addDaysTo(today, 2);
  const to = addDaysTo(today, 5);
  await tapDay(page, from);
  await tapDay(page, to);
  const away = page.getByTestId("away-form");
  await expect(away.getByTestId("away-picked")).toContainText("Away");
  await away.getByLabel(AWAY_COPY.note).fill("Lisbon");
  await away.getByTestId("book-away").click();
  const panel = house.getByTestId("away-panel");
  await expect(panel.getByTestId("away-period").filter({ hasText: "Lisbon" })).toContainText("You");
  await expect(panel.getByTestId("my-trip")).toBeVisible();
  const { data: booked } = await db.from("away").select("starts_on, ends_on, note").eq("house_id", houseId);
  expect(booked).toEqual([{ starts_on: from, ends_on: to, note: "Lisbon" }]);

  // Today says so; Ben sees it on House.
  await page.getByRole("tab", { name: SECTION_LABEL.today }).click();
  await expect(page.getByTestId("away-banner")).toContainText("You're away");
  const benPage = await benContext.newPage();
  await benPage.goto("/house");
  await expect(benPage.getByTestId("house-screen").getByTestId("away-period")).toContainText("Ava Away");
  await expect(benPage.getByTestId("house-screen").getByTestId("add-group")).toHaveCount(0);

  // Ava changes her mind.
  await page.getByRole("tab", { name: SECTION_LABEL.house }).click();
  await panel.getByTestId("my-trip").getByRole("button", { name: AWAY_COPY.cancel }).click();
  await expect(panel.getByTestId("my-trip")).toHaveCount(0);
  await expect(panel.getByText(AWAY_COPY.nobody)).toBeVisible();
  expect((await db.from("away").select("id").eq("house_id", houseId)).data).toEqual([]);

  await avaContext.close();
  await benContext.close();
});
