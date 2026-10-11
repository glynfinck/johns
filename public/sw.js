// Johhs service worker: push reminders only. No offline cache, on purpose:
// a stale rota is worse than a spinner.

self.addEventListener("push", (event) => {
  let message = { title: "Johhs", body: "", url: "/today" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    // A push with no body still says something.
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: message.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/today";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if ("focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
