"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useActiveNavScroll } from "./useActiveNavScroll";

const links = [
  { href: "/khpos/admin/announcements", label: "Network Announcements" },
  { href: "/khpos/admin/schools-campuses", label: "Schools & Campuses" },
  { href: "/khpos/admin", label: "Admin Dashboard" },
  { href: "/khpos/admin/partnerships", label: "School Partnerships" },
  { href: "/khpos/portfolio", label: "Network summary" },
  { href: "/khpos/hq", label: "KAEC HQ" },
];

export function AdminNav() {
  const pathname = usePathname();
  const navRef = useActiveNavScroll<HTMLDivElement>(pathname);

  return (
    <nav aria-label="KHP-OS platform administration"
      className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950 text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-mint-300">
            KAEC-NG Platform Administration
          </p>
          <p className="mt-0.5 text-xs font-semibold text-slate-300">
            Access, schools and network oversight
          </p>
        </div>
        <Link href="/account"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-white/20 px-3 text-xs font-black text-white transition hover:bg-white/10">
          <ArrowLeft className="size-4" aria-hidden="true" />
          School Platform
        </Link>
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-2 sm:px-6">
        <div ref={navRef} className="flex gap-2 overflow-x-auto pb-1" aria-label="Administration pages">
          {links.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== "/khpos/admin" && pathname.startsWith(`${link.href}/`));
            return (
              <Link key={link.href} href={link.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-xl border px-4 py-2 text-xs font-black transition-colors ${active
                  ? "border-mint-300 bg-mint-300 text-slate-950"
                  : "border-white/15 text-slate-200 hover:border-white/30 hover:bg-white/10 hover:text-white"}`}>
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );}
