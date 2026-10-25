import { BALANCE_WEEKS } from "./deal";
import { IMMUNITY_EVERY } from "./streak";

/**
 * The words both apps say before anyone signs in: the name, the tagline and
 * the front door. One copy, so the web and the phone can't tell the house
 * different things.
 */
export const APP_NAME = "Johns";
export const TAGLINE = "Fair shares of the housework, and a house that keeps score.";

export const FRONT_DOOR = {
  eyebrow: "For houses that share a bin",
  headline: "Johns: who’s on what this week.",
  signIn: "Sign in",
  start: "Start your house",
  join: "I have a join link",
  points: [
    {
      key: "deal",
      title: "Fair shares, dealt for you",
      body: "Every John has an effort score. Each week the app shares them out so the effort evens up over the month, and the bathroom moves around.",
    },
    {
      key: "stake",
      title: "The Stake",
      body: "Everyone stakes the same each month. Miss a John and part of yours goes to the people who didn't.",
    },
    {
      key: "wall",
      title: "The Wall and the Table",
      body: "Ticks, photos, disputes and streaks in one feed, and a points table with perks for the top.",
    },
  ],
} as const;

export type FrontDoorPoint = (typeof FRONT_DOOR.points)[number]["key"];

export type SignInProvider = "Google" | "Apple";

/**
 * The sign-in screen's words. The reason line under the heading comes from
 * `signInReason` (auth-paths.ts) where only Google is offered; iOS also
 * offers Apple, so it says `eitherAccount` instead, and warns that a second
 * account starts with no house (Hide My Email makes a new person).
 */
export const SIGN_IN_COPY = {
  heading: "Sign in",
  google: "Continue with Google",
  googleBusy: "Opening Google…",
  eitherAccount: "Your house's Johns are kept with the account you sign in with.",
  sameAccount: "Already in a house? Use the account you joined with.",
  terms: "By signing in you agree to the house rules your housemates set.",
  privacy: "Privacy",
  failed: (provider: SignInProvider) => `${provider} didn’t finish signing you in. Try again.`,
  signOut: "Sign out",
} as const;

/** Setting up a house: the web's /house/new and the app's. */
export const NEW_HOUSE_COPY = {
  heading: "Set up your house",
  intro: "You’ll be its admin. Next you add the Johns and send the house a join link.",
  name: "What do you call the house?",
  namePlaceholder: "Flat 3",
  currency: "Currency",
  weekStarts: "The week starts on",
  timezone: "Time zone",
  timezoneFromPhone: "This phone’s. Change it later from the House screen.",
  submit: "Set up the house",
  busy: "Setting up…",
  joinInstead: "Joining a housemate’s house instead? Open the join link they sent you.",
} as const;

/** A join link: the web's /join/[code] and the app's. */
export const JOIN_COPY = {
  badLink: "That link doesn’t work",
  badLinkBody: "Ask whoever sent it for a fresh one from their House screen.",
  alreadyIn: (house: string) => `You’re already in ${house}`,
  goToJohns: "Go to your Johns",
  otherHouse: "You’re in another house",
  otherHouseBody: "Johns keeps you in one house at a time. Leave your current one from its House screen first.",
  yourHouse: "Your house",
  invited: "You’re invited",
  livesHere: (people: number) =>
    `${people} ${people === 1 ? "person lives" : "people live"} here. Join and you’re dealt Johns from next week.`,
  join: (house: string) => `Join ${house}`,
  joining: "Joining…",
  back: "Back",
} as const;

/** Signed in with no house: the app's way to start one or join by code. */
export const NO_HOUSE_COPY = {
  heading: "No house yet",
  body: "Start one and you’ll be its admin, or join a housemate’s with the code from their link.",
  start: "Start a house",
  code: "Join code",
  codeHint: "Eight letters and numbers, from the end of the link.",
  badCode: "A join code is eight letters and numbers.",
  join: "Join with this code",
} as const;

/** Today: the week's header and the count of what's left. */
export const TODAY_COPY = {
  title: "Your Johns",
  thisWeek: "This week",
  thisWeekRange: (range: string) => `This week · ${range}`,
  left: (count: number) => (count === 1 ? "John left this week" : "Johns left this week"),
  streak: (weeks: number) => `${weeks} ${weeks === 1 ? "week" : "weeks"}`,
  immunity: (tokens: number) => `${tokens} immunity`,
  swapReady: "swap ready",
  nothingYours: "Nothing on your list this week. Enjoy it while it lasts.",
  toVote: "The house wants your vote",
  yours: "Yours",
} as const;

