import type { ReactNode } from "react";
import { AdminNav } from "@/components/khpos/AdminNav";

/** Shared once for every platform-admin page; route/API access checks are unchanged. */
export default function PlatformAdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="khpos-admin-shell min-h-screen">
      <a href="#khpos-admin-content" className="sr-only fixed left-3 top-3 z-[100] rounded-xl bg-white p-3 text-sm font-bold text-slate-950 shadow-xl focus:not-sr-only">
        Skip to administration content
      </a>
      <AdminNav />
      <div id="khpos-admin-content" tabIndex={-1}>{children}</div>
    </div>
  );
}
