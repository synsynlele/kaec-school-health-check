"use client";

import { LoadingScreen } from "@/components/navigation/LoadingScreen";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  Circle,
  DoorOpen,
  FileCheck2,
  FileText,
  Gauge,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Target,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposWorkspaceSnapshot } from "@/lib/khpos/workspace";
import type { KhposAttentionSnapshot } from "@/lib/khpos/ops/attention";

const TRANSFORMATION_STAGES = [
  "Diagnose",
  "Interpret",
  "Prioritise",
  "Intervene",
  "Implement",
  "Evidence",
  "Review",
  "Reassess",
  "Improve",
];

export function CommandCentre({ organisationId }: { organisationId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] = useState<KhposWorkspaceSnapshot | null>(null);
  const [attention, setAttention] = useState<KhposAttentionSnapshot | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [reportError, setReportError] = useState("");
  const [openingReport, setOpeningReport] = useState(false);

  async function openReport(event: React.MouseEvent<HTMLAnchorElement>, assessmentId: string) {
    event.preventDefault();
    if (!supabase || openingReport) return;
    setOpeningReport(true);
    setReportError("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error("Please sign in again to open the report.");
      const response = await fetch("/api/kshc/session", {
        method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      if (!response.ok) throw new Error("Your report session could not be confirmed. Please sign in again.");
      window.location.assign(`/report/${assessmentId}`);
    } catch (cause) {
      setReportError(cause instanceof Error ? cause.message : "The report could not be opened.");
      setOpeningReport(false);
    }
  }

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        const accessToken = data.session?.access_token;
        if (!accessToken) {
          setError("Your session has ended. Sign in again to open your school.");
          return;
        }
        const headers = { Authorization: `Bearer ${accessToken}` };
        // The primary workspace must not wait for the optional attention feed.
        const response = await fetch(`/api/khpos/workspace/${organisationId}`, {
          headers, cache: "no-store",
        });
        const body = (await response.json()) as {
          ok?: boolean; workspace?: KhposWorkspaceSnapshot; error?: string;
        };
        if (!active) return;
        if (!response.ok || !body.ok || !body.workspace) {
          setError(body.error ?? "The KHP-OS workspace could not be loaded.");
          return;
        }
        setWorkspace(body.workspace);
        setError("");

        // Fetch secondary intelligence after the school is already visible.
        void fetch(`/api/khpos/ops/attention/${organisationId}`, {
          headers, cache: "no-store",
        }).then(async attentionResponse => {
          if (!attentionResponse.ok) return;
          const attentionBody = (await attentionResponse.json()) as {
            ok?: boolean; attention?: KhposAttentionSnapshot;
          };
          if (active && attentionBody.ok && attentionBody.attention) {
            setAttention(attentionBody.attention);
          }
        }).catch(() => {
          // Attention is supplemental; never cover or hide the school overview.
        });
      } catch {
        if (active) setError("The school could not be loaded. Check your connection and try again.");
      }
    })();

    return () => { active = false; };
  }, [organisationId, supabase]);

  if (!workspace && !error) {
    return <LoadingScreen />;
  }

  if (error || !workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <ShieldCheck className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">KHP-OS access could not be confirmed</h1>
          <p className="mt-3 text-sm leading-6 text-slate-200">{error}</p>
          <button onClick={() => router.push("/khpos")} className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950">
            Return to KSHC
          </button>
        </div>
      </main>
    );
  }

  const baseline = workspace.baseline;
  const priorityCount = workspace.transformation.activePriorityCount;
  const location = [workspace.organisation.state, workspace.organisation.country]
    .filter(Boolean)
    .join(", ");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="khpos-hero bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:py-11">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-mint-300/25 bg-mint-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-mint-200">
              School workspace
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold capitalize text-white">
              {workspace.membership.role.replaceAll("_", " ")}
            </span>
          </div>
          <div className="mt-5 grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">{workspace.organisation.name}</h1>
              <p className="mt-3 text-sm font-medium text-brand-100">
                {[workspace.organisation.schoolType, workspace.organisation.schoolLevel, location].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-200 sm:text-base">
                One clear place for your school day, assigned work, reports and school progress.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <Link href={`/khpos/${organisationId}/work`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-mint-300 px-6 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-mint-950/10 transition hover:bg-mint-200">
                Open Today <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href={`/khpos/${organisationId}/teaching-presence`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/15">
                <CalendarCheck2 className="size-4" aria-hidden="true" /> School day
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-7 sm:px-6 sm:py-9">
        <section aria-labelledby="school-start-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">Get things done</p>
              <h2 id="school-start-heading" className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Where would you like to go?</h2>
            </div>
            <Link href={`/khpos/${organisationId}/ask`} className="text-sm font-bold text-brand-700 hover:underline">Need help? Ask KHP-OS</Link>
          </div>
          <nav aria-label="School shortcuts" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { title: "Attendance & lessons", detail: "Arrival, classes and timetable", href: `/khpos/${organisationId}/teaching-presence`, icon: BookOpenCheck },
              { title: "Movement permission", detail: "Ask to leave and return", href: `/khpos/${organisationId}/availability?request=outing`, icon: DoorOpen },
              { title: "My reports", detail: "Write, submit and review", href: `/khpos/${organisationId}/reports`, icon: FileCheck2 },
              { title: "School updates", detail: "Announcements and meetings", href: `/khpos/${organisationId}/announcements`, icon: MessageCircle },
            ].map(({ title, detail, href, icon: Icon }) => (
              <Link key={href} href={href} className="khpos-quick-card group flex min-h-36 flex-col justify-between gap-4 p-4 sm:p-5">
                <span className="flex items-center justify-between gap-2">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <ArrowUpRight className="size-4 text-slate-400 group-hover:text-brand-700" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-extrabold text-slate-950 sm:text-base">{title}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-600">{detail}</span>
                </span>
              </Link>
            ))}
          </nav>
        </section>
        {attention && (
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                  School attention
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {attention.summary.actionRequired > 0
                    ? attention.summary.actionRequired + " things currently need action"
                    : "No immediate action is waiting for you"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Normal operations stay quiet. KHP-OS surfaces exceptions,
                  overdue work, approvals, verification and escalations here.
                </p>
              </div>
              <Link
                href={`/khpos/${organisationId}/work#today-actions`}
                className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-3 text-sm font-bold text-brand-800 hover:bg-brand-100"
              >
                Review what needs attention
                <ArrowRight className="size-4" />
              </Link>
            </div>

            {attention.summary.actionRequired > 0 && <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Critical", value: attention.summary.critical, href: `/khpos/${organisationId}/work#today-actions` },
                { label: "Overdue", value: attention.summary.overdue, href: `/khpos/${organisationId}/work#today-actions` },
                { label: "Blocked", value: attention.summary.blocked, href: `/khpos/${organisationId}/work#today-actions` },
                { label: "Waiting approval", value: attention.summary.waitingApproval, href: `/khpos/${organisationId}/decisions` },
              ].map(({ label, value, href }) => (
                <Link href={href} key={label} className="group rounded-2xl border border-slate-200/80 bg-slate-50 p-4 transition hover:border-brand-300 hover:bg-brand-50/50">
                  <span className="flex items-start justify-between gap-2"><span className="text-xs font-bold text-slate-600">{label}</span><ArrowUpRight className="size-4 text-slate-400 group-hover:text-brand-700" aria-hidden="true" /></span>
                  <span className="mt-2 block text-3xl font-black text-slate-950">{value}</span>
                </Link>
              ))}
            </div>}

            {attention.items.length > 0 && (
              <div className="mt-6 grid gap-3 lg:grid-cols-2">
                {attention.items.slice(0, 5).map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="rounded-2xl border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <div className="flex items-start gap-3">
                      <span className={
                        "mt-1 size-2.5 shrink-0 rounded-full " +
                        (item.severity === "critical"
                          ? "bg-red-600"
                          : item.severity === "high"
                            ? "bg-amber-500"
                            : "bg-brand-600")
                      } />
                      <span className="min-w-0">
                        <span className="block text-xs font-black uppercase tracking-wide text-slate-500">
                          {item.kind.replaceAll("_", " ")}
                        </span>
                        <span className="mt-1 block font-black">{item.title}</span>
                        <span className="mt-1 block text-sm leading-6 text-slate-600">
                          {item.detail}
                        </span>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        <details className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 text-base font-extrabold text-slate-950 marker:hidden hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-500 sm:p-6">
            <span><span className="block">School health & improvement</span><span className="mt-1 block text-sm font-normal text-slate-600">View diagnostics, school setup and the improvement cycle when needed.</span></span>
            <span aria-hidden="true" className="text-brand-700 transition group-open:rotate-45">+</span>
          </summary>
          <div className="space-y-6 border-t border-slate-200 p-4 sm:p-6">
        <section className="grid gap-4 md:grid-cols-3">
          {workspace.canViewHealthReport && <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <Gauge className="size-6 text-brand-700" />
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-600">First School Health Check</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-4xl font-black tracking-tight">{baseline?.overallScore ?? "—"}</span>
              {baseline?.overallScore !== null && baseline?.overallScore !== undefined && <span className="pb-1 text-sm font-bold text-slate-600">/100</span>}
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-700">{baseline?.healthRating ?? "Health check not completed yet"}</p>
            {baseline && (
              <Link
                href={`/report/${baseline.assessmentId}`}
                prefetch={false}
                onClick={(event) => void openReport(event, baseline.assessmentId)}
                aria-disabled={openingReport}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                {openingReport ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                {openingReport ? "Opening report…" : "View School Health Check report"}
                <ArrowRight className="size-4" />
              </Link>
            )}
            {reportError && <p role="alert" className="mt-2 text-sm text-red-700">{reportError}</p>}
          </div>}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <Target className="size-6 text-amber-600" />
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-600">Approved transformation focus</p>
            <p className="mt-2 text-4xl font-black text-slate-900">{priorityCount}<span className="text-lg text-slate-600">/3</span></p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {priorityCount > 0
                ? "Leadership has converted diagnostic evidence into institutional commitments."
                : "Diagnostic signals are not commitments until leadership approves them."}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <Building2 className="size-6 text-mint-700" />
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-600">School record</p>
            <p className="mt-2 text-xl font-black text-slate-900">{workspace.canViewHealthReport ? "First health check saved" : "School workspace active"}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{workspace.canViewHealthReport ? `KSHC framework v${baseline?.frameworkVersion ?? "1.0"} is attached to this permanent school identity.` : "Use your assigned school duties and activities. School Health Reports are reserved for appointed leaders."}</p>
          </div>
        </section>

        <section className="rounded-[30px] border border-brand-200 bg-brand-50 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-700 text-white">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Operational activation</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">Is the school actually ready to run through KHP-OS?</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Installed modules are not enough. Check role coverage, safeguarding designations, critical policies and critical processes from one activation queue.
                </p>
              </div>
            </div>
            <Link
              href={`/khpos/${organisationId}/activation`}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-extrabold text-white"
            >
              Open Activation Centre
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Transformation lifecycle</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">Your first KHP-OS cycle is moving.</h2>
            </div>
            <span className="text-xs font-semibold text-slate-600">AI may propose. Humans decide. The system records.</span>
          </div>
          <div className="mt-7 grid gap-3 md:grid-cols-3 lg:grid-cols-9">
            {TRANSFORMATION_STAGES.map((stage, index) => {
              const done = index <= 1 || (priorityCount > 0 && index === 2);
              const current = priorityCount > 0 ? index === 3 : index === 2;
              return (
                <div key={stage} className={`rounded-2xl border p-3 ${done ? "border-mint-200 bg-mint-50" : current ? "border-brand-200 bg-brand-50" : "border-slate-200 bg-slate-50"}`}>
                  {done ? <CheckCircle2 className="size-4 text-mint-700" /> : <Circle className={`size-4 ${current ? "text-brand-600" : "text-slate-500"}`} />}
                  <p className="mt-2 text-xs font-extrabold text-slate-800">{stage}</p>
                </div>
              );
            })}
          </div>
        </section>

        {workspace.canViewHealthReport && <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Diagnostic signals</p>
                <h2 className="mt-2 text-2xl font-black">What KSHC says deserves leadership attention</h2>
              </div>
              <Target className="size-7 text-brand-700" />
            </div>
            <div className="mt-6 space-y-4">
              {workspace.priorityAreas.slice(0, 3).map((priority, index) => (
                <div key={`${priority.title}-${index}`} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex gap-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-950 text-xs font-black text-white">{index + 1}</span>
                    <div>
                      <p className="font-extrabold text-slate-900">{priority.title}</p>
                      <p className="mt-1.5 text-sm leading-6 text-slate-600">{priority.why}</p>
                      <p className="mt-3 text-sm leading-6"><span className="font-extrabold text-brand-700">Diagnostic first step:</span> <span className="text-slate-700">{priority.firstStep}</span></p>
                    </div>
                  </div>
                </div>
              ))}
              {!workspace.priorityAreas.length && <p className="text-sm text-slate-600">No structured priority areas were stored with this baseline report.</p>}
            </div>
          </div>

          <div className="rounded-[30px] bg-slate-950 p-6 text-white shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint-300">Priority & Intervention Engine</p>
            <h2 className="mt-3 text-2xl font-black">
              {priorityCount > 0 ? "Run the focused transformation agenda." : "Approve the few priorities that matter most."}
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-200">
              KHP-OS suggests improvements from your School Health Check. An authorised leader can approve up to three priorities at a time.
            </p>
            <div className="mt-7 rounded-2xl border border-white/15 bg-white/5 p-5">
              <p className="text-sm font-bold">Focus is a system rule, not a suggestion.</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">Choose up to three priorities from each School Health Check so your team can focus.</p>
            </div>
            <Link
              href={`/khpos/${organisationId}/priorities`}
              className="mt-7 inline-flex items-center gap-2 rounded-full border border-mint-200 bg-mint-300 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-[0_10px_30px_rgb(16_185_129/0.2)] transition hover:bg-mint-200"
            >
              {priorityCount > 0 ? "Open transformation agenda" : "Build transformation agenda"}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>}

        {workspace.canViewHealthReport && !!workspace.departmentScores.length && (
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">First health check details</p>
            <h2 className="mt-2 text-2xl font-black">The 11 KSHC areas preserved as your starting point</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {workspace.departmentScores.map((area) => (
                <div key={area.chapter} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold text-slate-800">{area.title}</p>
                    <span className="text-sm font-black text-slate-900">{area.score}%</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-brand-700" style={{ width: `${Math.max(0, Math.min(100, area.score))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
          </div>
        </details>
      </div>
    </main>
  );
}
