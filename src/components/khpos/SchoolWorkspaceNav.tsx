"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BrainCircuit,
  FileCheck2,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  Scale,
  ShieldCheck,
  Target,
  Workflow,
} from "lucide-react";

const workspaceLinks = [
  { suffix: "", label: "Command Centre", icon: LayoutDashboard },
  { suffix: "/priorities", label: "Priorities", icon: Target },
  { suffix: "/implementation", label: "Implementation", icon: Workflow },
  { suffix: "/evidence", label: "Evidence", icon: FileCheck2 },
  { suffix: "/reviews", label: "Reviews", icon: Scale },
  { suffix: "/improvement", label: "Improvement", icon: Activity },
  { suffix: "/benchmarking", label: "Benchmarking", icon: Gauge },
  { suffix: "/learning-intelligence", label: "Learning Intelligence", icon: GraduationCap },
  { suffix: "/human-potential-intelligence", label: "Human Potential", icon: BrainCircuit },
] as const;

export function SchoolWorkspaceNav({ organisationId }: { organisationId: string }) {
  const pathname = usePathname();
  const base = `/khpos/${organisationId}`;

  return (
    <nav
      aria-label="KHP-OS school workspace"
      className="sticky top-0 z-[60] border-b border-slate-800 bg-slate-950/95 text-white shadow-lg backdrop-blur"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6">
        {workspaceLinks.map((item) => {
          const href = `${base}${item.suffix}`;
          const active =
            item.suffix === ""
              ? pathname === base
              : pathname === href || pathname.startsWith(`${href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.suffix || "command-centre"}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-black transition ${
                active
                  ? "bg-mint-300 text-slate-950"
                  : "border border-white/10 text-slate-200 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="size-3.5" />
              {item.label}
            </Link>
          );
        })}
        <span className="mx-1 h-6 w-px shrink-0 bg-white/10" aria-hidden="true" />
        <Link
          href="/khpos/admin"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-mint-300/20 px-3.5 py-2 text-xs font-bold text-mint-200 transition hover:bg-white/10 hover:text-white"
        >
          <ShieldCheck className="size-3.5" /> Admin Console
        </Link>
        <Link
          href="/account"
          className="shrink-0 rounded-full border border-white/10 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          School Account
        </Link>
        <Link
          href="/khpos"
          className="shrink-0 rounded-full border border-white/10 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          Access Hub
        </Link>
      </div>
    </nav>
  );
}
