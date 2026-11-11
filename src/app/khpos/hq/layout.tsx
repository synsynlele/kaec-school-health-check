import type { ReactNode } from "react";
import { HqSectionNavigation } from "@/components/khpos/HqSectionNavigation";

export default function KhposHqLayout({ children }: { children: ReactNode }) {
  return (
    <div className="khpos-hq-shell min-h-screen">
      <a href="#khpos-hq-content" className="sr-only fixed left-3 top-3 z-[100] rounded-xl bg-white p-3 text-sm font-bold text-slate-950 shadow-xl focus:not-sr-only">
        Skip to HQ content
      </a>
      <HqSectionNavigation />
      <div id="khpos-hq-content" tabIndex={-1}>{children}</div>
    </div>
  );
}
