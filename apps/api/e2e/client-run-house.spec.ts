import {
  DEAL_COPY,
  FOCUS_SHELL_COPY,
  JOHN_LIST_COPY,
  JOIN_COPY,
  ME_COPY,
  MEMBERS_COPY,
  NEW_HOUSE_COPY,
  NO_HOUSE_COPY,
  NOT_DEALT_COPY,
  PAGE_TITLE,
  RULES_COPY,
  SECTION_LABEL,
  SIGN_IN_COPY,
} from "@app/core";
import { expect, test, type Page } from "@playwright/test";

import { admin, CLIENT_URL, cleanUp, signInToClient } from "./auth";

// A house from nothing, in the Expo app's web build alone: start it, write
// the John list, let a housemate in, hand out the week, change the rules
// and the roles, rename yourself, and leave. Every step goes through the
// real UI against the real local stack, and the database is read back.
test.use({ baseURL: CLIENT_URL });

const made: string[] = [];
test.afterAll(async () => cleanUp(made));

async function addJohn(page: Page, name: string, points: number) {
  const list = page.getByTestId("johns-screen");
  await list.getByTestId("add-john").click();
  const form = page.getByTestId("john-form");
  await form.getByLabel(JOHN_LIST_COPY.name).fill(name);
  await form.getByRole("radio", { name: String(points), exact: true }).click();
  await form.getByTestId("save-john").click();
  await expect(form).toBeHidden();
  await expect(list.getByTestId("john-def").filter({ hasText: name })).toBeVisible();
}

