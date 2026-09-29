"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Alert = { id: string; title: string; detail: string; href: string; dueAt: string | null; urgent: boolean };

export function NotificationBell({ organisationId, mobile = false }: { organisationId: string; mobile?: boolean }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const seen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const lastFetch = useRef(0);

  const refresh = useCallback(async () => {
    if (window.matchMedia("(min-width: 1280px)").matches === mobile) return;
    if (Date.now() - lastFetch.current < 60000) return;
    lastFetch.current = Date.now();
    const client = createBrowserSupabaseClient();
    const session = (await client?.auth.getSession())?.data.session;
    if (!session) return;
    try {
      const response = await fetch(`/api/khpos/notifications/${organisationId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store",
      });
      if (!response.ok) throw new Error("Unable to load alerts");
      const data = await response.json() as { alerts: Alert[]; total: number };
      const next = new Set(data.alerts.map((alert) => alert.id));
      if (initialized.current && document.visibilityState === "visible" && "Notification" in window && Notification.permission === "granted") {
        for (const alert of data.alerts.filter((item) => item.urgent && !seen.current.has(item.id)).slice(0, 2)) {
          try {
            const notice = new Notification(alert.detail, { body: alert.title, tag: `${organisationId}:${alert.id}` });
            notice.onclick = () => { window.focus(); window.location.href = alert.href; notice.close(); };
          } catch { /* Some mobile browsers require service-worker push. The in-app alert remains available. */ }
        }
      }
      seen.current = next;
      initialized.current = true;
      setAlerts(data.alerts);
      setTotal(data.total);
      setError(false);
    } catch { lastFetch.current = 0; setError(true); }
  }, [organisationId, mobile]);

  useEffect(() => {
    if ("Notification" in window) setPermission(Notification.permission);
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 900000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [refresh]);

  async function enable() {
    if (!("Notification" in window)) return;
    setPermission(await Notification.requestPermission());
  }

  return <div className="relative">
    <button type="button" aria-label={`Notifications, ${total} active`} aria-expanded={open} onClick={() => { setOpen(!open); if (!open) void refresh(); }} className="relative rounded-lg border border-white/15 p-2 text-slate-200 hover:bg-white/10">
      <Bell className="size-5" aria-hidden="true" />
      {total > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold text-white">{total > 99 ? "99+" : total}</span>}
    </button>
    {open && <div className="absolute right-0 z-[90] mt-2 w-[min(90vw,22rem)] rounded-xl border border-slate-700 bg-slate-950 p-3 text-white shadow-2xl">
      <div className="flex items-center justify-between"><h2 className="font-bold">Active alerts</h2><button type="button" aria-label="Close notifications" onClick={() => setOpen(false)}><X className="size-4" /></button></div>
      <p className="mt-1 text-xs text-slate-400">Assigned work and decisions due within seven days. Alerts clear when the work is resolved.</p>
      {permission === "default" && <button type="button" onClick={() => void enable()} className="mt-3 rounded-lg border border-mint-300 px-3 py-2 text-xs font-bold text-mint-300">Enable device alerts while the app is open</button>}
      {permission === "denied" && <p className="mt-2 text-xs text-amber-300">Browser alerts are blocked in this device’s settings.</p>}
      {error && <p className="mt-3 text-xs text-amber-300">Alerts could not load. <button type="button" className="underline" onClick={() => void refresh()}>Retry</button></p>}
      <div className="mt-3 max-h-80 space-y-1 overflow-y-auto" aria-live="polite">
        {!error && alerts.length === 0 && <p className="py-4 text-sm text-slate-400">No work or decisions due soon.</p>}
        {alerts.map((alert) => <Link key={alert.id} href={alert.href} onClick={() => setOpen(false)} className="block rounded-lg border border-white/10 p-2 hover:bg-white/10">
          <span className={`block text-xs font-bold ${alert.urgent ? "text-rose-300" : "text-mint-300"}`}>{alert.detail}</span>
          <span className="block truncate text-sm">{alert.title}</span>
          {alert.dueAt && <span className="text-xs text-slate-400">Due {new Date(alert.dueAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium" })}</span>}
        </Link>)}
      </div>
      {total > alerts.length && <p className="mt-2 text-xs text-slate-400">Showing 50 of {total} alerts.</p>}
    </div>}
  </div>;
}
