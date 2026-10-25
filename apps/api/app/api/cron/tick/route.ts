import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { tickAll } from "@/lib/engine/tick";
import { pushNotifier } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The clock's endpoint. pg_cron calls it every ten minutes through pg_net
 * (supabase/migrations/*_tick_schedule.sql) with the shared secret; Vercel
 * Cron can call it too, with the same header. It is the only caller that
 * sends pushes.
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function tick(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const db = createAdminClient();
  const results = await tickAll(db, new Date(), pushNotifier(db));
  const failed = results.filter((r) => r.error);
  return NextResponse.json(
    { houses: results.length, failed: failed.length, errors: failed.slice(0, 5) },
    { status: failed.length ? 500 : 200 },
  );
}

export const POST = tick;
export const GET = tick;
