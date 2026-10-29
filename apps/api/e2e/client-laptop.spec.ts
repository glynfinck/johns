import { HOUSE_LOWER_COPY, JOHN_LIST_COPY, PAGE_TITLE, SECTION_LABEL } from "@app/core";
import { expect, test, type Page } from "@playwright/test";

import { admin, CLIENT_URL, cleanUp, dealtHouseInClient } from "./auth";

// Today, Week and House on a laptop: Today and Week spread into two columns
// beside the rail, House lists its pages beside them with a panel for a
// John, and a window too narrow for them keeps the phone's way.
// SHOTS=<folder> also saves each page, in daylight and after dark.
test.use({ baseURL: CLIENT_URL });

const made: string[] = [];
test.afterAll(async () => cleanUp(made));

async function shoot(page: Page, name: string) {
  const folder = process.env.SHOTS;
  if (!folder) return;
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.screenshot({ path: `${folder}/${name}-${colorScheme}.png` });
  }
  await page.emulateMedia({ colorScheme: "light" });
}

test("each place spreads out on a laptop, and a narrow window keeps the phone's way", async ({ browser }, info) => {
  test.skip(info.project.name !== "laptop-chrome", "The laptop's layout");
  const contexts = await Promise.all([0, 1, 2, 3].map(() => browser.newContext({ viewport: { width: 1440, height: 900 } })));
  const { userId, houseId, housemateIds } = await dealtHouseInClient(
    contexts[0],
    "Glyn Laptop",
    "Glyn's house",
    [
      { name: "Bins and recycling out", category: "bins" },
      { name: "Kitchen deep clean", category: "kitchen" },
      { name: "Hoover the stairs", category: "floors" },
      { name: "Bathroom clean", category: "bathroom" },
      { name: "Mop the floors", category: "floors" },
      { name: "Big shop", category: "errands" },
      { name: "Wipe the hob", category: "kitchen" },
      { name: "Clean the windows", category: "other" },
    ],
    [
      { context: contexts[1], name: "Sam Laptop" },
      { context: contexts[2], name: "Priya Laptop" },
      { context: contexts[3], name: "Tom Laptop" },
    ],
  );
  made.push(userId, ...housemateIds);
  // Two of the housemates' Johns done, so the week has some of each.
  const { data: theirs } = await admin().from("assignments").select("id").eq("house_id", houseId).neq("user_id", userId).limit(2);
  for (const row of theirs ?? []) {
    await admin().from("assignments").update({ done_at: new Date().toISOString() }).eq("id", row.id);
  }

  const page = await contexts[0].newPage();
  await page.goto("/today");
  const today = page.getByTestId("today-screen");
  await expect(today.getByTestId("column-main").getByTestId("next-up")).toBeVisible();
  await expect(today.getByTestId("column-side").getByTestId("week-glance")).toBeVisible();
  await shoot(page, "today");

  await page.getByRole("tab", { name: SECTION_LABEL.week }).click();
  await expect(page.getByRole("heading", { name: PAGE_TITLE.week })).toBeVisible();
  const week = page.getByTestId("week-screen");
  await expect(week.getByTestId("column-main").getByTestId("week-table")).toBeVisible();
  await expect(week.getByTestId("column-side").getByTestId("house-table")).toBeVisible();
  await shoot(page, "week");

  await page.getByRole("tab", { name: SECTION_LABEL.house }).click();
  const house = page.getByTestId("house-screen");
  await expect(house.getByTestId("month-card")).toBeVisible();
  await shoot(page, "house");

  // House lists its pages beside them: the John list, and a John in the panel beside it.
  const nav = page.getByTestId("house-nav");
  await nav.getByRole("link", { name: HOUSE_LOWER_COPY.johns }).click();
  await expect(page.getByRole("heading", { name: PAGE_TITLE.johnList })).toBeVisible();
  await page.getByRole("button", { name: /^Edit Bathroom clean, / }).click();
  const panel = page.getByTestId("john-panel");
  await expect(panel.getByRole("heading", { name: JOHN_LIST_COPY.edit("Bathroom clean") })).toBeVisible();
  await shoot(page, "johns");
  await page.getByRole("button", { name: /^Edit Big shop, / }).click();
  await expect(panel.getByRole("heading", { name: JOHN_LIST_COPY.edit("Big shop") })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await nav.getByRole("link", { name: HOUSE_LOWER_COPY.overview }).click();
  await expect(house.getByTestId("month-card")).toBeVisible();

  // A screen wide enough for the list beside the chat with Jonz still has one panel down the right: a John closes the chat.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await house.getByTestId("ask-jonz").click();
  await expect(page.getByTestId("ask-panel")).toBeVisible();
  await nav.getByRole("link", { name: HOUSE_LOWER_COPY.johns }).click();
  await page.getByRole("button", { name: /^Edit Big shop, / }).click();
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("ask-panel")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await nav.getByRole("link", { name: HOUSE_LOWER_COPY.overview }).click();

  // The narrowest laptop leaves too little room beside the rail: one column, as on a phone.
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect(page.getByTestId("house-nav")).toHaveCount(0);
  await expect(house.getByTestId("columns")).toHaveCount(0);
  await expect(house.getByTestId("setup-section")).toBeVisible();
});