/** One John, and what its owner can do with it. */
export const JOHN_COPY = {
  photo: "photo",
  markDone: "Mark done",
  /** The laptop board's one small tick. */
  done: "Done",
  ticking: "Ticking…",
  withPhoto: "Mark done with a photo",
  photoAndDone: "Photo and done",
  choosePhoto: "Choose a photo",
  uploading: "Uploading…",
  photoFailed: "That photo didn't upload. Try again.",
  undo: "Undo",
  useImmunity: "Use immunity",
  spendIt: "Spend it",
  keepIt: "Keep it",
  standsIn: (when: string) => `Stands ${when} unless someone disputes it.`,
  disputed: (reason: string) => `Disputed: “${reason}”`,
  votes: (uphold: number, reject: number, closes: string) => `${uphold} say not done, ${reject} say fine · closes ${closes}`,
  dueBeforeYouGo: (was: string) => `Due before you go: it was due ${was}, while you're away.`,
  dueBeforeTheyGo: (owner: string, was: string) => `Due before ${owner} goes: it was due ${was}, while they're away.`,
} as const;

/** Before there is anything to do this week. */
export const NOT_DEALT_COPY = {
  nothingThisWeek: "Nothing’s been handed out this week.",
  nothingThisWeekBody: "Every John on the list is on a fortnightly or longer cycle, or the list is empty.",
  notYet: "No Johns handed out yet.",
  adminSteps: [
    "Add the house’s Johns, with how much effort each one is.",
    "Send the join link to everyone who lives there.",
    "Hand out the first week. Johns are shared so the effort evens out.",
  ],
  waitingFor: (admin: string) => `${admin} will hand out the first week once the John list is ready.`,
} as const;

/** The join link, ready for the group chat. */
export const INVITE_COPY = {
  heading: "Invite the house",
  body: "Send this link to the group chat. Anyone with it can join after signing in.",
  code: "Code",
  share: "Share",
  copy: "Copy",
  copied: "Link copied",
  shareTitle: (house: string) => `Join ${house} on Johns`,
} as const;

/** The week's board: everyone's Johns, and where each has got to. */
export const WEEK_COPY = {
  title: "The board",
  done: "Done",
  checking: "Being checked",
  overdue: "Overdue",
  disputed: "Disputed",
  doneOf: (done: number, total: number) => `${done} of ${total}`,
  you: "You",
  everyJohn: "Every John this week",
  columns: { john: "John", who: "Who", due: "Due", points: "Pts", status: "Status" },
  disputes: "Disputes",
  /** A dispute in the laptop's side column, after whose it is ("Ben's", "Your"). */
  disputeOn: (john: string, reason: string) => `${john}: “${reason}”`,
  tally: (uphold: number, reject: number, closes: string) => `${uphold} not done · ${reject} fine · closes ${closes}`,
} as const;

/** Housemate check: disputing a tick, and voting on one. */
export const DISPUTE_COPY = {
  open: "Dispute",
  title: (john: string) => `Was ${john} really done?`,
  body: (owner: string) => `${owner}’s tick goes to a house vote. If the house agrees with you, the John opens again.`,
  label: "What’s wrong with it",
  placeholder: "The hob's still greasy",
  send: "Put it to the house",
  sending: "Sending…",
  fine: "It’s fine",
  notDone: "Not done",
} as const;

/** A swap token: one of your open Johns for a housemate's. */
export const SWAP_COPY = {
  open: "Use your swap",
  title: "Swap a John",
  body: "You topped the table, so you pick. They get yours, you get theirs.",
  give: "Give away",
  take: "Take instead",
  swap: "Swap them",
  swapping: "Swapping…",
} as const;

/** A house's screens, in the order the tabs and the sidebar show them. */
export const SECTIONS = ["today", "week", "wall", "table", "stake", "house"] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_LABEL: Record<Section, string> = {
  today: "Today",
  week: "Week",
  wall: "Wall",
  table: "Table",
  stake: "Stake",
  house: "House",
};

