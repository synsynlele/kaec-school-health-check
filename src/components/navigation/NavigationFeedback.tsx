"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Keep the current screen usable during a client-side route transition.
 * The old global full-screen cover started immediately and could obscure the
 * previous page for 20 seconds; only show a small indicator after 450ms.
 * It never pretends that the destination's data has loaded.
 */
export function NavigationFeedback() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const [destination, setDestination] = useState("");
  const current = `${pathname}${query ? `?${query}` : ""}`;

  useEffect(() => {
    let reveal: ReturnType<typeof setTimeout> | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;

    const clearTimers = () => {
      if (reveal !== undefined) clearTimeout(reveal);
      if (expiry !== undefined) clearTimeout(expiry);
      reveal = undefined;
      expiry = undefined;
    };
    const clear = () => {
      clearTimers();
      setDestination("");
    };
    const start = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) return;
      const next = `${url.pathname}${url.search}`;
      if (next === `${window.location.pathname}${window.location.search}`) return;
      clear();
      reveal = setTimeout(() => setDestination(next), 450);
      // Never leave a stale global indicator after an interrupted transition.
      expiry = setTimeout(() => setDestination(""), 12_000);
    };

    document.addEventListener("click", start, true);
    window.addEventListener("pageshow", clear);
    window.addEventListener("popstate", clear);
    return () => {
      clearTimers();
      document.removeEventListener("click", start, true);
      window.removeEventListener("pageshow", clear);
      window.removeEventListener("popstate", clear);
    };
  }, []);

  if (!pathname.startsWith("/khpos") || !destination || destination === current) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-[85] flex max-w-[min(20rem,calc(100vw-2rem))] items-center gap-2 rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl"
    >
      <span aria-hidden="true" className="size-4 shrink-0 animate-spin rounded-full border-2 border-slate-600 border-t-mint-300 motion-reduce:animate-none" />
      Moving to another page
    </div>
  );
}
