import { FRONT_DOOR_COPY, HOUSE_DRAFT_COPY, NEXT_UP_COPY, PAGE_TITLE, STARTER_LISTS } from "@app/core";
import { expect, test, type Page } from "@playwright/test";

import { CLIENT_URL, cleanUp, signInToClient } from "./auth";

// The Expo app's web build: Describe your house, from Today's setup card to
// the John list. The e2e stack has no ANTHROPIC_API_KEY, so "Draft my Johns"
// gets the starter list that fits, as production does until the key is set.
test.use({ baseURL: CLIENT_URL });

const made: string[] = [];
test.afterAll(async () => cleanUp(made));

async function newHouse(page: Page, name: string) {
  await page.goto("/house/new");
  await page.getByLabel(FRONT_DOOR_COPY.name).fill(name);
  await page.getByTestId("create-house").click();
  await expect(page).toHaveURL(/\/today$/);
}

test("describe the house, keep most of the draft, and find it on the list", async ({ context, page }) => {
  made.push(await signInToClient(context, "Ava Describe"));
  await newHouse(page, `Terrace ${Date.now() % 10_000}`);

  await page.getByTestId("setup-describe").click();
  await expect(page).toHaveURL(/\/house\/describe$/);
  await expect(page.getByRole("heading", { name: PAGE_TITLE.describe })).toBeVisible();

  await page.getByTestId("describe-field").fill("Me, my husband and our two kids in a semi. Bins go out Tuesday night.");
  const answered = page.waitForResponse((r) => r.url().endsWith("/api/setup/draft"));
  await page.getByTestId("describe-draft").click();
  expect((await answered).status()).toBe(200);

  // No key here, so the family starter list stands in, and says so.
  await expect(page.getByText(HOUSE_DRAFT_COPY.offline)).toBeVisible();
  const family = STARTER_LISTS.family;
  await expect(page.getByTestId("draft-john")).toHaveCount(family.length);

  await page.getByRole("checkbox", { name: new RegExp(`^${family[0].name}`) }).click();
  await page.getByTestId("describe-keep").click();

  await expect(page).toHaveURL(/\/house\/johns$/);
  await expect(page.getByTestId("john-def")).toHaveCount(family.length - 1);
  await expect(page.getByText(family[1].name)).toBeVisible();
  await expect(page.getByText(family[0].name, { exact: true })).toHaveCount(0);

  // With Johns on the list, Today's setup card stops offering a draft.
  await page.goto("/today");
  await expect(page.getByTestId("setup-johns")).toContainText(NEXT_UP_COPY.onTheList(family.length - 1));
  await expect(page.getByTestId("setup-describe")).toHaveCount(0);
});

test("start from a list without writing anything", async ({ context, page }) => {
  made.push(await signInToClient(context, "Ben Describe"));
  await newHouse(page, `Flat ${Date.now() % 10_000}`);
  await page.goto("/house/johns");
  await page.getByTestId("describe-house").click();
  await page.getByTestId("starter-flat_share").click();
  await expect(page.getByText(HOUSE_DRAFT_COPY.fromStarter)).toBeVisible();
  await page.getByTestId("describe-keep").click();
  await expect(page).toHaveURL(/\/house\/johns$/);
  await expect(page.getByTestId("john-def")).toHaveCount(STARTER_LISTS.flat_share.length);
});
