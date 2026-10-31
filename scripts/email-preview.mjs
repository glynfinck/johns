// Draws every email Jonz sends into email-previews/, as a mail app would show
// it, with the pictures read from apps/client/public/email instead of
// jonz.app. Open the .html files in a browser, or pass --shots to also save
// phone-width screenshots in light and dark (the PR's pictures).
import { mkdirSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { resolve } from "node:path";

// @app/core imports its files without an extension, as its bundlers allow;
// Node asks for one, so try ".ts" when a relative import has none.
register(
  "data:text/javascript," +
    encodeURIComponent(`export async function resolve(spec, ctx, next) {
      if (spec.startsWith(".") && !/\\.[a-z]+$/.test(spec)) {
        try { return await next(spec + ".ts", ctx); } catch {}
      }
      return next(spec, ctx);
    }`),
);
const { accountDeletedEmail, EMAIL_ASSETS, noticeEmail } = await import("../packages/core/src/email.ts");

const OUT = "email-previews";
const local = `file://${resolve("apps/client/public/email")}`;

const EMAILS = {
  "account-deleted": accountDeletedEmail({ name: "Sam Okafor", deletedOn: "31 October 2026" }),
  "notice-status": noticeEmail({
    kind: "status",
    name: "Priya",
    title: "Jonz is off for 10 minutes on Sunday.",
    body: "We’re moving to a bigger computer, 02:00 to 02:10 UTC on 8 November. Nothing you’ve done is lost.",
    more: "The app won’t open for those 10 minutes, and no John goes late because of it.",
  }),
  "notice-offer": noticeEmail({
    kind: "offer",
    name: "Priya",
    title: "The Founding Pass is half price this week.",
    body: "One payment, every Pass feature, for good.",
    link: { label: "See the Pass", url: "https://jonz.app/house/pass" },
    unsubscribeUrl: "https://jonz.app/house/notifications",
  }),
  "notice-news": noticeEmail({
    kind: "news",
    name: "Priya",
    title: "Late fines can go to Splitwise now.",
    body: "Open Settle up on the House tab.",
    link: { label: "Show me", url: "https://jonz.app/house" },
    unsubscribeUrl: "https://jonz.app/house/notifications",
  }),
};

mkdirSync(OUT, { recursive: true });
for (const [name, email] of Object.entries(EMAILS)) {
  writeFileSync(`${OUT}/${name}.html`, email.html.replaceAll(EMAIL_ASSETS, local));
  writeFileSync(`${OUT}/${name}.txt`, `Subject: ${email.subject}\nPreheader: ${email.preheader}\n\n${email.text}`);
}

if (process.argv.includes("--shots")) {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  for (const scheme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme });
    for (const name of Object.keys(EMAILS)) {
      await page.goto(`file://${resolve(OUT, `${name}.html`)}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.screenshot({ path: `${OUT}/${name}-${scheme}.png`, fullPage: true });
    }
    await page.close();
  }
  await browser.close();
}
console.log(`Wrote ${Object.keys(EMAILS).length} emails to ${OUT}/`);
