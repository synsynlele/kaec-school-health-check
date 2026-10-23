"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NotificationBell } from "@/components/khpos/NotificationBell";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";
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
  Search,
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
  { suffix: "", label: "School overview", icon: LayoutDashboard },
  { suffix: "/priorities", label: "Priorities", icon: Target },
  { suffix: "/implementation", label: "Action plan", icon: Workflow },
  { suffix: "/playbooks", label: "Step-by-step guides", icon: BookOpen },
  { suffix: "/evidence", label: "Evidence & proof", icon: FileCheck2 },
  { suffix: "/reviews", label: "Review progress", icon: Gauge },
  { suffix: "/improvement", label: "Check improvement", icon: Activity },
] as const;

const activationLink = {
  suffix: "/activation",
  label: "School setup",
  icon: ShieldCheck,
} as const;

const executionControlLink = {
  suffix: "/execution-control",
  label: "Task setup",
  icon: Workflow,
} as const;

const leadershipBriefLink = {
  suffix: "/leadership-brief",
  label: "Meeting brief",
  icon: BriefcaseBusiness,
} as const;

const calendarLink = {
  suffix: "/calendar",
  label: "Calendar",
  icon: CalendarClock,
} as const;

const askKhposLink = {
  suffix: "/ask",
  label: "Ask KHP-OS",
  icon: BrainCircuit,
} as const;

const onboardingLink = {
  suffix: "/onboarding",
  label: "My getting started",
  icon: UserRoundCheck,
} as const;

const systemIntegrityLink = {
  suffix: "/system-integrity",
  label: "System checks",
  icon: ShieldCheck,
} as const;

const standardLink = {
  suffix: "/standard",
  label: "KAEC Standard",
  icon: LibraryBig,
} as const;

const operationsLinks = [
  { suffix: "/reports", label: "Reports", icon: FileCheck2 },
  { suffix: "/announcements", label: "Announcements", icon: MessageCircle },
  { suffix: "/work", label: "Today", icon: ListTodo },
  { suffix: "/issues", label: "Issues & help", icon: AlertTriangle },
  { suffix: "/decisions", label: "Approvals & decisions", icon: CheckCircle2 },
  { suffix: "/performance", label: "School results", icon: BarChart3 },
  { suffix: "/people", label: "Staff", icon: UserRoundCheck },
  { suffix: "/recruitment", label: "Hiring", icon: BriefcaseBusiness },
  { suffix: "/availability", label: "Leave & cover", icon: CalendarClock },
  { suffix: "/staff-performance", label: "Staff support", icon: FileCheck2 },
  { suffix: "/staff-accountability", label: "Staff concerns & praise", icon: Gavel },
  { suffix: "/staff-transition", label: "Staff changes & leaving", icon: GitBranch },
  { suffix: "/academic-delivery", label: "Teaching plans", icon: GraduationCap },
  { suffix: "/teaching-presence", label: "Attendance & lessons", icon: BookOpen },
  { suffix: "/academic-assurance", label: "Assessments & exams", icon: ShieldCheck },
  { suffix: "/learner-progress", label: "Learner support", icon: UserRoundSearch },
  { suffix: "/potential-development", label: "Learner development", icon: Sparkles },
  { suffix: "/skills-development", label: "Skills", icon: Wrench },
  { suffix: "/leadership-financial", label: "Leadership & money", icon: CircleDollarSign },
  { suffix: "/young-ceo", label: "Young CEO Hub", icon: Rocket },
  { suffix: "/builder-projects", label: "Builder Projects", icon: Hammer },
  { suffix: "/worldready", label: "Life after school", icon: Compass },
  { suffix: "/builders-council", label: "Builders Council", icon: UsersRound },
  { suffix: "/student-culture", label: "Behaviour & wellbeing", icon: UserRoundCheck },
  { suffix: "/safeguarding", label: "Safeguarding", icon: ShieldCheck },
  { suffix: "/team", label: "Roles & sections", icon: UsersRound },
  { suffix: "/library", label: "School library", icon: LibraryBig },
  { suffix: "/parents", label: "Parents", icon: MessageCircle },
  { suffix: "/schools-campuses", label: "Schools & Campuses", icon: Building2 },
  { suffix: "/campus-readiness", label: "Campus checks", icon: Building2 },
  { suffix: "/assets", label: "Equipment & repairs", icon: Wrench },
  { suffix: "/events", label: "Events & Programmes", icon: CalendarClock },
  { suffix: "/parent-journeys", label: "Enquiries & admissions", icon: MessageCircle },
  { suffix: "/network-pulse", label: "Campus summary", icon: Gauge },
  { suffix: "/records", label: "Forms & checklists", icon: FileCheck2 },
] as const;

