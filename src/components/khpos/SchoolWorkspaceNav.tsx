"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { NotificationBell } from "@/components/khpos/NotificationBell";
import { useActiveNavScroll } from "@/components/khpos/useActiveNavScroll";
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
  LibraryBig,
  Rocket,
  ListTodo,
  LogOut,
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
  { suffix: "/ideas", label: "Ideas & discussions", icon: UsersRound },
  { suffix: "/meetings", label: "Private meetings", icon: UsersRound },
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
  { suffix: "/staff-accountability", label: "Staff queries & praise", icon: Gavel },
  { suffix: "/staff-transition", label: "Staff changes & leaving", icon: GitBranch },
  { suffix: "/academic-delivery", label: "Teaching plans", icon: GraduationCap },
  { suffix: "/teaching-presence", label: "Attendance & lessons", icon: BookOpen },
  { suffix: "/visitors", label: "Gate & visitors", icon: ShieldCheck },
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
  operationsLinks.find(link => link.suffix === "/work")!,
  operationsLinks.find(link => link.suffix === "/teaching-presence")!,
  operationsLinks.find(link => link.suffix === "/reports")!,
  operationsLinks.find(link => link.suffix === "/announcements")!,
] as const;

// Resolve destinations by route, not array position, so regrouping cannot silently
// move an unrelated workflow into the wrong school area.
function operation(suffix: (typeof operationsLinks)[number]["suffix"]) {
  return operationsLinks.find((link) => link.suffix === suffix)!;
}
// Related pages share one entrance. Existing URLs remain valid, including saved links.
const byRoute = (suffix: string) => workspaceLinks.find(link => link.suffix === suffix)!;
const schoolAreas = [
  { title: "Meetings & updates", help: "Read announcements and join private meetings.", routes: ["/announcements", "/meetings", "/ideas"] },
  { title: "Reports & forms", help: "Complete your reports here. Forms and checklists are saved with the task that requested them.", routes: ["/reports", "/records"] },
  { title: "Staff & roles", help: "Manage staff, roles, hiring and professional support.", routes: ["/people", "/team", "/onboarding", "/recruitment", "/staff-performance", "/staff-accountability", "/staff-transition"] },
  { title: "School day & gate", help: "Sign in and out, record classes, request movement permission, and register visitors.", routes: ["/teaching-presence", "/availability", "/visitors"] },
  { title: "Teaching & planning", help: "Use the school calendar, organise lessons, manage assessments and support learners.", routes: ["/calendar", "/academic-delivery", "/academic-assurance", "/learner-progress"] },
  { title: "Learner development", help: "Record learners' interests, skills, projects and preparation for life after school.", routes: ["/potential-development", "/skills-development", "/leadership-financial", "/young-ceo", "/builder-projects", "/worldready", "/builders-council"] },
  { title: "Parents", help: "Follow up with current families and track new enquiries through admission.", routes: ["/parents", "/parent-journeys"] },
  { title: "School improvement", help: "Choose priorities, carry out the plan, add proof and review what changed.", routes: ["/priorities", "/implementation", "/evidence", "/reviews", "/improvement", "/playbooks"] },
  { title: "School results", help: "See progress, prepare leadership meetings and check school-level summaries.", routes: ["/performance", "/leadership-brief", "/network-pulse", "/benchmarking", "/learning-intelligence", "/human-potential-intelligence"] },
  { title: "Schools & campuses", help: "Find your schools, manage locations, events and equipment, and check campus readiness.", routes: ["/schools-campuses", "/campus-readiness", "/assets", "/events"] },
  { title: "School settings", help: "Complete school setup, adopt the KAEC Standard and set up tasks. These changes require the right permissions.", routes: ["/activation", "/standard", "/execution-control", "/system-integrity"] },
] as const;
const navigationGroups = [
  { title: "Work & approvals", icon: CheckCircle2, description: "Tasks that need a decision or follow-up", links: [operation("/issues"), operation("/decisions")] },
  { title: "People & gate", icon: UsersRound, description: "Staff, outings and visitors", links: [operation("/people"), operation("/availability"), operation("/visitors")] },
  { title: "Teaching & learners", icon: GraduationCap, description: "Lessons, assessment and learner growth", links: [calendarLink, operation("/potential-development")] },
  { title: "Care & families", icon: ShieldCheck, description: "Wellbeing, safeguarding and parents", links: [operation("/student-culture"), operation("/safeguarding"), operation("/parents")] },
  { title: "Leadership & schools", icon: Building2, description: "Improvement, results and school settings", links: [byRoute("/priorities"), operation("/performance"), operation("/schools-campuses"), activationLink] },
  { title: "Resources & help", icon: LibraryBig, description: "Policies, guides and training", links: [operation("/library"), askKhposLink] },
] as const;
const areaEntrances: Record<string,string> = {"/announcements":"Meetings & updates","/reports":"Reports & forms","/people":"Staff & roles","/teaching-presence":"School day & gate","/potential-development":"Learner development","/priorities":"School improvement","/performance":"School results","/activation":"School settings"};
const displayLabel = (suffix:string,label:string) => areaEntrances[suffix] ?? label;
const primarySuffix = (suffix:string) => schoolAreas.find(area => (area.routes as readonly string[]).includes(suffix))?.routes[0] ?? suffix;
function matchesSearch(suffix:string,label:string,query:string) {
  const area = schoolAreas.find(area => area.routes[0] === suffix);
  const aliases: Record<string,string> = {"/work":"home school dashboard school overview today school home","/teaching-presence":"check in check out sign in sign out roll call timetable HQLS school day lesson","/visitors":"visitor guest gate register tablet kiosk admission exit sign in sign out","/reports":"daily weekly monthly termly logs reports","/availability":"movement permission outing errand school gate brief exit return today early departure leave cover absence","/people":"staff teachers employees positions appointments leave absence cover queries staff query discipline","/library":"policies rules procedures SOP tools forms","/activation":"school setup getting started readiness","/priorities":"transformation plan school improvement priorities"};
  const text = [label, aliases[suffix], areaEntrances[suffix], area?.title, area?.help, ...(area?.routes.map(route => byRoute(route).label) ?? [])].join(" ").toLowerCase();
  return query.toLowerCase().trim().split(/\s+/).filter(Boolean).every(term => text.includes(term));
}

