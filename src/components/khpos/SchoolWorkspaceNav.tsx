"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BrainCircuit,
  Building2,
  FileCheck2,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  Target,
  Workflow,
} from "lucide-react";

const transformLinks = [
  { suffix: "", label: "Command Centre", icon: LayoutDashboard },
  { suffix: "/priorities", label: "Priorities", icon: Target },
  { suffix: "/implementation", label: "Implementation", icon: Workflow },
  { suffix: "/evidence", label: "Evidence", icon: FileCheck2 },
  { suffix: "/reviews", label: "Reviews", icon: Gauge },
  { suffix: "/improvement", label: "Improvement", icon: Activity },
] as const;

const intelligenceLinks = [
  { suffix: "/benchmarking", label: "Benchmarking", icon: Gauge },
  { suffix: "/learning-intelligence", label: "Learning Intelligence", icon: GraduationCap },
  { suffix: "/human-potential-intelligence", label: "Human Potential", icon: BrainCircuit },
] as const;

const workspaceLinks = [...transformLinks, ...intelligenceLinks] as const;

function isActive(pathname: string, base: string, suffix: string) {
  const href = `${base}${suffix}`;
  return suffix === ""
    ? pathname === base
    : pathname === href || pathname.startsWith(`${href}/`);
}

function WorkspaceLink({
  base,
  pathname,
  suffix,
  label,
  icon: Icon,
}: {
  base: string;
  pathname: string;
  suffix: string;
  label: string;
  icon: (typeof workspaceLinks)[number]["icon"];
}) {
  const href = `${base}${suffix}`;
  const active = isActive(pathname, base, suffix);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
        active
          ? "bg-mint-300 text-slate-950 shadow-sm"
          : "text-slate-300 hover:bg-white/8 hover:text-white"
      }`}
    >
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-lg border transition ${
          active
            ? "border-slate-950/10 bg-slate-950/8"
            : "border-white/10 bg-white/5 group-hover:border-white/15"
        }`}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}

export function SchoolWorkspaceNav({ organisationId }: { organisationId: string }) {
  const pathname = usePathname();
  const base = `/khpos/${organisationId}`;

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-[60] hidden w-72 flex-col border-r border-white/10 bg-slate-950 text-white shadow-2xl xl:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <Link href={base} className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mint-300 text-slate-950 shadow-sm">
              <Building2 className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-mint-300">
                KHP-OS | Schools
              </span>
              <span className="mt-0.5 block truncate text-sm font-extrabold text-white">
                Transformation Workspace
              </span>
            </span>
          </Link>
        </div>

        <nav aria-label="KHP-OS school workspace" className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Transform
          </p>
          <div className="mt-2 space-y-1">
            {transformLinks.map((item) => (
              <WorkspaceLink
                key={item.suffix || "command-centre"}
                base={base}
                pathname={pathname}
                {...item}
              />
            ))}
          </div>

          <div className="my-4 border-t border-white/10" />

          <p className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Intelligence
          </p>
          <div className="mt-2 space-y-1">
            {intelligenceLinks.map((item) => (
              <WorkspaceLink
                key={item.suffix}
                base={base}
                pathname={pathname}
                {...item}
              />
            ))}
          </div>
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/account"
              className="rounded-xl border border-white/10 px-3 py-2.5 text-center text-xs font-bold text-slate-300 transition hover:bg-white/8 hover:text-white"
            >
              School Account
            </Link>
            <Link
              href="/khpos"
              className="rounded-xl border border-white/10 px-3 py-2.5 text-center text-xs font-bold text-slate-300 transition hover:bg-white/8 hover:text-white"
            >
              Access Hub
            </Link>
          </div>
          <p className="mt-3 px-1 text-[10px] leading-4 text-slate-500">
            KAEC-NG institutional transformation environment.
          </p>
        </div>
      </aside>

      <nav
        aria-label="KHP-OS school workspace"
        className="sticky top-0 z-[60] border-b border-slate-800 bg-slate-950/96 text-white shadow-lg backdrop-blur xl:hidden"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3 sm:px-6">
          <Link href={base} className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-mint-300 text-slate-950">
              <Building2 className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-mint-300">
                KHP-OS | Schools
              </span>
              <span className="block truncate text-xs font-extrabold">Transformation Workspace</span>
            </span>
          </Link>
          <div className="flex shrink-0 gap-2">
            <Link href="/account" className="rounded-lg border border-white/10 px-2.5 py-2 text-[11px] font-bold text-slate-300">
              Account
            </Link>
            <Link href="/khpos" className="rounded-lg border border-white/10 px-2.5 py-2 text-[11px] font-bold text-slate-300">
              Hub
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto px-3 py-2 sm:px-5">
          <div className="flex min-w-max gap-1.5">
            {workspaceLinks.map((item) => {
              const href = `${base}${item.suffix}`;
              const active = isActive(pathname, base, item.suffix);
              const Icon = item.icon;
              return (
                <Link
                  key={item.suffix || "command-centre"}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-black transition ${
                    active
                      ? "bg-mint-300 text-slate-950"
                      : "border border-white/10 text-slate-300 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