const intelligenceLinks = [
  { suffix: "/benchmarking", label: "School comparisons", icon: Gauge },
  { suffix: "/learning-intelligence", label: "Learning summary", icon: GraduationCap },
  { suffix: "/human-potential-intelligence", label: "Development summary", icon: BrainCircuit },
] as const;

const workspaceLinks = [
  ...transformLinks,
  activationLink,
  executionControlLink,
  leadershipBriefLink,
  calendarLink,
  askKhposLink,
  onboardingLink,
  systemIntegrityLink,
  standardLink,
  ...operationsLinks,
  ...intelligenceLinks,
] as const;

// Daily actions stay visible on both desktop and mobile. Setup belongs in More.
const dailyLinks = [
  transformLinks[0],
  operationsLinks.find(link => link.suffix === "/work")!,
  operationsLinks.find(link => link.suffix === "/issues")!,
  operationsLinks.find(link => link.suffix === "/decisions")!,
] as const;

// Resolve destinations by route, not array position, so regrouping cannot silently
// move an unrelated workflow into the wrong school area.
function operation(suffix: (typeof operationsLinks)[number]["suffix"]) {
  return operationsLinks.find((link) => link.suffix === suffix)!;
}
// Related pages share one entrance. Existing URLs remain valid, including saved links.
const byRoute = (suffix: string) => workspaceLinks.find(link => link.suffix === suffix)!;
const schoolAreas = [
  { title: "Reports & forms", help: "Complete your reports here. Forms and checklists are saved with the task that requested them.", routes: ["/reports", "/records"] },
  { title: "Staff & roles", help: "Add staff, assign positions and help your team get started. Use the other tabs for hiring, leave and staff support.", routes: ["/people", "/team", "/onboarding", "/recruitment", "/availability", "/staff-performance", "/staff-accountability", "/staff-transition"] },
  { title: "Teaching & learning", help: "Check attendance, plan lessons, manage assessments and support learners.", routes: ["/teaching-presence", "/academic-delivery", "/academic-assurance", "/learner-progress"] },
  { title: "Learner development", help: "Record learners' interests, skills, projects and preparation for life after school.", routes: ["/potential-development", "/skills-development", "/leadership-financial", "/young-ceo", "/builder-projects", "/worldready"] },
  { title: "Parents", help: "Follow up with current families and track new enquiries through admission.", routes: ["/parents", "/parent-journeys"] },
  { title: "School improvement", help: "Choose priorities, carry out the plan, add proof and review what changed.", routes: ["/priorities", "/implementation", "/evidence", "/reviews", "/improvement", "/playbooks"] },
  { title: "School results", help: "See progress, prepare leadership meetings and check school-level summaries.", routes: ["/performance", "/leadership-brief", "/network-pulse", "/benchmarking", "/learning-intelligence", "/human-potential-intelligence"] },
  { title: "Schools & campuses", help: "Find your schools, request a campus and check whether a campus is ready.", routes: ["/schools-campuses", "/campus-readiness"] },
  { title: "School settings", help: "Complete school setup, adopt the KAEC Standard and set up tasks. These changes require the right permissions.", routes: ["/activation", "/standard", "/execution-control", "/system-integrity"] },
] as const;
const navigationGroups = [
  { title: "Everyday work", icon: ListTodo, links: [operation("/reports"), operation("/announcements"), calendarLink, operation("/library"), askKhposLink] },
  { title: "Staff & teaching", icon: UsersRound, links: [operation("/people"), operation("/teaching-presence"), operation("/potential-development")] },
  { title: "Care & families", icon: ShieldCheck, links: [operation("/student-culture"), operation("/safeguarding"), operation("/parents"), operation("/builders-council")] },
  { title: "School management", icon: Building2, links: [byRoute("/priorities"), operation("/performance"), operation("/schools-campuses"), operation("/assets"), operation("/events"), activationLink] },
] as const;
const areaEntrances: Record<string,string> = {"/reports":"Reports & forms","/people":"Staff & roles","/teaching-presence":"Teaching & learning","/potential-development":"Learner development","/priorities":"School improvement","/performance":"School results","/activation":"School settings"};
const displayLabel = (suffix:string,label:string) => areaEntrances[suffix] ?? label;
const primarySuffix = (suffix:string) => schoolAreas.find(area => (area.routes as readonly string[]).includes(suffix))?.routes[0] ?? suffix;
function matchesSearch(suffix:string,label:string,query:string) {
  const area = schoolAreas.find(area => area.routes[0] === suffix);
  const aliases: Record<string,string> = {"/teaching-presence":"check in check out sign in sign out roll call timetable HQLS","/reports":"daily weekly monthly termly logs reports","/people":"staff teachers employees positions appointments","/library":"policies rules procedures SOP tools forms","/activation":"school setup getting started readiness","/priorities":"transformation plan school improvement priorities"};
  const text = [label, aliases[suffix], areaEntrances[suffix], area?.title, area?.help, ...(area?.routes.map(route => byRoute(route).label) ?? [])].join(" ").toLowerCase();
  return query.toLowerCase().trim().split(/\s+/).filter(Boolean).every(term => text.includes(term));
}

