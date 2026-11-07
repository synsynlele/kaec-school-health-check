"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationFeedback() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const [destination, setDestination] = useState("");
  const current = `${pathname}${query ? `?${query}` : ""}`;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const start = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download") || anchor.target && anchor.target !== "_self") return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) return;
      const next = `${url.pathname}${url.search}`;
      if (next !== `${window.location.pathname}${window.location.search}`) {
        clearTimeout(timer);
        setDestination(next);
        timer = setTimeout(() => setDestination(""), 20000);
      }
    };
    const clear = () => { clearTimeout(timer); setDestination(""); };
    document.addEventListener("click", start, true);
    window.addEventListener("pageshow", clear);
    window.addEventListener("popstate", clear);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", start, true);
      window.removeEventListener("pageshow", clear);
      window.removeEventListener("popstate", clear);
    };
  }, []);
  // Derive visibility from the completed route so there is no blank frame
  // while an effect waits to clear the pending state.
  return destination && destination !== current ? <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[200] border-b border-brand-200 bg-brand-50 px-4 py-3 text-center text-sm font-bold text-brand-900 shadow-soft">
    <span aria-hidden="true" className="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-brand-700 border-r-transparent align-middle" />Opening page…
  </div> : null;
}
