"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  BrainCircuit,
  Building2,
  CalendarClock,
  CircleDollarSign,
  ChevronDown,
  CheckCircle2,
  Compass,
  FileCheck2,
  Gauge,
  Gavel,
  Hammer,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  LibraryBig,
  Rocket,
  ListTodo,
  Menu,
  ShieldCheck,
  Sparkles,
  Target,
  UserRoundCheck,
  UserRoundSearch,
  MessageCircle,
  UsersRound,
  Workflow,
  Wrench,
  X,
} from "lucide-react";

const transformLinks = [
  { suffix: "", label: "Command Centre", icon: LayoutDashboard },
  { suffix: "/priorities", label: "Priorities", icon: Target },
  { suffix: "/implementation", label: "Implementation", icon: Workflow },
  { suffix: "/playbooks", label: "Playbooks", icon: BookOpen },
  { suffix: "/evidence", label: "Evidence", icon: FileCheck2 },
  { suffix: "/reviews", label: "Reviews", icon: Gauge },
  { suffix: "/improvement", label: "Improvement", icon: Activity },
] as const;

const operationsLinks = [
  { suffix: "/work", label: "My Work", icon: ListTodo },
  { suffix: "/issues", label: "Issues & Escalations", icon: AlertTriangle },
  { suffix: "/decisions", label: "Decisions & Approvals", icon: CheckCircle2 },
  { suffix: "/performance", label: "Performance & Scorecards", icon: BarChart3 },
  { suffix: "/people", label: "People & Staff", icon: UserRoundCheck },
  { suffix: "/recruitment", label: "Workforce & Recruitment", icon: BriefcaseBusiness },
  { suffix: "/availability", label: "Availability & Coverage", icon: CalendarClock },
  { suffix: "/staff-performance", label: "Staff Performance", icon: FileCheck2 },
  { suffix: "/staff-accountability", label: "Recognition & Accountability", icon: Gavel },
  { suffix: "/staff-transition", label: "Progression & Exit", icon: GitBranch },
  { suffix: "/academic-delivery", label: "Academic Delivery", icon: GraduationCap },
  { suffix: "/academic-assurance", label: "Assessment & Exams", icon: ShieldCheck },
  { suffix: "/learner-progress", label: "Learner Progress", icon: UserRoundSearch },
  { suffix: "/potential-development", label: "Potential Development", icon: Sparkles },
  { suffix: "/skills-development", label: "Skills Development", icon: Wrench },
  { suffix: "/leadership-financial", label: "Leadership & Finance", icon: CircleDollarSign },
  { suffix: "/young-ceo", label: "Young CEO Hub", icon: Rocket },
  { suffix: "/builder-projects", label: "Builder Projects", icon: Hammer },
  { suffix: "/worldready", label: "WorldReady", icon: Compass },
  { suffix: "/builders-council", label: "Builders Council", icon: UsersRound },
  { suffix: "/student-culture", label: "Student Culture", icon: UserRoundCheck },
  { suffix: "/safeguarding", label: "Safeguarding", icon: ShieldCheck },
  { suffix: "/team", label: "Team & Roles", icon: UsersRound },
  { suffix: "/library", label: "Institutional Library", icon: LibraryBig },
  { suffix: "/parents", label: "Parent Partnership", icon: MessageCircle },
  { suffix: "/campus-readiness", label: "Campus Readiness", icon: Building2 },
  { suffix: "/assets", label: "Assets & Maintenance", icon: Wrench },
  { suffix: "/events", label: "Events & Programmes", icon: CalendarClock },
  { suffix: "/parent-journeys", label: "Parent Journey", icon: MessageCircle },
  { suffix: "/network-pulse", label: "Network Pulse", icon: Gauge },
] as const;

const intelligenceLinks = [
  { suffix: "/benchmarking", label: "Benchmarking", icon: Gauge },
  { suffix: "/learning-intelligence", label: "Learning Intelligence", icon: GraduationCap },
  { suffix: "/human-potential-intelligence", label: "Human Potential", icon: BrainCircuit },
] as const;

const workspaceLinks = [
  ...transformLinks,
  ...operationsLinks,
  ...intelligenceLinks,
] as const;

const dailyLinks = [transformLinks[0], operationsLinks[0], operationsLinks[1], operationsLinks[2], operationsLinks[21]] as const;
const navigationGroups = [
  { title: "Leadership", icon: Gauge, links: [...transformLinks.slice(1), operationsLinks[3], operationsLinks[29], intelligenceLinks[0]] },
  { title: "People & roles", icon: UsersRound, links: [...operationsLinks.slice(4, 10), operationsLinks[22]] },
  { title: "Learning", icon: GraduationCap, links: [...operationsLinks.slice(10, 13), intelligenceLinks[1]] },
  { title: "Human potential", icon: Sparkles, links: [...operationsLinks.slice(13, 19), intelligenceLinks[2]] },
  { title: "Culture & care", icon: ShieldCheck, links: [...operationsLinks.slice(19, 21), operationsLinks[24], operationsLinks[28]] },
  { title: "Institution", icon: LibraryBig, links: [operationsLinks[25], operationsLinks[26], operationsLinks[27], operationsLinks[23]] },
] as const;

