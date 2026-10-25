import { crc32, deflateSync } from "node:zlib";

import { JOHN_COPY, TODAY_COPY } from "@app/core";
import { expect, test, type Page } from "@playwright/test";

import { admin, CLIENT_URL, cleanUp, dealtHouseInClient } from "./auth";

// Today in the Expo app's web build: your Johns this week, ticked, taken
// back, and ticked with a photo receipt from the file chooser.
test.use({ baseURL: CLIENT_URL });

const made: string[] = [];
test.afterAll(async () => cleanUp(made));

/**
 * A photo to choose: a plain PNG, wider than the app keeps (1600px), so the
 * shrink runs too. Built here, so the test needs no image on disk.
 */
function photo(width = 2000, height = 12): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  // Each row: filter type 0, then a grey pixel after pixel.
  const rows = Buffer.alloc((width * 3 + 1) * height, 0x99);
  for (let y = 0; y < height; y++) rows[y * (width * 3 + 1)] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

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
  await expect(page.getByRole("heading", { name: TODAY_COPY.title })).toBeVisible();
  await expect(page.getByText("Flat 12")).toBeVisible();
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