function NavigationGroup({ group, base, pathname, onNavigate }: {
  group: (typeof navigationGroups)[number]; base: string; pathname: string; onNavigate?: () => void;
}) {
  const active = group.links.some(link => workspaceLinks.some(page => primarySuffix(page.suffix) === link.suffix && isActive(pathname,base,page.suffix)));
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
  const [query, setQuery] = useState("");
  const results = workspaceLinks.filter(link => link.suffix && matchesSearch(link.suffix,link.label,query));
  return <div className="space-y-3">
    <label className="block px-1 text-xs font-bold text-slate-300">Find a page
      <span className="relative mt-2 block"><Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-slate-400" />
        <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Try reports, leave or lessons" className="min-h-11 w-full rounded-xl border border-white/20 bg-white/5 py-2 pl-9 pr-3 text-base text-white placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-mint-300" />
      </span>
    </label>
    {query.trim() ? <div aria-live="polite"><p className="px-3 py-2 text-xs text-slate-400">{results.length} pages found</p>{results.map(link=><WorkspaceLink key={link.suffix} base={base} pathname={pathname} onNavigate={onNavigate} {...link} exactLabel />)}{!results.length && <p className="p-3 text-sm text-slate-300">No page found. Try a shorter word, or clear your search to browse.</p>}</div> : navigationGroups.map(group=><NavigationGroup key={group.title} group={group} base={base} pathname={pathname} onNavigate={onNavigate} />)}
  </div>;
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
  exactLabel = false,
}: {
  base: string;
  pathname: string;
  suffix: string;
  label: string;
  icon: (typeof workspaceLinks)[number]["icon"];
  onNavigate?: () => void;
  exactLabel?: boolean;
}) {
  const href = `${base}${suffix}`;
  const active = exactLabel ? isActive(pathname, base, suffix) : workspaceLinks.some(link => primarySuffix(link.suffix) === suffix && isActive(pathname,base,link.suffix));

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
      <span className="min-w-0 break-words">{exactLabel ? label : displayLabel(suffix,label)}</span>
    </Link>
  );
}