function NavigationGroup({ group, base, pathname, onNavigate }: {
  group: (typeof navigationGroups)[number]; base: string; pathname: string; onNavigate?: () => void;
}) {
  const active = group.links.some((link) => isActive(pathname, base, link.suffix));
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (active && detailsRef.current) detailsRef.current.open = true; }, [active]);
  const Icon = group.icon;
  return <details ref={detailsRef} className="group rounded-xl border border-transparent open:border-white/10 open:bg-white/5">
    <summary className={`flex cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold marker:hidden hover:bg-white/8 ${active ? "text-mint-300" : "text-slate-300"}`}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />{group.title}<ChevronDown className="ml-auto size-4 transition group-open:rotate-180" aria-hidden="true" />
    </summary>
    <div className="space-y-0.5 px-2 pb-2 pl-5">{group.links.map((item) => <WorkspaceLink key={item.suffix} base={base} pathname={pathname} onNavigate={onNavigate} {...item} />)}</div>
  </details>;
}

function NavigationGroups({ base, pathname, onNavigate }: {
  base: string; pathname: string; onNavigate?: () => void;
}) {
  return <div className="space-y-1">{navigationGroups.map((group) => <NavigationGroup key={group.title} group={group} base={base} pathname={pathname} onNavigate={onNavigate} />)}</div>;
}

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
  onNavigate,
}: {
  base: string;
  pathname: string;
  suffix: string;
  label: string;
  icon: (typeof workspaceLinks)[number]["icon"];
  onNavigate?: () => void;
}) {
  const href = `${base}${suffix}`;
  const active = isActive(pathname, base, suffix);

  return (
    <Link
      href={href}
      onClick={onNavigate}
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
  const [menuOpen, setMenuOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const current = workspaceLinks.find((item) => isActive(pathname, base, item.suffix));
  const moreActive = !dailyLinks.slice(0, 4).some((item) => isActive(pathname, base, item.suffix));

  useEffect(() => {
    if (!menuOpen) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = oldOverflow; window.removeEventListener("keydown", escape); };
  }, [menuOpen]);

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
          <p className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Daily</p>
          <div className="mt-2 space-y-1">{dailyLinks.map((item) => <WorkspaceLink key={item.suffix || "home"} base={base} pathname={pathname} {...item} />)}</div>
          <div className="my-4 border-t border-white/10" />
          <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Areas</p>
          <NavigationGroups base={base} pathname={pathname} />
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
              <span className="block truncate text-xs font-extrabold">{current?.label || "School Workspace"}</span>
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
        <div className="grid grid-cols-5 border-t border-white/10">
            {dailyLinks.slice(0, 4).map((item) => {
              const href = `${base}${item.suffix}`;
              const active = isActive(pathname, base, item.suffix);
              const Icon = item.icon;
              return (
                <Link
                  key={item.suffix || "command-centre"}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  className={`flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-[10px] font-bold transition ${
                    active
                      ? "text-mint-300"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="w-full truncate text-center">{["Home", "Work", "Issues", "Decisions"][dailyLinks.indexOf(item)]}</span>
                </Link>
              );
            })}
            <button type="button" aria-expanded={menuOpen} aria-controls="school-more-menu" onClick={() => setMenuOpen(true)} className={`flex flex-col items-center gap-1 px-1 py-2 text-[10px] font-bold ${moreActive ? "text-mint-300" : "text-slate-300"}`}><Menu className="size-4" />More</button>
        </div>
      </nav>
      {menuOpen && <div className="fixed inset-0 z-[80] xl:hidden">
        <button type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-slate-950/70" />
        <div id="school-more-menu" role="dialog" aria-modal="true" aria-label="All school areas" className="absolute inset-y-0 right-0 flex w-[min(90vw,22rem)] flex-col bg-slate-950 text-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4"><h2 className="font-bold">All school areas</h2><button ref={closeRef} type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="rounded-lg border border-white/15 p-2"><X className="size-5" /></button></div>
          <nav aria-label="All school areas" className="flex-1 overflow-y-auto p-3"><WorkspaceLink base={base} pathname={pathname} onNavigate={() => setMenuOpen(false)} {...dailyLinks[4]} /><div className="my-3 border-t border-white/10" /><NavigationGroups base={base} pathname={pathname} onNavigate={() => setMenuOpen(false)} /></nav>
          <div className="flex gap-2 border-t border-white/10 p-3 text-xs"><Link href="/account" className="rounded-lg border border-white/15 p-2" onClick={() => setMenuOpen(false)}>Account</Link><Link href="/khpos" className="rounded-lg border border-white/15 p-2" onClick={() => setMenuOpen(false)}>Access Hub</Link></div>
        </div>
      </div>}
    </>
  );
}
