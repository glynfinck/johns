"use client";

import { LOOK_LABEL, ME_COPY, REMINDERS_COPY } from "@app/core";
import { BellIcon, BellOffIcon, LogOutIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { removeMember, renameMe, signOut } from "@/lib/actions/house";
import { removePushSubscription, savePushSubscription } from "@/lib/actions/johns";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};
/** Hydration-safe "are we in the browser yet". */
function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

function base64ToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** This device's push subscription, if it has one. */
async function current() {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return reg ? reg.pushManager.getSubscription() : null;
}

function PushToggle({ vapidKey }: { vapidKey: string }) {
  const mounted = useMounted();
  const supported = mounted && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    let alive = true;
    void current().then((s) => {
      if (alive) setOn(s !== null);
    });
    return () => {
      alive = false;
    };
  }, [supported]);

  if (!vapidKey) return null;
  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        {REMINDERS_COPY.unsupported}
      </p>
    );
  }

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error(REMINDERS_COPY.blocked);
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(vapidKey) });
      const json = sub.toJSON();
      const result = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      if (result?.error) throw new Error(result.error);
      setOn(true);
      toast.success(REMINDERS_COPY.turnedOn);
    } catch {
      toast.error(REMINDERS_COPY.failed);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    const sub = await current();
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setOn(false);
    setBusy(false);
  }

  return on ? (
    <Button variant="outline" disabled={busy} onClick={() => void disable()}>
      <BellOffIcon aria-hidden />
      {REMINDERS_COPY.off}
    </Button>
  ) : (
    <Button disabled={busy} onClick={() => void enable()} data-testid="enable-push">
      <BellIcon aria-hidden />
      {REMINDERS_COPY.on}
    </Button>
  );
}

function ThemeChoice() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const options = [
    { value: "light", label: LOOK_LABEL.light, Icon: SunIcon },
    { value: "dark", label: LOOK_LABEL.dark, Icon: MoonIcon },
    { value: "system", label: LOOK_LABEL.system, Icon: MonitorIcon },
  ];
  return (
    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Theme">
      {options.map(({ value, label, Icon }) => {
        const on = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setTheme(value)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 rounded-md border text-sm font-bold",
              on ? "border-foreground bg-hivis text-on-hivis" : "border-border",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function MeCard({
  name,
  userId,
  houseId,
  vapidKey,
}: {
  name: string;
  userId: string;
  houseId: string;
  vapidKey: string;
}) {
  const { pending, run } = useAction();
  const [value, setValue] = useState(name);
  const [leaving, setLeaving] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => renameMe(value), () => toast.success(ME_COPY.saved));
        }}
      >
        <div className="flex-1">
          <FieldLabel htmlFor="my-name">{ME_COPY.name}</FieldLabel>
          <Input id="my-name" value={value} maxLength={60} onChange={(e) => setValue(e.target.value)} />
        </div>
        <Button type="submit" variant="outline" disabled={pending || value.trim() === name}>
          {ME_COPY.save}
        </Button>
      </form>
      {vapidKey ? (
        <div>
          <FieldLabel>{ME_COPY.reminders}</FieldLabel>
          <PushToggle vapidKey={vapidKey} />
        </div>
      ) : null}
      <div>
        <FieldLabel>{ME_COPY.look}</FieldLabel>
        <ThemeChoice />
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={() => void signOut()}>
          <LogOutIcon aria-hidden />
          {ME_COPY.signOut}
        </Button>
        {leaving ? (
          <>
            <Button variant="destructive" disabled={pending} onClick={() => run(() => removeMember(userId))}>
              {ME_COPY.leaveForGood}
            </Button>
            <Button variant="ghost" onClick={() => setLeaving(false)}>
              {ME_COPY.stay}
            </Button>
          </>
        ) : (
          <Button variant="ghost" className="text-muted-foreground" onClick={() => setLeaving(true)} data-house={houseId}>
            {ME_COPY.leave}
          </Button>
        )}
      </div>
    </div>
  );
}
