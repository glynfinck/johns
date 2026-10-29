/**
 * The database refuses with short codes (`raise exception 'week_closed'`);
 * people read sentences. One table, so every screen says the same thing.
 */
const MESSAGES: Record<string, string> = {
  sign_in_required: "Sign in first.",
  already_in_house: "You’re already in a house. Leave it first to join another.",
  unknown_code: "That join link doesn’t open a house. Ask a housemate for theirs, or start your own.",
  unknown_timezone: "That time zone isn’t one we recognise.",
  admins_only: "Only the house admins can do that.",
  last_admin: "Make someone else an admin first. A house needs at least one.",
  not_your_john: "That John isn’t yours.",
  already_settled: "That John is already settled.",
  week_closed: "That week has finished.",
  already_done: "That’s already ticked.",
  photo_required: "This John needs a photo with the tick.",
  photo_path: "That photo doesn’t belong to this John.",
  under_dispute: "Someone’s disputing this tick, so it can’t be undone now.",
  own_john: "You can’t vote on your own John.",
  not_disputable: "That tick can’t be disputed any more.",
  already_disputed: "Someone’s already disputing that tick.",
  vote_closed: "Voting on that has closed.",
  no_immunity: "You don’t have an immunity token.",
  no_swap: "You don’t have a swap token.",
  not_swappable: "Only two open Johns from the same week can be swapped.",
  more_than_owed: "That’s more than is owed.",
  bad_payment: "That payment doesn’t add up.",
  no_johns: "Add at least one John first.",
  week_started: "Someone’s already ticked or flagged a John this week, so it can’t be re-dealt.",
  not_in_house: "That isn’t in your house.",
  group_empty: "A group needs at least one housemate in it.",
  not_housemates: "Groups can only hold people who live here.",
  unknown_group: "That group doesn’t exist any more.",
  group_name_taken: "There’s already a group with that name.",
  away_in_past: "Time away can start today at the earliest.",
  away_backwards: "The last day away has to be on or after the first.",
  away_too_long: "Time away can be up to three months at once.",
  away_overlaps: "You’re already away for some of those days.",
  away_over: "That time away has already finished.",
  not_yours: "That isn’t yours to change.",
  not_on_call: "That John isn’t on call, so it can’t be flagged.",
  not_dealt: "This week hasn’t been handed out yet, so nobody is on call.",
  nobody_home: "Everyone who shares that John is away today.",
  tick_it_yourself: "That’s your John. Tick it off instead.",
  too_soon_to_cover: "It’s still theirs to do. You can cover it once the grace period is up.",
  pass_needed: "Changing your list with Jonz comes with the House Pass.",
  draft_limit: "That’s enough for one day. Add the draft as it is and change it on the list, or try again tomorrow.",
  john_covered: "A housemate covered this one. Dispute it if it wasn’t done.",
};

export function humanError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "Something went wrong. Try again.";
  for (const [code, text] of Object.entries(MESSAGES)) {
    if (error.message?.includes(code)) return text;
  }
  if (error.code === "42501") return "You can’t do that.";
  return "Something went wrong. Try again.";
}
