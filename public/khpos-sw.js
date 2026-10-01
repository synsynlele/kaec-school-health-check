self.addEventListener("push", (event) => {
  let payload = { title: "KHP-OS", body: "You have an action that needs attention.", url: "/khpos", tag: "khpos" };

  try {
    if (event.data) {
      const incoming = event.data.json();
      payload = {
        title: incoming.title || payload.title,
        body: incoming.body || payload.body,
        url: incoming.url || payload.url,
        tag: incoming.tag || payload.tag,
      };
    }
  } catch {
    // Keep the safe fallback payload.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: "/khpos-icon-192.png",
      badge: "/khpos-icon-192.png",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const raw = event.notification.data?.url || "/khpos";
      let target;

      try {
        target = new URL(raw, self.location.origin);
        if (target.origin !== self.location.origin) {
          target = new URL("/khpos", self.location.origin);
        }
      } catch {
        target = new URL("/khpos", self.location.origin);
      }

      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const exact = windows.find((client) => {
        try {
          return new URL(client.url).pathname === target.pathname;
        } catch {
          return false;
        }
      });

      if (exact) {
        await exact.focus();
        return;
      }

      const existing = windows[0];
      if (existing && "navigate" in existing) {
        await existing.navigate(target.href);
        await existing.focus();
        return;
      }

      await self.clients.openWindow(target.href);
    })(),
  );
});