test("run a house from nothing on the phone", async ({ browser }) => {
  const avaContext = await browser.newContext();
  const benContext = await browser.newContext();
  const ava = await signInToClient(avaContext, "Ava Runner");
  const ben = await signInToClient(benContext, "Ben Runner");
  made.push(ava, ben);
  const db = admin();
  const name = `Flat ${Date.now() % 10_000}`;

  // Ava starts the house; Today sends her to House, and House to the John list, to set it up.
  const page = await avaContext.newPage();
  await page.goto("/welcome");
  await page.getByRole("link", { name: NO_HOUSE_COPY.start }).click();
  await page.getByLabel(NEW_HOUSE_COPY.name).fill(name);
  await page.getByTestId("create-house").click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByText(NOT_DEALT_COPY.notYet)).toBeVisible();
  await page.getByRole("link", { name: DEAL_COPY.openHouse }).click();
  await expect(page).toHaveURL(/\/house$/);
  await page.getByTestId("house-screen").getByRole("link", { name: PAGE_TITLE.johnList }).click();
  await expect(page).toHaveURL(/\/house\/johns$/);
  const list = page.getByTestId("johns-screen");
  await expect(list.getByText(JOHN_LIST_COPY.empty)).toBeVisible();

  // The John list: two Johns, then one edited.
  await addJohn(page, "Bins", 2);
  await addJohn(page, "Bathroom", 4);
  await list.getByRole("button", { name: JOHN_LIST_COPY.edit("Bins") }).click();
  await page.getByTestId("john-form").getByRole("radio", { name: "Thursday" }).click();
  await page.getByTestId("john-form").getByTestId("save-john").click();
  await expect(list.getByTestId("john-def").filter({ hasText: "Bins" })).toContainText("due Thu 21:00");
  const { data: houseRow } = await db.from("houses").select("id, join_code").eq("name", name).single();
  const { data: johns } = await db.from("johns").select("name, points, due_dow").eq("house_id", houseRow!.id).order("name");
  expect(johns).toEqual([
    { name: "Bathroom", points: 4, due_dow: 7 },
    { name: "Bins", points: 2, due_dow: 4 },
  ]);

  // Ben joins by the link House shows. Nothing is dealt yet.
  await page.goto("/house");
  const house = page.getByTestId("house-screen");
  const invite = (await house.getByTestId("invite-url").textContent())!.trim();
  expect(invite).toMatch(new RegExp(`/join/${houseRow!.join_code}$`));
  const benPage = await benContext.newPage();
  await benPage.goto(new URL(invite).pathname);
  await benPage.getByRole("button", { name: JOIN_COPY.join(name) }).click();
  await expect(benPage).toHaveURL(/\/today$/);
  await expect(benPage.getByText(NOT_DEALT_COPY.waitingFor("Ava Runner"))).toBeVisible();

  // Ava hands out the week: two Johns, two people, one each.
  await page.reload();
  await expect(house.getByTestId("member")).toHaveCount(2);
  await page.goto("/house/johns");
  await list.getByTestId("deal-week").click();
  await expect(list.getByTestId("deal-week")).toHaveText(new RegExp(DEAL_COPY.again));
  await page.getByRole("tab", { name: SECTION_LABEL.today }).click();
  await expect(page.getByTestId("john-card")).toHaveCount(1);
  await benPage.reload();
  await expect(benPage.getByTestId("john-card")).toHaveCount(1);

  // The house rules: a bigger stake, and no disputes.
  await page.goto("/house/rules");
  const rulesPage = page.getByTestId("rules-screen");
  await rulesPage.getByTestId("house-stake").fill("25");
  await rulesPage.getByRole("radio", { name: RULES_COPY.disputeHours(0) }).click();
  await rulesPage.getByTestId("save-rules").click();
  await expect(rulesPage.getByText(RULES_COPY.saved)).toBeVisible();
  const { data: rules } = await db.from("houses").select("stake_minor, dispute_hours").eq("id", houseRow!.id).single();
  expect(rules).toEqual({ stake_minor: 2500, dispute_hours: 0 });

  // Ben reads the rules but can't change them, nor the list.
  await benPage.goto("/house/rules");
  const benRules = benPage.getByTestId("rules-screen");
  await expect(benRules.getByText(RULES_COPY.adminsOnly)).toBeVisible();
  await expect(benRules.getByTestId("house-stake")).toHaveValue("25");
  await expect(benRules.getByTestId("house-stake")).not.toBeEditable();
  await benPage.goto("/house/johns");
  await expect(benPage.getByTestId("johns-screen").getByTestId("john-def")).toHaveCount(2);
  await expect(benPage.getByTestId("johns-screen").getByTestId("add-john")).toHaveCount(0);

  // Ava makes Ben an admin too, from his page, and renames herself on House.
  await page.goto("/house");
  await house.getByTestId("member").filter({ hasText: "Ben Runner" }).click();
  await expect(page).toHaveURL(new RegExp(`/house/people/${ben}$`));
  const person = page.getByTestId("person-screen");
  await person.getByRole("button", { name: MEMBERS_COPY.makeAdmin }).click();
  await expect(person.getByTestId("member")).toContainText(MEMBERS_COPY.admin);
  await person.getByRole("button", { name: FOCUS_SHELL_COPY.back }).click();
  await expect(page).toHaveURL(/\/house$/);
  await house.getByTestId("my-name").fill("Ava R");
  await house.getByTestId("save-name").click();
  await expect(house.getByText(ME_COPY.saved)).toBeVisible();
  await expect(house.getByTestId("member").first()).toContainText("Ava R");
  const { data: roles } = await db.from("members").select("user_id, role").eq("house_id", houseRow!.id);
  expect(roles).toContainEqual({ user_id: ben, role: "admin" });
  const { data: profile } = await db.from("profiles").select("display_name").eq("id", ava).single();
  expect(profile!.display_name).toBe("Ava R");

  // Ben leaves, and is back at starting or joining one.
  await benPage.goto("/house");
  const benHouse = benPage.getByTestId("house-screen");
  await benHouse.getByRole("button", { name: ME_COPY.leave, exact: true }).click();
  await benHouse.getByTestId("leave-house").click();
  await expect(benPage).toHaveURL(/\/welcome$/);
  const { data: left } = await db.from("members").select("user_id").eq("house_id", houseRow!.id);
  expect(left).toEqual([{ user_id: ava }]);

  // Ava signs out from House.
  await house.getByTestId("sign-out").click();
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("button", { name: SIGN_IN_COPY.google })).toBeVisible();

  await avaContext.close();
  await benContext.close();
});
