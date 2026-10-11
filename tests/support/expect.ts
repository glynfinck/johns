import { expect } from "vitest";

interface Response {
  error: { code?: string; message: string } | null;
}

/** Refused for who you are: a grant, an RLS check on insert, or a function's 42501. */
export function expectDenied(res: Response) {
  expect(res.error, "expected the call to be refused").not.toBeNull();
  expect(res.error!.code).toBe("42501");
}

/** Refused by a rule, named in the error message (raise exception 'week_closed'). */
export function expectRule(res: Response, rule: string) {
  expect(res.error, `expected ${rule}`).not.toBeNull();
  expect(res.error!.message).toContain(rule);
}

export function expectOk(res: Response) {
  expect(res.error?.message ?? null).toBeNull();
}
