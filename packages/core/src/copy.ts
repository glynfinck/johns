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