export function SchoolWorkspaceNav({ organisationId }: { organisationId: string }) {
  const pathname = usePathname();
  const base = `/khpos/${organisationId}`;
  const [menuOpen, setMenuOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const current = workspaceLinks.find((item) => isActive(pathname, base, item.suffix));
  const moreActive = !dailyLinks.slice(0, 4).some((item) => isActive(pathname, base, item.suffix));

  useEffect(() => {
    const client = createBrowserSupabaseClient();
    if (!client) return;
    let mounted = true;
    const sync = async (token: string | undefined) => {
      if (!mounted || !token) return;
      await fetch("/api/kshc/session", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
    };
    void client.auth.getSession().then(({ data }) => sync(data.session?.access_token));
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") window.setTimeout(() => void sync(session?.access_token), 0);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('a[href],button,input,summary') ?? []).filter(node => node.getClientRects().length > 0);
      const first=focusable[0], last=focusable.at(-1);
      if (event.shiftKey && document.activeElement===first) {event.preventDefault();last?.focus();}
      else if (!event.shiftKey && document.activeElement===last) {event.preventDefault();first?.focus();}
    };
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = oldOverflow; window.removeEventListener("keydown", escape); previousFocus?.focus(); };
  }, [menuOpen]);

  return (
    <>
      <a href="#school-page" className="sr-only fixed left-3 top-3 z-[100] rounded-xl bg-white p-3 font-bold text-slate-950 focus:not-sr-only">Skip to page content</a>
      <aside className="fixed inset-y-0 left-0 z-[60] hidden w-72 flex-col border-r border-white/10 bg-slate-950 text-white shadow-2xl xl:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="mb-3 flex justify-end"><NotificationBell key={organisationId} organisationId={organisationId} /></div>
          <Link href={base} className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mint-300 text-slate-950 shadow-sm">
              <Building2 className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-mint-300">
                KHP-OS | Schools
              </span>
              <span className="mt-0.5 block truncate text-sm font-extrabold text-white">
                My school
              </span>
            </span>
          </Link>
        </div>

        <nav aria-label="KHP-OS school workspace" className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Daily</p>
          <div className="mt-2 space-y-1">{dailyLinks.map((item) => <WorkspaceLink key={item.suffix || "home"} base={base} pathname={pathname} {...item} />)}</div>
          <div className="my-4 border-t border-white/10" />
          <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">School areas</p>
          <NavigationGroups base={base} pathname={pathname} />
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/account"
              className="rounded-xl border border-white/10 px-3 py-2.5 text-center text-xs font-bold text-slate-300 transition hover:bg-white/8 hover:text-white"
            >
              My account
            </Link>
            <Link
              href="/khpos"
              className="rounded-xl border border-white/10 px-3 py-2.5 text-center text-xs font-bold text-slate-300 transition hover:bg-white/8 hover:text-white"
            >
              Main entrance
            </Link>
          </div>
          <p className="mt-3 px-1 text-[10px] leading-4 text-slate-500">
            School operations by KAEC-NG.
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
              <span className="block truncate text-xs font-extrabold">{current?.label || "My school"}</span>
            </span>
          </Link>
          <div className="flex shrink-0 gap-2">
            <NotificationBell key={organisationId} organisationId={organisationId} mobile />
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
                  <span className="w-full truncate text-center">{["Overview", "Today", "Issues", "Approvals"][dailyLinks.indexOf(item)]}</span>
                </Link>
              );
            })}
            <button type="button" aria-expanded={menuOpen} aria-controls="school-more-menu" onClick={() => setMenuOpen(true)} className={`flex flex-col items-center gap-1 px-1 py-2 text-[10px] font-bold ${moreActive ? "text-mint-300" : "text-slate-300"}`}><Menu className="size-4" />More</button>
        </div>
      </nav>
      {menuOpen && <div className="fixed inset-0 z-[80] xl:hidden">
        <button type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-slate-950/70" />
        <div ref={dialogRef} id="school-more-menu" role="dialog" aria-modal="true" aria-label="Find your way" className="absolute inset-y-0 right-0 flex w-[min(90vw,22rem)] flex-col bg-slate-950 text-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4"><h2 className="font-bold">Find your way</h2><button ref={closeRef} type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="min-h-11 min-w-11 rounded-lg border border-white/15 p-2"><X className="size-5" /></button></div>
          <nav aria-label="Find your way" className="flex-1 overflow-y-auto p-3"><NavigationGroups base={base} pathname={pathname} onNavigate={() => setMenuOpen(false)} /></nav>
          <div className="flex gap-2 border-t border-white/10 p-3 text-xs"><Link href="/account" className="rounded-lg border border-white/15 p-2" onClick={() => setMenuOpen(false)}>Account</Link><Link href="/khpos" className="rounded-lg border border-white/15 p-2" onClick={() => setMenuOpen(false)}>Main entrance</Link></div>
        </div>
      </div>}
    </>
  );
}

export function SchoolAreaNavigation({organisationId}:{organisationId:string}) {
  const pathname = usePathname(), router = useRouter(), base = `/khpos/${organisationId}`;
  const area = schoolAreas.find(item => item.routes.some(route=>isActive(pathname,base,route)));
  if (!area) return null;
  return <section className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6" aria-label={area.title}>
    <div className="mx-auto max-w-7xl"><p className="text-sm font-bold text-slate-950">{area.title}</p><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{area.help}</p>
      <label className="mt-3 block text-xs font-bold text-slate-600 sm:hidden">Go to a page in {area.title}
        <select aria-label={`${area.title} pages`} value={area.routes.find(route=>isActive(pathname,base,route))} onChange={event=>router.push(`${base}${event.target.value}`)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-950">{area.routes.map(route=><option key={route} value={route}>{byRoute(route).label}</option>)}</select>
      </label>
      <nav aria-label={`${area.title} pages`} className="mt-3 hidden flex-wrap gap-2 sm:flex">{area.routes.map(route=>{const link=byRoute(route), active=isActive(pathname,base,route);return <Link key={route} href={`${base}${route}`} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-xl border px-3 py-2 text-sm font-bold ${active ? "border-brand-700 bg-brand-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{link.label}</Link>;})}</nav>
    </div>
  </section>;
}
