"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Bell, X } from "lucide-react";
import {
  getCurrentSubscription,
  isPushSupported,
  serializeSubscription,
  subscribe,
  unsubscribe,
} from "@mmmike/web-push/client";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { KHPOS_ACTIVITY_CHANGED } from "@/lib/khpos/ops/action-events";

type Alert = {
  id: string;
  title: string;
  detail: string;
  href: string;
  dueAt: string | null;
  urgent: boolean;
  level: "urgent" | "action" | "watch";
  category: string;
};

type PushState = "unsupported" | "off" | "on" | "busy" | "unconfigured";

function isActiveBell(mobile: boolean) {
  return window.matchMedia("(min-width: 1280px)").matches !== mobile;
}

export function NotificationBell({
  organisationId,
  mobile = false,
}: {
  organisationId: string;
  mobile?: boolean;
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [pushError, setPushError] = useState("");
  const [testState, setTestState] = useState<"idle"|"busy"|"shown">("idle");
  const [pushState, setPushState] = useState<PushState>(() =>
    typeof window !== "undefined" && isPushSupported() ? "off" : "unsupported",
  );
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const lastFetch = useRef(0);
  const latestRequest = useRef(0);

  const accessToken = useCallback(async () => {
    const client = createBrowserSupabaseClient();
    const session = (await client?.auth.getSession())?.data.session;
    if (!session?.access_token) throw new Error("Sign in to continue.");
    return session.access_token;
  }, []);

  const saveBrowserSubscription = useCallback(
    async (subscription: PushSubscription) => {
      const token = await accessToken();
      const response = await fetch(`/api/khpos/push/${organisationId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(serializeSubscription(subscription)),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Device alert subscription failed.");
      }
    },
    [accessToken, organisationId],
  );

  const refresh = useCallback(async (force = false) => {
    if (!isActiveBell(mobile)) return;
    if (!force && Date.now() - lastFetch.current < 60_000) return;
    lastFetch.current = Date.now();
    const requestId = ++latestRequest.current;

    try {
      const token = await accessToken();
      const response = await fetch(
        `/api/khpos/notifications/${organisationId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error("Unable to load alerts");

      const data = (await response.json()) as {
        alerts: Alert[];
        total: number;
      };
      // A slower earlier response must not restore a notification just cleared.
      if (requestId !== latestRequest.current) return;
      const next = new Set(data.alerts.map((alert) => alert.id));

      if (
        initialized.current &&
        document.visibilityState === "visible" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        for (const alert of data.alerts
          .filter((item) => item.urgent && !seen.current.has(item.id))
          .slice(0, 2)) {
          try {
            const notice = new Notification(alert.title, {
              body: alert.detail,
              tag: `${organisationId}:${alert.id}`,
              renotify: true,
              silent: false,
            } as NotificationOptions);
            notice.onclick = () => {
              window.focus();
              window.location.href = alert.href;
              notice.close();
            };
          } catch {
            // Mobile browsers use the service-worker push path instead.
          }
        }
      }

      seen.current = next;
      initialized.current = true;
      setAlerts(data.alerts);
      setTotal(data.total);
      setError(false);
    } catch {
      if (requestId === latestRequest.current) {
        lastFetch.current = 0;
        setAlerts([]);
        setTotal(0);
        setError(true);
      }
    }
  }, [accessToken, organisationId, mobile]);

  useEffect(() => {
    // Invalidate the previous school/request immediately; reset React state
    // from the scheduled callback rather than synchronously in an effect.
    lastFetch.current = 0;
    latestRequest.current += 1;
    initialized.current = false;
    seen.current.clear();

    const initial = window.setTimeout(() => {
      setAlerts([]);
      setTotal(0);
      setError(false);
      void refresh(true);
    }, 0);
    // Poll only on the active visible layout; mutations refresh immediately.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 180_000);
    const onFocus = () => void refresh(true);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    const onActivity = (event: Event) => {
      if (
        event instanceof CustomEvent &&
        event.detail?.organisationId === organisationId
      ) {
        void refresh(true);
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(KHPOS_ACTIVITY_CHANGED, onActivity);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(KHPOS_ACTIVITY_CHANGED, onActivity);
      latestRequest.current += 1;
    };
  }, [refresh, organisationId]);

  useEffect(() => {
    if (!isActiveBell(mobile)) return;
    if (!isPushSupported()) return;

    let active = true;

    void navigator.serviceWorker
      .register("/khpos-sw.js", { scope: "/" })
      .then(async () => {
        if (!active) return;
        setPermission(Notification.permission);

        if (Notification.permission !== "granted") {
          setPushState("off");
          return;
        }

        const current = await getCurrentSubscription();
        if (!active) return;

        if (!current) {
          setPushState("off");
          return;
        }

        try {
          await saveBrowserSubscription(current);
          if (active) {
            setPushState("on");
            setPushError("");
          }
        } catch (cause) {
          if (!active) return;
          const message =
            cause instanceof Error ? cause.message : "Device alerts could not sync.";
          setPushState(
            /not configured/i.test(message) ? "unconfigured" : "off",
          );
          setPushError(message);
        }
      })
      .catch(() => {
        if (active) {
          setPushState("unsupported");
          setPushError("This device could not register background alerts.");
        }
      });

    const client = createBrowserSupabaseClient();
    const listener = client?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        void unsubscribe();
        setPushState("off");
      }
    });

    return () => {
      active = false;
      listener?.data.subscription.unsubscribe();
    };
  }, [mobile, saveBrowserSubscription]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); return; }
      if (event.key !== "Tab") return;
      const controls = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panelRef.current)) { event.preventDefault(); first.focus(); }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [open]);

  async function enablePush() {
    if (!isPushSupported()) {
      setPushState("unsupported");
      return;
    }

    setPushState("busy");
    setPushError("");

    try {
      await navigator.serviceWorker.register("/khpos-sw.js", { scope: "/" });
      const token = await accessToken();
      const response = await fetch(`/api/khpos/push/${organisationId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as {
        publicKey?: string;
        error?: string;
      };

      if (!response.ok || !body.publicKey) {
        throw new Error(body.error || "Device alerts are not configured.");
      }

      const result = await subscribe(body.publicKey);
      setPermission(
        "Notification" in window ? Notification.permission : "unsupported",
      );

      if (result.status === "unsupported") {
        setPushState("unsupported");
        return;
      }
      if (result.status === "denied") {
        setPushState("off");
        return;
      }

      await saveBrowserSubscription(result.subscription);
      setPushState("on");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Device alerts could not be enabled.";
      setPushState(/not configured/i.test(message) ? "unconfigured" : "off");
      setPushError(message);
    }
  }

  async function testDeviceAlert() {
    setTestState("busy");
    setPushError("");
    try {
      if (!("Notification" in window) || Notification.permission !== "granted") throw new Error("Enable device alerts first, then test again.");
      await navigator.serviceWorker.register("/khpos-sw.js", { scope: "/" });
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("KHP-OS · Device alert test", {
        body: "If this alert is quiet, check its Android notification category, sound volume and Do Not Disturb settings.",
        tag: `khpos-test-${organisationId}`,
        renotify: true,
        silent: false,
        vibrate: [200, 100, 200],
        icon: "/khpos-icon-192.png",
        badge: "/khpos-icon-192.png",
        data: { url: `/khpos/${organisationId}/work` },
      } as NotificationOptions);
      setTestState("shown");
    } catch (cause) {
      setPushError(cause instanceof Error ? cause.message : "The device test could not run.");
      setTestState("idle");
    }
  }

  async function disablePush() {
    setPushState("busy");
    setPushError("");

    try {
      const endpoint = await unsubscribe();
      if (endpoint) {
        const token = await accessToken();
        const response = await fetch(`/api/khpos/push/${organisationId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ endpoint }),
        });
        if (!response.ok) {
          throw new Error("The browser stopped alerts, but server cleanup failed.");
        }
      }
      setPushState("off");
    } catch (cause) {
      setPushState("off");
      setPushError(
        cause instanceof Error
          ? cause.message
          : "Device alerts could not be disabled cleanly.",
      );
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications, ${total} active`}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) void refresh(true);
        }}
        className="relative rounded-lg border border-white/15 p-2 text-slate-200 hover:bg-white/10"
      >
        <Bell className="size-5" aria-hidden="true" />
        {total > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold text-white">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[120]">
        <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-950/50" />
        <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Your reminders and tasks" className="absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-xl border border-slate-700 bg-slate-950 p-3 text-white shadow-2xl sm:left-auto sm:right-4 sm:w-96">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Your reminders and tasks</h2>
            <button
              type="button"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>

          <p className="mt-1 text-xs text-slate-400">
            See what needs your attention now, including school arrival, scheduled lessons, reports and approvals. Completed attendance actions stop appearing here.
          </p>

          {pushState === "on" && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-2">
              <span className="text-xs font-bold text-emerald-300">
                Device reminders are on
              </span>
              <button
                type="button"
                onClick={() => void disablePush()}
                className="text-xs font-bold text-slate-300 underline"
              >
                Turn off
              </button>
            </div>
          )}

          {permission === "granted" && <div className="mt-3 rounded-lg border border-white/15 p-3">
            <button type="button" disabled={testState === "busy"} onClick={() => void testDeviceAlert()} className="min-h-12 rounded-lg border border-mint-300 px-3 py-2 text-sm font-bold text-mint-300 disabled:opacity-50">{testState === "busy" ? "Showing test…" : "Test device alert"}</button>
            <p className="mt-2 text-xs leading-5 text-slate-300">{testState === "shown" ? "Test alert sent to this device’s notification system. This does not verify background delivery or whether sound played. " : ""}For sound: long-press a KHP-OS notification → Settings → choose Alerting and a notification sound. If it is attributed to Chrome, check Chrome’s notification category for www.kshc.name.ng. Also check notification volume and Do Not Disturb. Names vary by phone.</p>
          </div>}

          {pushState === "off" && permission !== "denied" && (
            <button
              type="button"
              onClick={() => void enablePush()}
              className="mt-3 rounded-lg border border-mint-300 px-3 py-2 text-xs font-bold text-mint-300"
            >
              Enable device alerts
            </button>
          )}

          {pushState === "busy" && (
            <p className="mt-3 text-xs text-slate-300">Updating device alerts…</p>
          )}

          {pushState === "unconfigured" && (
            <p className="mt-3 text-xs text-amber-300">
              Background alerts are awaiting server activation.
            </p>
          )}

          {pushState === "unsupported" && (
            <p className="mt-3 text-xs text-slate-400">
              Background push is not supported in this browser. On iPhone/iPad,
              install KHP-OS to the Home Screen first.
            </p>
          )}

          {permission === "denied" && (
            <p className="mt-3 text-xs text-amber-300">
              Notifications are blocked in this device’s browser settings.
            </p>
          )}

          {pushError && (
            <p className="mt-2 text-xs text-amber-300">{pushError}</p>
          )}

          {error && (
            <p className="mt-3 text-xs text-amber-300">
              Alerts could not load.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => void refresh(true)}
              >
                Retry
              </button>
            </p>
          )}

          <div
            className="mt-3 max-h-80 space-y-1 overflow-y-auto"
            aria-live="polite"
          >
            {!error && alerts.length === 0 && (
              <p className="py-4 text-sm text-slate-400">
                Nothing currently needs your attention.
              </p>
            )}

            {alerts.map((alert) => (
              <Link
                key={alert.id}
                href={alert.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg border border-white/10 p-2 hover:bg-white/10"
              >
                <span
                  className={`block text-xs font-bold ${
                    alert.level === "urgent"
                      ? "text-rose-300"
                      : alert.level === "action"
                        ? "text-amber-300"
                        : "text-mint-300"
                  }`}
                >
                  {alert.title}
                </span>
                <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                  {alert.category.replaceAll("_", " ")} · {alert.level}
                </span>
                <span className="block text-sm leading-5">{alert.detail}</span>
                {alert.dueAt && (
                  <span className="text-xs text-slate-400">
                    Due{" "}
                    {new Date(alert.dueAt).toLocaleString("en-NG", {
                      timeZone: "Africa/Lagos",
                      dateStyle: "medium",
                       timeStyle: "short",
                    })}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {total > alerts.length && (
            <p className="mt-2 text-xs text-slate-400">
              Showing 50 of {total} alerts.
            </p>
          )}
        </div>
        </div>, document.body
      )}
    </div>
  );
}
