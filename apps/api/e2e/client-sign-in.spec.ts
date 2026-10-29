import { FRONT_DOOR, FRONT_DOOR_COPY, NO_HOUSE_COPY, SIGN_IN_COPY } from "@app/core";
import { expect, test } from "@playwright/test";

import { CLIENT_URL, cleanUp, signInToClient } from "./auth";

// The Expo app's web build: the front door, sign-in, and a session that
// survives a reload until you sign out. Google's consent screen can't be
// driven, so the redirect to it is caught and checked instead.
test.use({ baseURL: CLIENT_URL });

const made: string[] = [];
test.afterAll(async () => cleanUp(made));

test("the front door leads to Google sign-in through Supabase", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: FRONT_DOOR.headline })).toBeVisible();
  // Starting a house goes through sign-in, which carries the choice and says it.
  await page.getByRole("link", { name: FRONT_DOOR_COPY.start }).click();
  await expect(page).toHaveURL(/\/signin\?next=%2Fhouse%2Fnew$/);
  await expect(page.getByText(FRONT_DOOR_COPY.startReason)).toBeVisible();

  // The web offers Google and Microsoft; Apple is for the iOS app.
  await expect(page.getByText(SIGN_IN_COPY.sameAccount)).toBeVisible();
  await expect(page.getByRole("button", { name: SIGN_IN_COPY.microsoft })).toBeVisible();
  await page.route(/\/auth\/v1\/authorize/, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<p>Google would be here</p>" }),
  );
  const authorize = page.waitForRequest(/\/auth\/v1\/authorize/);
  await page.getByRole("button", { name: SIGN_IN_COPY.google }).click();
  const url = new URL((await authorize).url());
  expect(url.searchParams.get("provider")).toBe("google");
  // Google comes back to sign-in, still carrying the choice.
  expect(url.searchParams.get("redirect_to")).toBe(`${CLIENT_URL}/signin?next=%2Fhouse%2Fnew`);
  // PKCE: the code comes back to the page, never the tokens.
  expect(url.searchParams.get("code_challenge")).toBeTruthy();
  expect(url.searchParams.get("code_challenge_method")).toBe("s256");
});

test("a failed sign-in says so, without guessing whose", async ({ page }) => {
  await page.goto("/signin?error=access_denied");
  await expect(page.getByRole("alert")).toHaveText(SIGN_IN_COPY.returnFailed);
});

test("signed out, Today sends you to sign in", async ({ page }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("heading", { name: SIGN_IN_COPY.heading })).toBeVisible();
});

test("a session survives a reload, and signing out ends it", async ({ context, page }) => {
  made.push(await signInToClient(context, "Priya Client"));

  // Signed in with no house yet: starting or joining one.
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole("heading", { name: NO_HOUSE_COPY.heading })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole("heading", { name: NO_HOUSE_COPY.heading })).toBeVisible();

  await page.getByRole("button", { name: SIGN_IN_COPY.signOut }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await page.reload();
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("button", { name: SIGN_IN_COPY.google })).toBeVisible();
});
