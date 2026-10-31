import { APP_NAME } from "./copy";
import { renderEmail, type EmailBlock } from "./email";

// Supabase Auth's own emails (sign-up code, password reset, email change,
// reauthentication) in Jonz's look. Supabase fills in Go template tags such
// as {{ .Token }} when it sends; provision writes these into production's
// auth settings (scripts/provision/lib.mjs), so they never drift.
//
// Every one carries a 6-digit code and no link: a code works the same in the
// app and on the web, and a link in a sign-in email is what phishing copies.

/** One Supabase template: the subject line and its HTML body. */
export interface AuthEmailTemplate {
  subject: string;
  html: string;
}

/** Supabase's names for its templates, as the Management API spells them (mailer_templates_<name>_content). */
export type AuthEmailName = "confirmation" | "recovery" | "magic_link" | "email_change" | "reauthentication";

const TOKEN = "{{ .Token }}";

const minutes = (n: number) => `The code works for ${n} minutes.`;

function template(args: {
  subject: string;
  preheader: string;
  headline: string;
  lead: string;
  blocks: EmailBlock[];
  why: string;
}): AuthEmailTemplate {
  const { html } = renderEmail(args);
  return { subject: args.subject, html };
}

/** How long a code lasts, in minutes; provision sets Supabase's OTP expiry to match. */
export const AUTH_CODE_MINUTES = 60;

/** Every Supabase Auth email, ready for the Management API. */
export function authEmailTemplates(): Record<AuthEmailName, AuthEmailTemplate> {
  const notYou = { type: "small", text: "If this wasn’t you, ignore this email. Nothing changes without the code." } as const;
  return {
    confirmation: template({
      subject: `Your ${APP_NAME} code is ${TOKEN}`,
      preheader: "Type it in to finish making your account.",
      headline: "Your code",
      lead: "Type it into Jonz to finish making your account.",
      blocks: [{ type: "code", code: TOKEN }, { type: "small", text: minutes(AUTH_CODE_MINUTES) }, notYou],
      why: "You asked for this when you made a Jonz account with this email address.",
    }),
    magic_link: template({
      subject: `Your ${APP_NAME} code is ${TOKEN}`,
      preheader: "Type it in to sign in.",
      headline: "Your code",
      lead: "Type it into Jonz to sign in.",
      blocks: [{ type: "code", code: TOKEN }, { type: "small", text: minutes(AUTH_CODE_MINUTES) }, notYou],
      why: "You asked for this when you signed in to Jonz with this email address.",
    }),
    recovery: template({
      subject: `Reset your ${APP_NAME} password: ${TOKEN}`,
      preheader: "Type the code in to choose a new password.",
      headline: "Reset your password",
      lead: "Type this code into Jonz, then choose a new password.",
      blocks: [
        { type: "code", code: TOKEN },
        { type: "small", text: minutes(AUTH_CODE_MINUTES) },
        { type: "small", text: "If you didn’t ask to reset it, ignore this email. Your password stays as it is." },
      ],
      why: "You asked to reset the password for this email address on Jonz.",
    }),
    email_change: template({
      subject: `Confirm your new ${APP_NAME} email: ${TOKEN}`,
      preheader: "Type the code in to move your account to this address.",
      headline: "Confirm this address",
      lead: "Type this code into Jonz to move your account here.",
      blocks: [
        { type: "code", code: TOKEN },
        { type: "small", text: minutes(AUTH_CODE_MINUTES) },
        { type: "small", text: "If you didn’t ask for this, ignore this email. Your account stays where it is." },
      ],
      why: "Someone asked to move a Jonz account to this email address.",
    }),
    reauthentication: template({
      subject: `Your ${APP_NAME} code is ${TOKEN}`,
      preheader: "Type it in to confirm it’s you.",
      headline: "Confirm it’s you",
      lead: "Type this code into Jonz to carry on.",
      blocks: [{ type: "code", code: TOKEN }, { type: "small", text: minutes(AUTH_CODE_MINUTES) }, notYou],
      why: "You asked for this while changing your sign-in on Jonz.",
    }),
  };
}
