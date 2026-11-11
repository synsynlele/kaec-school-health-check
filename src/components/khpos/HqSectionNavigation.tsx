"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useActiveNavScroll } from "./useActiveNavScroll";

const routes = [
  { href: "/khpos/hq", label: "HQ overview" },
  { href: "/khpos/hq/schools", label: "School Pathfinders" },
  { href: "/khpos/hq/reports", label: "Reporting" },
  { href: "/khpos/hq/meetings", label: "Meetings" },
  { href: "/khpos/hq/ideas", label: "Ideas & discussions" },
  { href: "/khpos/hq/ask", label: "Help & training" },
] as const;

/** HQ subpages remain navigable without entering the corporate dashboard first. */
export function HqSectionNavigation() {
  const pathname = usePathname();
  const navRef = useActiveNavScroll<HTMLElement>(pathname);
  // The dashboard already has its own fully featured corporate header.
  if (pathname === "/khpos/hq") return null;

  return (
    <header className="khpos-nav-panel border-b border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/khpos/hq" className="inline-flex min-h-11 items-center gap-2.5 rounded-lg focus-visible:outline-offset-4">
          <span className="grid size-9 place-items-center rounded-xl bg-emerald-300 text-slate-950">
            <Image src="/khpos-icon-192.png" alt="" width={36} height={36} className="size-9 rounded-lg" />
          </span>
          <span className="min-w-0">
            <strong className="block text-sm leading-5">KAEC HQ</strong>
            <span className="block text-[11px] text-slate-300">Corporate operations</span>
          </span>
        </Link>
        <Link href="/account" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-3 text-xs font-bold hover:bg-white/10">
          <ArrowLeft aria-hidden="true" className="size-4" /> Account
        </Link>
      </div>
      <nav ref={navRef} aria-label="KAEC HQ workspace" className="mx-auto max-w-7xl overflow-x-auto px-4 pb-2 sm:px-6">
        <div className="flex w-max min-w-full items-center gap-2">
          {routes.map((route) => {
            const active = pathname === route.href || (route.href !== "/khpos/hq" && pathname.startsWith(route.href + "/"));
            return (
              <Link key={route.href} href={route.href} aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${active
                  ? "border-emerald-300 bg-emerald-300 text-slate-950"
                  : "border-white/15 text-slate-200 hover:border-white/35 hover:bg-white/10 hover:text-white"}`}>
                {route.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
