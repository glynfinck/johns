import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <Link href="/">
        <Wordmark className="text-2xl" />
      </Link>
      <h1 className="mt-8 text-3xl font-black tracking-tight uppercase">Privacy</h1>
      <div className="mt-4 flex flex-col gap-4 text-[15px] leading-relaxed">
        <p>
          Johhs keeps what it needs to run your house&rsquo;s rota and nothing more: your name from Google, the house
          you belong to, the Johhs you were given and when you ticked them, any photos you add, disputes and votes,
          and the Stake ledger.
        </p>
        <p>
          Only people in your house can see any of it. Photos are stored privately and shown to your housemates
          through links that expire after an hour.
        </p>
        <p>
          Johhs never moves money. The ledger records what housemates owe each other; you settle up however you
          like, outside the app.
        </p>
        <p>
          If you turn on reminders, your browser gives us an address to send notifications to. Turning reminders off
          deletes it. Leaving a house removes you from it; your past Johhs stay in its history.
        </p>
      </div>
    </main>
  );
}
