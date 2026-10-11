"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * When a housemate ticks, votes or disputes, everyone's screen follows.
 * Realtime applies the same RLS as a query, which is why the socket has to
 * carry the user's JWT (setAuth) or every event is silently filtered out.
 * Bursts are folded into one refresh.
 *
 * The socket is a hint, not a contract: an event can land in the gap
 * between the page rendering and the subscription coming up, and a phone
 * coming back from the background has missed everything. So the page also
 * refreshes when it becomes visible again, and every two minutes while it
 * stays visible.
 */
export function LiveRefresh({ houseId }: { houseId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      const filter = `house_id=eq.${houseId}`;
      channel = supabase
        .channel(`house:${houseId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "events", filter }, soon)
        .on("postgres_changes", { event: "*", schema: "public", table: "assignments", filter }, soon)
        .on("postgres_changes", { event: "*", schema: "public", table: "disputes", filter }, soon)
        .subscribe();
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") soon();
    };
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") soon();
    }, 120_000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [houseId, router]);

  return null;
}
