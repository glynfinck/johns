import { expect, type Page } from "@playwright/test";

/**
 * Go to a page while the app may still be moving on its own.
 *
 * Right after a server action the app is still refreshing the current route,
 * and the live socket may refresh it again a moment later. WebKit reports
 * that as a navigation, and it interrupts `page.goto` ("Navigation to /today
 * is interrupted by another navigation to /house"). The navigation is not
 * what the test is about, so the goto and the check that it landed retry as
 * one block until the app has settled.
 */
export async function gotoSettled(page: Page, path: string) {
  const landed = new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
  await expect(async () => {
    await page.goto(path);
    await expect(page).toHaveURL(landed, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}
