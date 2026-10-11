import { afterEach } from "vitest";

import { cleanupScope } from "@/tests/support/scope";

// Every test takes its own rows back out, including a failing one, which is
// exactly when leftovers would poison the next test and the e2e run after it.
afterEach(async () => {
  await cleanupScope();
});
