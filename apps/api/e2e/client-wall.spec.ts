import { REACTION_LABEL, SECTION_LABEL, WALL_COPY } from "@app/core";
import { expect, test, type BrowserContext } from "@playwright/test";

import { admin, CLIENT_URL, cleanUp, dealtHouseInClient } from "./auth";
import { photo } from "./photo";

// The Wall in the Expo app's web build: ticks land on it live, a photo
// receipt shows, and a reaction sticks.
test.use({ baseURL: CLIENT_URL });

const made: string[] = [];
test.afterAll(async () => cleanUp(made));

test("ticks land on the Wall with their photos, and take reactions", async ({ browser }) => {
  const contexts: Record<string, BrowserContext> = { ava: await browser.newContext(), ben: await browser.newContext() };
  const { userId, houseId, housemateIds } = await dealtHouseInClient(
    contexts.ava,
    "Ava Wall",
    "Flat 30",
    [
      { name: "Clean the bath", category: "bathroom", needsPhoto: true },
      { name: "Wipe the hob", category: "kitchen" },
    ],
    [{ context: contexts.ben, name: "Ben Wall" }],
  );
  made.push(userId, ...housemateIds);
  const who = (id: string) => (id === userId ? "ava" : "ben");
  const { data: dealt } = await admin().from("assignments").select("name, user_id, needs_photo").eq("house_id", houseId);
  const bath = dealt!.find((a) => a.needs_photo)!;
  const hob = dealt!.find((a) => !a.needs_photo)!;
  const said = (a: { user_id: string }) => (a.user_id === userId ? "You" : "Ben Wall");

  // Ava watches the Wall. So far it says who moved in.
  const wall = await contexts.ava.newPage();
  await wall.goto("/today");
  await wall.getByRole("tab", { name: SECTION_LABEL.house }).click();
  await wall.getByTestId("house-screen").getByTestId("to-wall").getByRole("link").click();
  await expect(wall).toHaveURL(/\/house\/wall$/);
  await expect(wall.getByRole("heading", { name: WALL_COPY.title })).toBeVisible();
  await expect(wall.getByTestId("wall-event").filter({ hasText: "Ben Wall moved in." })).toBeVisible();

  // Whoever was dealt the hob ticks it; it lands on her Wall without a reload.
  const hobber = await contexts[who(hob.user_id)].newPage();
  await hobber.goto("/today");
  await hobber.getByTestId("john-card").filter({ hasText: hob.name }).getByTestId("mark-done").click();
  const hobTick = wall.getByTestId("wall-event").filter({ hasText: `${said(hob)} did ${hob.name}.` });
  await expect(hobTick).toBeVisible();

  // She reacts; it shows at once and stays after a reload.
  await hobTick.getByRole("button", { name: REACTION_LABEL.nice }).click();
  await expect(hobTick.getByRole("button", { name: REACTION_LABEL.nice })).toHaveText("1");
  // A browser hears that it's hers: pressed, as the web's reactions say.
  await expect(hobTick.getByRole("button", { name: REACTION_LABEL.nice, pressed: true })).toBeVisible();
  await wall.reload();
  await expect(hobTick.getByRole("button", { name: REACTION_LABEL.nice })).toHaveText("1");

  // The bath needs a photo; once ticked, the Wall shows it.
  const bather = await contexts[who(bath.user_id)].newPage();
  await bather.goto("/today");
  const chooser = bather.waitForEvent("filechooser");
  await bather.getByTestId("john-card").filter({ hasText: bath.name }).getByTestId("mark-done").click();
  await (await chooser).setFiles({ name: "receipt.png", mimeType: "image/png", buffer: photo() });
  const bathTick = wall.getByTestId("wall-event").filter({ hasText: `${said(bath)} did ${bath.name}.` });
  await expect(bathTick.getByRole("img", { name: WALL_COPY.photoOf(bath.name) })).toBeVisible();
});
