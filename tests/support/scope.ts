import { adminClient } from "./clients";

/**
 * There is no seed.sql and nothing truncates between runs, so every fixture
 * takes its own rows back out. Scoped deletes only: the Playwright suite runs
 * against this same stack, and a developer's local database is not ours to
 * empty.
 */
const users: string[] = [];
const houses: string[] = [];

export const track = {
  user: (id: string) => {
    users.push(id);
  },
  house: (id: string) => {
    houses.push(id);
  },
};

export async function cleanupScope(): Promise<void> {
  const db = adminClient();
  // A house cascades to everything in it. Deleting the auth user cascades to
  // their profile, which would otherwise be held by assignments and ledger rows.
  if (houses.length > 0) await db.from("houses").delete().in("id", houses);
  if (users.length > 0) {
    await db.from("houses").delete().in("created_by", users);
    for (const id of users) await db.auth.admin.deleteUser(id);
  }
  users.length = 0;
  houses.length = 0;
}
