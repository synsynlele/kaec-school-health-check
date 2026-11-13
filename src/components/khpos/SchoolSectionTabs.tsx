"use client";

import Link from "next/link";
import { LinkPending } from "@/components/navigation/LinkPending";
import { useActiveNavScroll } from "@/components/khpos/useActiveNavScroll";

export type SchoolSection = { view: string; label: string; href?: string };

/** One visible school destination with role-aware inner modules.
 * Only the currently selected module is mounted by its server page.
 */
export function SchoolSectionTabs({
  base, title, selected, tabs, theme = "school", destinationId = "khpos-section-content",
}: {
  base: string;
  title: string;
  selected: string;
  tabs: readonly SchoolSection[];
  theme?: "school" | "hq";
  destinationId?: string;
}) {
  const ref = useActiveNavScroll<HTMLElement>(selected, '[aria-current="page"]');
  return (
    <section aria-label={title + " sections"} className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
      <div className="khpos-interface-card min-w-0 p-3 sm:p-4">
        <p className="px-1 text-[11px] font-black uppercase tracking-[0.13em] text-slate-600">
          {title}
        </p>
        <nav ref={ref} aria-label={title + " sections"} className="khpos-horizontal-nav mt-2 flex-wrap sm:flex-nowrap">
          {tabs.map(tab => {
            const active = tab.view === selected;
            const href = tab.href ?? (tab.view ? base + "?view=" + encodeURIComponent(tab.view) : base);
            const palette = theme === "hq"
              ? (active ? "border-emerald-700 bg-emerald-700 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50")
              : (active ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50");
            return (
              <Link
                key={tab.view || "main"}
                href={href.includes("#") ? href : href + "#" + destinationId}
                aria-current={active ? "page" : undefined}
                className={"inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current " + palette}
              >
                {tab.label}<LinkPending />
              </Link>
            );
          })}
        </nav>
      </div>
    </section>
  );
}
