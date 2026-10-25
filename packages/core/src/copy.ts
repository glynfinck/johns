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
