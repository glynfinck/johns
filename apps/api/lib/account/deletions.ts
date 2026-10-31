import type { AdminClient } from "@/lib/supabase/admin";
import type { PassStripe } from "@/lib/pass/stripe";

/** The bucket profile photos are kept in, each account's under its own id. */
const PHOTOS = "avatars";

/** What one turn of the clock did with accounts being deleted. */
export interface DeletionRun {
  /** House Passes told to stop renewing, for accounts that started the 30 days. */
  stopped: number;
  /** House Passes started again, for accounts kept. */
  resumed: number;
  /** Accounts deleted for good. */
  finished: number;
  /** One line for each account that failed this turn; the next turn tries it again. */
  errors: string[];
}

/**
 * The clock's part in deleting an account
 * (supabase/migrations/*_delete_account.sql), every ten minutes:
 *
 * 1. A House Pass the account pays for stops renewing as the 30 days start,
 *    unless it was stopping already. Which subscription it stopped is kept.
 * 2. If they keep the account, that subscription renews again.
 * 3. On the day (or sooner, when the owner says so), the account goes: a
 *    Pass it's carrying from a house it left stops renewing, the database
 *    takes it out of the house and takes its name away, then its photo
 *    file and its sign-in go, and the audit log says so.
 *
 * Without Stripe the Pass steps wait, and the deletions still happen.
 */
export async function runDeletions(db: AdminClient, stripe: PassStripe | null, now: Date): Promise<DeletionRun> {
  const run: DeletionRun = { stopped: 0, resumed: 0, finished: 0, errors: [] };
  if (stripe) {
    await stopPasses(db, stripe, now, run);
    await resumePasses(db, stripe, now, run);
  }
  await finishDue(db, stripe, now, run);
  return run;
}

async function stopPasses(db: AdminClient, stripe: PassStripe, now: Date, run: DeletionRun) {
  const { data: rows, error } = await db
    .from("account_deletions")
    .select("id, user_id")
    .eq("state", "pending")
    .is("pass_stopped_at", null);
  if (error) throw new Error(`Couldn't read the accounts being deleted: ${error.message}`);
  for (const row of rows ?? []) {
    try {
      let stoppedSub: string | null = null;
      const { data: houses, error: read } = await db
        .from("houses")
        .select("id, house_pass_billing(stripe_subscription)")
        .eq("pass_buyer", row.user_id)
        .in("pass_plan", ["monthly", "yearly"]);
      if (read) throw new Error(read.message);
      for (const house of houses ?? []) {
        const sub = house.house_pass_billing?.stripe_subscription;
        if (!sub) continue;
        const view = await stripe.subscription(sub);
        // Already stopping (they cancelled it themselves) or over: nothing to stop, or to start again later.
        if (view.cancelAtPeriodEnd || !["active", "trialing", "past_due"].includes(view.status)) continue;
        await stripe.stopRenewing(sub);
        stoppedSub = sub;
        run.stopped += 1;
      }
      const { error: written } = await db
        .from("account_deletions")
        .update({ pass_stopped_at: now.toISOString(), pass_subscription: stoppedSub })
        .eq("id", row.id);
      if (written) throw new Error(written.message);
    } catch (e) {
      run.errors.push(`stop pass ${row.id}: ${message(e)}`);
    }
  }
}

async function resumePasses(db: AdminClient, stripe: PassStripe, now: Date, run: DeletionRun) {
  const { data: rows, error } = await db
    .from("account_deletions")
    .select("id, pass_subscription")
    .eq("state", "kept")
    .not("pass_subscription", "is", null)
    .is("pass_resumed_at", null);
  if (error) throw new Error(`Couldn't read the accounts kept: ${error.message}`);
  for (const row of rows ?? []) {
    try {
      const view = await stripe.subscription(row.pass_subscription!);
      // One that has run out by now can't renew again; there's nothing to start.
      if (view.cancelAtPeriodEnd && ["active", "trialing", "past_due"].includes(view.status)) {
        await stripe.resumeRenewing(row.pass_subscription!);
        run.resumed += 1;
      }
      const { error: written } = await db
        .from("account_deletions")
        .update({ pass_resumed_at: now.toISOString() })
        .eq("id", row.id);
      if (written) throw new Error(written.message);
    } catch (e) {
      run.errors.push(`resume pass ${row.id}: ${message(e)}`);
    }
  }
}

async function finishDue(db: AdminClient, stripe: PassStripe | null, now: Date, run: DeletionRun) {
  const { data: rows, error } = await db
    .from("account_deletions")
    .select("id, user_id, requested_by")
    .eq("state", "pending")
    .lte("delete_after", now.toISOString())
    .order("delete_after")
    .limit(50);
  if (error) throw new Error(`Couldn't read the accounts due to go: ${error.message}`);
  for (const row of rows ?? []) {
    try {
      if (stripe) await stopCarriedPass(db, stripe, row.user_id, now);
      const { error: finished } = await db.rpc("finish_account_deletion", { p_user: row.user_id });
      if (finished) throw new Error(finished.message);
      await removePhotos(db, row.user_id);
      // Soft: Supabase scrambles the email and unlinks the sign-in, and the
      // profile the house's history points at stays.
      const { error: gone } = await db.auth.admin.deleteUser(row.user_id, true);
      if (gone && gone.status !== 404) throw new Error(gone.message);
      const { error: done } = await db
        .from("account_deletions")
        .update({ state: "done", ended_at: now.toISOString() })
        .eq("id", row.id);
      if (done) throw new Error(done.message);
      const { error: logged } = await db.from("admin_audit").insert({
        actor: null,
        action: "account.delete_done",
        target_kind: "account",
        target_id: row.user_id,
        after: { state: "done", requested_by: row.requested_by },
      });
      if (logged) throw new Error(logged.message);
      run.finished += 1;
    } catch (e) {
      run.errors.push(`delete ${row.id}: ${message(e)}`);
    }
  }
}

/** A Pass the account carries from a house it left (lib/pass/moves.ts) stops renewing: nobody is left to place it. */
async function stopCarriedPass(db: AdminClient, stripe: PassStripe, userId: string, now: Date) {
  const { data: rows, error } = await db
    .from("moving_pass_billing")
    .select("move_id, stripe_subscription, moved_on!inner(user_id, pass_state, pass_stopped_at)")
    .eq("moved_on.user_id", userId)
    .is("moved_on.pass_stopped_at", null)
    .in("moved_on.pass_state", ["waiting", "left"])
    .not("stripe_subscription", "is", null);
  if (error) throw new Error(error.message);
  for (const row of rows ?? []) {
    await stripe.stopRenewing(row.stripe_subscription!);
    const { error: written } = await db
      .from("moved_on")
      .update({
        pass_stopped_at: now.toISOString(),
        ...(row.moved_on.pass_state === "waiting" ? { pass_state: "lapsed" } : {}),
      })
      .eq("id", row.move_id);
    if (written) throw new Error(written.message);
  }
}

/** Every file in the account's photo folder. */
async function removePhotos(db: AdminClient, userId: string) {
  const bucket = db.storage.from(PHOTOS);
  const { data: files, error } = await bucket.list(userId, { limit: 100 });
  if (error) throw new Error(`photos: ${error.message}`);
  const paths = (files ?? []).map((file) => `${userId}/${file.name}`);
  if (paths.length === 0) return;
  const { error: removed } = await bucket.remove(paths);
  if (removed) throw new Error(`photos: ${removed.message}`);
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
