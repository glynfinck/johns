import { JOHN_COPY, PAGE_TITLE } from "@app/core";
import { expect, test, type Page } from "@playwright/test";

import { admin, CLIENT_URL, cleanUp, dealtHouseInClient } from "./auth";
import { photo } from "./photo";

// Today in the Expo app's web build: your Johns this week, ticked, taken
// back, and ticked with a photo receipt from the file chooser.
test.use({ baseURL: CLIENT_URL });

const made: string[] = [];
test.afterAll(async () => cleanUp(made));

function card(page: Page, name: string) {
  return page.getByTestId("john-card").filter({ hasText: name });
}

test("tick a John, take it back, and tick one with a photo", async ({ context, page }) => {
  const { userId, houseId } = await dealtHouseInClient(context, "Fay Client", "Flat 12", [
    { name: "Bins out", category: "bins" },
    { name: "Clean the bath", category: "bathroom", needsPhoto: true },
  ]);
  made.push(userId);

  await page.goto("/");
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("heading", { name: PAGE_TITLE.today })).toBeVisible();
  await expect(page.getByTestId("john-card")).toHaveCount(2);
  await expect(page.getByTestId("johns-left")).toHaveText("2");

  // A tick: it counts at once, while the house can still check it.
  const bins = card(page, "Bins out");
  await bins.getByRole("button", { name: JOHN_COPY.markDone, exact: true }).click();
  await expect(bins.getByText("Done, being checked")).toBeVisible();
  await expect(page.getByTestId("johns-left")).toHaveText("1");

  // Taken back while it's being checked.
  await bins.getByRole("button", { name: JOHN_COPY.undo, exact: true }).click();
  await expect(bins.getByRole("button", { name: JOHN_COPY.markDone, exact: true })).toBeVisible();
  await expect(page.getByTestId("johns-left")).toHaveText("2");

  // A photo John wants the photo first: the browser's file chooser, here.
  const bath = card(page, "Clean the bath");
  await expect(bath.getByRole("button", { name: JOHN_COPY.markDone, exact: true })).toHaveCount(0);
  const chooser = page.waitForEvent("filechooser");
  await bath.getByRole("button", { name: JOHN_COPY.photoAndDone, exact: true }).click();
  await (await chooser).setFiles({ name: "bath.png", mimeType: "image/png", buffer: photo() });
  await expect(bath.getByText("Done, being checked")).toBeVisible();
  await expect(page.getByTestId("johns-left")).toHaveText("1");

  // The receipt is in the private bucket, under the house and the John.
  const { data: ticked } = await admin()
    .from("assignments")
    .select("id, photo_path")
    .eq("house_id", houseId)
    .eq("name", "Clean the bath")
    .single();
  expect(ticked!.photo_path).toMatch(new RegExp(`^${houseId}/${ticked!.id}/[0-9a-f-]+\\.jpg$`));
  const { data: files } = await admin().storage.from("proofs").list(`${houseId}/${ticked!.id}`);
  expect(files).toHaveLength(1);
});
