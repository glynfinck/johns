// Johns service worker: push reminders only. No offline cache, on purpose:
// a stale list of Johns is worse than a spinner.
//
// A push can carry buttons (Done on a reminder, It was done / It wasn't on a
// housemate check) and a token that stands in for a sign-in. Pressing one
// posts it to /api/push-actions, which jonz.app passes on to apps/api,
// and the notification is swapped for one saying it worked, or why not.

const ICON = "/icon-192.png";

self.addEventListener("push", (event) => {
  let message = { title: "Jonz", body: "", url: "/today", actions: [], silent: false };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    // A push with no body still says something.
  }
  const options = {
    body: message.body,
    icon: ICON,
    badge: ICON,
    silent: Boolean(message.silent),
    data: { url: message.url, token: message.token },
  };
  if (message.tag) options.tag = message.tag;
  if (message.token && Array.isArray(message.actions) && message.actions.length > 0) options.actions = message.actions;
  event.waitUntil(self.registration.showNotification(message.title, options));
});

async function openPage(url) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const w of windows) {
    if ("focus" in w) {
      w.navigate(url);
      return w.focus();
    }
  }
  return self.clients.openWindow(url);
}

async function answer(notification, action) {
  const { url, token } = notification.data || {};
  const tag = notification.tag || undefined;
  let reply;
  try {
    const res = await fetch("/api/push-actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, action }),
    });
    reply = await res.json().catch(() => ({}));
    if (!res.ok) reply = { failed: true, body: reply.error };
  } catch {
    reply = { failed: true };
  }
  // In place of the one pressed: tapping it opens the app, as any reminder's does.
  return self.registration.showNotification(reply.failed ? notification.title : reply.title, {
    body: reply.failed ? reply.body || "Couldn’t do that from here. Tap to open Jonz." : reply.body,
    icon: ICON,
    badge: ICON,
    silent: true,
    tag,
    data: { url: url || "/today" },
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  if (event.action && data.token) {
    event.waitUntil(answer(event.notification, event.action));
    return;
  }
  event.waitUntil(openPage(data.url || "/today"));
});