function NavigationGroup({ group, base, pathname, onNavigate }: {
  group: (typeof navigationGroups)[number]; base: string; pathname: string; onNavigate?: () => void;
}) {
  const active = group.links.some(link => isActive(pathname, base, link.suffix) || workspaceLinks.some(page => primarySuffix(page.suffix) === link.suffix && isActive(pathname,base,page.suffix)));
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (active && detailsRef.current) detailsRef.current.open = true; }, [active]);
  const Icon = group.icon;
  return <details ref={detailsRef} className="group rounded-2xl border border-white/8 bg-white/[0.025] open:border-white/15 open:bg-white/[0.055]">
    <summary className={`flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold marker:hidden hover:bg-white/8 ${active ? "text-mint-300" : "text-slate-200"}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5"><Icon className="size-4" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><span className="block">{group.title}</span><span className="mt-0.5 block text-[11px] font-medium leading-4 text-slate-400">{group.description}</span></span>
      <ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" aria-hidden="true" />
    </summary>
    <div className="space-y-0.5 px-2 pb-2 pl-4">{group.links.map((item) => <WorkspaceLink key={item.suffix} base={base} pathname={pathname} onNavigate={onNavigate} {...item} />)}</div>
  </details>;
}

function NavigationGroups({ base, pathname, onNavigate }: {
  base: string; pathname: string; onNavigate?: () => void;
}) {
  const [query, setQuery] = useState("");
  const results = workspaceLinks.filter(link => matchesSearch(link.suffix,link.label,query));
  return <div className="space-y-3">
    <label className="block px-1 text-xs font-bold text-slate-300">Find a page
      <span className="relative mt-2 block"><Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-slate-400" />
        <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search pages, movement, visitors…" className="min-h-11 w-full rounded-xl border border-white/20 bg-white/5 py-2 pl-9 pr-3 text-base text-white placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-mint-300" />
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
  const active = isActive(pathname, base, suffix) || (!exactLabel && workspaceLinks.some(link => primarySuffix(link.suffix) === suffix && isActive(pathname,base,link.suffix)));

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`khpos-nav-link group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
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
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const current = workspaceLinks.find((item) => isActive(pathname, base, item.suffix));
  const isDailyActive = (suffix: string) => workspaceLinks.some(link => primarySuffix(link.suffix) === suffix && isActive(pathname, base, link.suffix));
  const moreActive = !dailyLinks.some((item) => isDailyActive(item.suffix));

  async function signOut() {
    const client = createBrowserSupabaseClient();
    if (!client || signingOut) return;
    setSigningOut(true);
    setSignOutError("");
    try {
      const response = await fetch("/api/kshc/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Session could not be cleared.");
      const { error } = await client.auth.signOut();
      if (error) throw error;
      window.location.replace("/khpos");
    } catch {
      setSignOutError("Could not sign out. Check your connection and try again.");
      setSigningOut(false);
    }
  }

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
      <aside className="khpos-nav-panel fixed inset-y-0 left-0 z-[60] hidden w-72 flex-col border-r border-white/10 bg-slate-950 text-white shadow-2xl xl:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="mb-3 flex justify-end"><NotificationBell key={organisationId} organisationId={organisationId} /></div>
          <Link href={`${base}/work`} className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mint-300 text-slate-950 shadow-sm">
              <Image src="/khpos-icon-192.png" alt="" width={40} height={40} className="rounded-xl" />
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
          <p className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Your everyday tools</p>
          <div className="mt-2 space-y-1">{dailyLinks.map((item) => <WorkspaceLink key={item.suffix || "home"} base={base} pathname={pathname} {...item} />)}</div>
          <div className="my-4 border-t border-white/10" />
          <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Browse school areas</p>
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
          <button type="button" onClick={() => void signOut()} disabled={signingOut} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-3 text-xs font-bold text-slate-300 hover:bg-white/10 disabled:opacity-50"><LogOut aria-hidden="true" className="size-4" />{signingOut ? "Signing out…" : "Sign out"}</button>
          {signOutError && <p role="alert" className="mt-2 text-xs text-rose-200">{signOutError}</p>}
          <p className="mt-3 px-1 text-[10px] leading-4 text-slate-500">
            School operations by KAEC-NG.
          </p>
        </div>
      </aside>

      <nav
        aria-label="KHP-OS school workspace"
        className="khpos-mobile-header sticky top-0 z-[60] border-b border-slate-800 bg-slate-950/96 text-white shadow-lg xl:hidden"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3 sm:px-6">
          <Link href={`${base}/work`} className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-mint-300 text-slate-950">
              <Image src="/khpos-icon-192.png" alt="" width={32} height={32} className="rounded-lg" />
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
            {/* Account and main-entrance links live in the More drawer, not twice in the mobile header. */}
          </div>
        </div>
        <div className="khpos-mobile-tabs fixed inset-x-0 bottom-0 z-[65] grid grid-cols-5 border-t border-white/10 bg-slate-950">
            {dailyLinks.slice(0, 4).map((item) => {
              const href = `${base}${item.suffix}`;
              const active = isDailyActive(item.suffix);
              const Icon = item.icon;
              return (
                <Link
                  key={item.suffix || "command-centre"}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 border-t-2 px-1 py-2 text-[11px] font-bold transition ${
                    active
                      ? "border-mint-300 bg-white/10 text-mint-300"
                      : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <span className="w-full truncate text-center">{["Today", "School day", "Reports", "Updates"][dailyLinks.indexOf(item)]}</span>
                </Link>
              );
            })}
            <button type="button" aria-label="More school areas" aria-expanded={menuOpen} aria-controls="school-more-menu" onClick={() => setMenuOpen(true)} className={`flex min-h-14 flex-col items-center justify-center gap-1 border-t-2 px-1 py-2 text-[11px] font-bold ${moreActive ? "border-mint-300 bg-white/10 text-mint-300" : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"}`}><Menu className="size-5" aria-hidden="true" />More</button>
        </div>
      </nav>
      {menuOpen && <div className="fixed inset-0 z-[80] xl:hidden">
        <button type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-slate-950/70" />
        <div ref={dialogRef} id="school-more-menu" role="dialog" aria-modal="true" aria-label="Explore KHP-OS" className="khpos-nav-panel absolute inset-y-0 right-0 flex w-[min(90vw,22rem)] flex-col bg-slate-950 text-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4"><div><h2 className="text-lg font-extrabold">Explore KHP-OS</h2><p className="mt-1 text-xs text-slate-400">Find what you need without guessing.</p></div><button ref={closeRef} type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="min-h-11 min-w-11 rounded-lg border border-white/15 p-2"><X className="size-5" /></button></div>
          <nav aria-label="Find your way" className="flex-1 overflow-y-auto p-3"><NavigationGroups base={base} pathname={pathname} onNavigate={() => setMenuOpen(false)} /></nav>
          {signOutError && <p role="alert" className="px-3 text-xs text-rose-200">{signOutError}</p>}
          <button type="button" onClick={() => void signOut()} disabled={signingOut} className="mx-3 mb-2 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-bold disabled:opacity-50"><LogOut aria-hidden="true" className="size-4" />{signingOut ? "Signing out…" : "Sign out"}</button>
          <div className="khpos-mobile-more-footer flex gap-2 border-t border-white/10 p-3 text-xs"><Link href="/account" className="flex min-h-11 items-center rounded-lg border border-white/15 px-3 py-2" onClick={() => setMenuOpen(false)}>Account</Link><Link href="/khpos" className="flex min-h-11 items-center rounded-lg border border-white/15 px-3 py-2" onClick={() => setMenuOpen(false)}>Main entrance</Link></div>
        </div>
      </div>}
    </>
  );
}

