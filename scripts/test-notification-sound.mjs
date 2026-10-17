import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const listeners = {},
  shown = [];
const worker = {
  addEventListener: (name, fn) => (listeners[name] = fn),
  skipWaiting: async () => {},
  clients: {
    claim: async () => {},
    matchAll: async () => [],
    openWindow: async () => {},
  },
  location: { origin: "https://www.kshc.name.ng" },
  registration: {
    showNotification: async (title, options) => shown.push({ title, options }),
  },
};
vm.runInNewContext(fs.readFileSync("public/khpos-sw.js", "utf8"), {
  self: worker,
  URL,
});
async function push(data) {
  let pending;
  listeners.push({ data, waitUntil: (p) => (pending = p) });
  await pending;
}
await push({
  json: () => ({
    title: "School action",
    body: "Open your work queue",
    tag: "khpos-school",
    url: "/khpos/school/work",
  }),
});
await push({
  json: () => ({
    title: "Another action",
    body: "A new action is due",
    tag: "khpos-school",
  }),
});
assert.equal(shown.length, 2);
for (const notice of shown) {
  assert.equal(
    notice.options.renotify,
    true,
    "replacement tags must request a new alert",
  );
  assert.equal(notice.options.silent, false);
  assert.deepEqual(Array.from(notice.options.vibrate), [200, 100, 200]);
  assert.ok(notice.options.tag);
  assert.equal(
    "sound" in notice.options,
    false,
    "no unsupported custom ringtone option",
  );
}
await push({
  json: () => {
    throw new Error("Bad payload");
  },
});
assert.equal(shown[2].title, "KHP-OS");
assert.equal(shown[2].options.tag, "khpos");
assert.ok(
  listeners.install && listeners.activate,
  "worker updates activate without a cache dependency",
);
const bell = fs.readFileSync(
  "src/components/khpos/NotificationBell.tsx",
  "utf8",
);
assert.ok(bell.includes("Test device alert"));
assert.ok(
  bell.includes(
    "This does not verify background delivery or whether sound played.",
  ),
);
console.log(
  "Notification sound: repeated-tag re-alert, non-silent/vibration request, safe fallback and honest on-device test guidance passed.",
);