/** The house and you, at the foot of the laptop's sidebar. */
export const SHELL_COPY = {
  housemates: (count: number) => `${count} ${count === 1 ? "housemate" : "housemates"}`,
  close: "Close",
  standing: (streak: number, tokens: number) => `${streak}-week streak · ${tokens} ${tokens === 1 ? "token" : "tokens"}`,
} as const;

/** The Table: effort points for the week and the month, fair shares, streaks and perks. */
export const TABLE_COPY = {
  eyebrow: "Effort points",
  title: "The Table",
  thisWeek: "This week",
  beside: "The Table · this week",
  full: "Full table",
  /** A housemate's week or month in a line: "3 done · 1 late · 1 missed". */
  record: (r: { done: number; late: number; missed: number }) =>
    `${r.done} done${r.late ? ` · ${r.late} late` : ""}${r.missed ? ` · ${r.missed} missed` : ""}`,
  shares: "Fair shares",
  sharesBody: `What each of you was handed over the last ${BALANCE_WEEKS} weeks, against your share. Each deal hands a little more to whoever is behind, never more than half a week extra, until it evens out.`,
  sharesKey: "Below zero is behind, above is ahead. Time away is made up:",
  streaks: "Streaks and perks",
  weeks: (n: number) => `${n} ${n === 1 ? "week" : "weeks"}`,
  swap: "swap",
  rules: [
    { term: "Points", body: "A John done on time earns its points. A late one earns half. A missed one earns nothing." },
    {
      term: "Immunity",
      body: `Every ${IMMUNITY_EVERY} clean weeks in a row earns a token (hold up to two). Spend one to skip a John with no forfeit.`,
    },
    { term: "Swap", body: "Top the week and you can trade one of your open Johns for anyone’s, once." },
  ],
  yourShare: "Your share, lately",
  everyones: "Everyone’s",
  /** Where you stand against your share, in a sentence. */
  shareLine: (balance: number, weeksToEven: number) =>
    balance <= -0.5
      ? `Points behind your share. The next weeks hand you a little extra, never more than half a week's worth, for about ${weeksToEven} ${weeksToEven === 1 ? "week" : "weeks"}.`
      : balance >= 0.5
        ? "Points ahead of your share, so the next weeks go a little easier on you."
        : "You've done your share.",
} as const;

/** The Stake: this month so far, settling up, and the ledger. Money arrives already formatted. */
export const STAKE_COPY = {
  title: "The Stake",
  eyebrow: (stake: string) => `${stake} each, every month`,
  soFar: (month: string) => `${month} so far`,
  soFarBody: (late: string, missed: string) =>
    `Late costs ${late}, missed costs ${missed}, and nobody loses more than their stake. What’s forfeited is shared among everyone else when the month ends.`,
  columns: { who: "Housemate", forfeited: "Forfeited", share: "Share", ifNow: "If it ended now" },
  capped: "capped",
  settleUp: "Settle up",
  settleBody: "From closed months. Pay however the house pays each other, then whoever was paid marks it received.",
  square: "Everyone’s square.",
  pays: "pays",
  markReceived: "Mark received",
  saving: "Saving…",
  ledger: "The ledger",
  ledgerEmpty: "Nothing yet. Forfeits appear as Johns are settled.",
  ledgerColumns: { month: "Month", who: "Who", what: "What", amount: "Amount" },
  kind: {
    forfeit: "Forfeit",
    cap_refund: "Over the stake, returned",
    share: "Share of the month's forfeits",
    payment: "Payment",
  } as Record<string, string>,
  /** A payment's other side: "to Ben" for the one who paid, "from Ava" for the one paid. */
  counterparty: (amountMinor: number, name: string) => `${amountMinor > 0 ? "to" : "from"} ${name}`,
  yours: "Your stake this month",
  forfeitedSoFar: (forfeited: string | null) => (forfeited ? `${forfeited} forfeited so far.` : "Nothing forfeited so far."),
  ifNow: "If the month ended now:",
} as const;

/** House: the John list and the deal, the house rules, who lives here, and you. */
export const HOUSE_COPY = {
  eyebrow: "Settings",
  johns: "The John list",
  rules: "House rules",
  members: "Who lives here",
  you: "You",
} as const;

const EVERY: Record<number, string> = { 1: "Every week", 2: "Every 2 weeks", 3: "Every 3 weeks", 4: "Every 4 weeks" };

