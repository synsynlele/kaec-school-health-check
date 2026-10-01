"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import {
  getCurrentSubscription,
  isPushSupported,
  serializeSubscription,
  subscribe,
  unsubscribe,
} from "@mmmike/web-push/client";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Alert = {
  id: string;
  title: string;
  detail: string;
  href: string;
  dueAt: string | null;
  urgent: boolean;
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
  const [pushState, setPushState] = useState<PushState>("off");
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );
  const seen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const lastFetch = useRef(0);

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

  const refresh = useCallback(async () => {
    if (!isActiveBell(mobile)) return;
    if (Date.now() - lastFetch.current < 60_000) return;
    lastFetch.current = Date.now();

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
            const notice = new Notification(alert.detail, {
              body: alert.title,
              tag: `${organisationId}:${alert.id}`,
            });
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
      lastFetch.current = 0;
      setError(true);
    }
  }, [accessToken, organisationId, mobile]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      void refresh();
    }, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 900_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!isActiveBell(mobile)) return;
    if (!isPushSupported()) {
      setPushState("unsupported");
      return;
    }

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
          if (!open) void refresh();
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

      {open && (
        <div className="absolute right-0 z-[90] mt-2 w-[min(90vw,22rem)] rounded-xl border border-slate-700 bg-slate-950 p-3 text-white shadow-2xl">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Active alerts</h2>
            <button
              type="button"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>

          <p className="mt-1 text-xs text-slate-400">
            Work and decisions due within seven days. Background device reminders
            focus on urgent items and actions due within 24 hours.
          </p>

          {pushState === "on" && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-2">
              <span className="text-xs font-bold text-emerald-300">
                Phone/tablet alerts are on
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

          {pushState === "off" && permission !== "denied" && (
            <button
              type="button"
              onClick={() => void enablePush()}
              className="mt-3 rounded-lg border border-mint-300 px-3 py-2 text-xs font-bold text-mint-300"
            >
              Enable phone/tablet alerts
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
                onClick={() => void refresh()}
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
                No work or decisions due soon.
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
                    alert.urgent ? "text-rose-300" : "text-mint-300"
                  }`}
                >
                  {alert.detail}
                </span>
                <span className="block truncate text-sm">{alert.title}</span>
                {alert.dueAt && (
                  <span className="text-xs text-slate-400">
                    Due{" "}
                    {new Date(alert.dueAt).toLocaleString("en-NG", {
                      timeZone: "Africa/Lagos",
                      dateStyle: "medium",
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
      )}
    </div>
  );
}