export function SchoolAreaNavigation({organisationId}:{organisationId:string}) {
  const pathname = usePathname(), router = useRouter(), base = `/khpos/${organisationId}`;
  const tabsRef = useActiveNavScroll<HTMLElement>(pathname);
  const area = schoolAreas.find(item => item.routes.some(route=>isActive(pathname,base,route)));
  const current = workspaceLinks.find(link => isActive(pathname,base,link.suffix));
  const breadcrumb = <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
    <Link href={`${base}/work`} className="inline-flex min-h-9 items-center font-bold text-brand-700 hover:underline">Today</Link>
    {current?.suffix && current.suffix !== "/work" && <><span aria-hidden="true">/</span><span aria-current="page" className="font-semibold text-slate-700">{current.label}</span></>}
    <Link href={`${base}/ask`} className="ml-auto inline-flex min-h-11 items-center font-semibold text-brand-700 underline" title="Open Ask KHP-OS and Training Academy">Help & training</Link>
  </nav>;
  if (!area) return <div className="border-b border-slate-200 bg-white px-4 sm:px-6"><div className="mx-auto max-w-7xl">{breadcrumb}</div></div>;
  return <section className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6" aria-label={area.title}>
    <div className="mx-auto max-w-7xl">{breadcrumb}<p className="text-sm font-bold text-slate-950">{area.title}</p><p className="mt-1 hidden max-w-3xl text-sm leading-6 text-slate-600 sm:block">{area.help}</p>
      <label className="mt-3 block text-xs font-bold text-slate-600 sm:hidden">Go to a page in {area.title}
        <select aria-label={`${area.title} pages`} value={area.routes.find(route=>isActive(pathname,base,route))} onChange={event=>router.push(`${base}${event.target.value}`)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-950">{area.routes.map(route=><option key={route} value={route}>{byRoute(route).label}</option>)}</select>
      </label>
      <nav ref={tabsRef} aria-label={`${area.title} pages`} className="khpos-area-tabs mt-3 hidden gap-2 overflow-x-auto pb-1 sm:flex">{area.routes.map(route=>{const link=byRoute(route), active=isActive(pathname,base,route);return <Link key={route} href={`${base}${route}`} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-bold transition ${active ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50"}`}>{link.label}</Link>;})}</nav>
    </div>
  </section>;
}
