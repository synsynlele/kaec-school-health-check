"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const links = [
  { href: "/khpos/admin", label: "Admin Dashboard" },
  { href: "/khpos/admin/partnerships", label: "School Partnerships" },
  { href: "/khpos/portfolio", label: "Portfolio Intelligence" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="KHP-OS platform administration"
      className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 text-white shadow-sm backdrop-blur"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-mint-300">
            KAEC-NG Platform Administration
          </p>
          <p className="mt-0.5 text-xs font-semibold text-slate-400">
            Govern partner access and institutional transformation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-slate-100"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            School Platform
          </Link>
          <span aria-hidden="true" className="hidden h-6 w-px bg-white/15 sm:block" />
          {links.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== "/khpos/admin" && pathname.startsWith(`${link.href}/`));

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-xs font-black transition ${
                  active
                    ? "bg-mint-300 text-slate-950 hover:bg-mint-200"
                    : "border border-white/15 text-white hover:bg-white/10"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
