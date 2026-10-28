import { DraftRequest, DraftResponse } from "@app/core";

import { requireUser } from "@/lib/auth";
import { draftHouse } from "@/lib/moves/draft";
import { error, json, preflight, refused } from "@/lib/respond";

/**
 * POST /api/setup/draft `{ houseId, description }`: an admin describes the
 * house and gets a draft John list back to review (lib/moves/draft.ts).
 * Nothing is added to the list here.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if ("response" in auth) return auth.response;

  const body = DraftRequest.safeParse(await request.json().catch(() => null));
  if (!body.success) return error(request, 400, body.error.issues[0]?.message ?? "Say something about the house.");

  const result = await draftHouse({ db: auth.supabase, userId: auth.user.id }, body.data.houseId, body.data.description, new Date());
  if ("refusal" in result) return refused(request, result.refusal);
  return json(request, DraftResponse.parse(result));
}

export const OPTIONS = preflight;