/** The house's list of Johns, and the sheet an admin adds or edits one in. */
export const JOHN_LIST_COPY = {
  empty: "No Johns yet. Start with the ones that cause arguments: bins, the bathroom, the kitchen.",
  every: EVERY,
  /** "Every 2 weeks · due Sun 21:00". */
  when: (everyWeeks: number, day: string, time: string) =>
    `${EVERY[everyWeeks] ?? `Every ${everyWeeks} weeks`} · due ${day.slice(0, 3)} ${time}`,
  needsPhoto: "needs a photo",
  perWeek: (points: number) =>
    `About ${Math.round(points)} points a week across the house. Changes apply from the next deal.`,
  add: "Add a John",
  edit: (name: string) => `Edit ${name}`,
  hint: "Points are effort: 1 for taking the bins out, 5 for a deep clean.",
  name: "Name",
  namePlaceholder: "Bathroom clean",
  kind: "Kind",
  sharedBy: "Shared by",
  everyone: "Everyone",
  noGroups: "For a John only some of you share, like one of two bathrooms, make a group first.",
  groupOnly: "Only that group is handed it, and it only counts toward their share.",
  effort: "Effort",
  effortPoints: "Effort points",
  often: "How often",
  due: "Due",
  by: "By",
  photo: "Needs a photo",
  photoHint: "The tick only counts with a photo of the result.",
  save: "Save",
  create: "Add John",
  saving: "Saving…",
  remove: "Remove",
} as const;

/** Handing out the week: the first time it starts the house; afterwards it re-deals an unticked week. */
export const DEAL_COPY = {
  first: "Hand out this week's Johns",
  again: "Re-deal this week",
  dealing: "Dealing…",
  firstBody: "When the list is ready and the house has joined, hand out the first week.",
  againBody: "Re-deal this week to include new Johns or housemates. Only works while nothing this week has been ticked.",
  /** Today's card for an admin before the first deal: where the John list and the deal are. */
  fromHouse: "The John list, the join link and the first deal are all on House.",
  openHouse: "Open House",
} as const;

/** The house rules. Admins change them; everyone else reads them. Symbols arrive with the currency. */
export const RULES_COPY = {
  name: "House name",
  timezone: "Time zone",
  timezoneHint: "Weeks and due times follow the house's time zone, wherever each of you is.",
  phoneZone: (zone: string) => `Use this phone’s: ${zone.replaceAll("_", " ")}`,
  weekStarts: "Week starts",
  currency: "Currency",
  stake: (symbol: string) => `Monthly stake (${symbol})`,
  late: (symbol: string) => `Late forfeit (${symbol})`,
  missed: (symbol: string) => `Missed forfeit (${symbol})`,
  disputes: "Disputes can be raised for",
  disputeHours: (hours: number) => (hours === 0 ? "No disputes (honour system)" : `${hours} hours after a tick`),
  away: "Time away is made up",
  awayNote: "Nobody is handed a John due while they’re away.",
  makeupHint: {
    100: "Their share still counts, so they do a little extra each week when they're back until it evens out.",
    50: "Half their share still counts and is made up when they're back; the rest falls to whoever is home.",
    0: "Their share falls to whoever is home, and there's nothing to make up.",
  } as Record<number, string>,
  badAmount: "Amounts are numbers like 20 or 2.50.",
  check: "Check the settings and try again.",
  save: "Save house rules",
  saving: "Saving…",
  saved: "Saved",
  adminsOnly: "Only admins can change the house rules.",
} as const;

/** Who lives here, and what an admin can do about it. */
export const MEMBERS_COPY = {
  admin: "Admin",
  housemate: "Housemate",
  you: "(you)",
  makeAdmin: "Make admin",
  makeHousemate: "Make housemate",
  remove: "Remove",
  /** The second tap, which means it: "Remove Ben". */
  removeName: (name: string) => `Remove ${name.split(" ")[0]}`,
  cancel: "Cancel",
} as const;

/** You: your name, the way out, and leaving. */
export const ME_COPY = {
  name: "Your name",
  save: "Save",
  saved: "Name saved",
  reminders: "Reminders",
  look: "Look",
  signOut: "Sign out",
  leave: "Leave the house",
  leaveForGood: "Leave the house for good",
  stay: "Stay",
} as const;
