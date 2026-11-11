"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, FileText, Gauge, Loader2, ShieldCheck, Target } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposWorkspaceSnapshot } from "@/lib/khpos/workspace";

/**
 * The unique school-health content from the former School Overview.
 * Lazy by design: the everyday Today queue never waits for a diagnostic request.
 * KSHC scores and learner-related evidence stay behind the existing server
 * canViewHealthReport capability; they are not loaded from an unscoped API.
 */
export function SchoolHealthSummary({ organisationId }: { organisationId: string }) {
  const [workspace, setWorkspace] = useState<KhposWorkspaceSnapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [openingReport, setOpeningReport] = useState(false);
  const [reportError, setReportError] = useState("");
  const pending = useRef(false);

  async function loadSummary() {
    if (pending.current || workspace) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const supabase = createBrowserSupabaseClient();
      if (!supabase) throw new Error("KHP-OS sign-in is not configured.");
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session has ended. Sign in again to continue.");
      const response = await fetch("/api/khpos/workspace/" + organisationId, {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
      });
      const body = (await response.json()) as {
        ok?: boolean;
        workspace?: KhposWorkspaceSnapshot;
        error?: string;
      };
      if (!response.ok || !body.ok || !body.workspace) {
        throw new Error(body.error || "School health information could not be loaded.");
      }
      setWorkspace(body.workspace);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The school information could not be loaded.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function openReport(event: React.MouseEvent<HTMLAnchorElement>, assessmentId: string) {
    event.preventDefault();
    if (openingReport) return;
    setOpeningReport(true);
    setReportError("");
    try {
      const supabase = createBrowserSupabaseClient();
      if (!supabase) throw new Error("KHP-OS sign-in is not configured.");
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in again to open your school report.");
      const response = await fetch("/api/kshc/session", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      });
      if (!response.ok) throw new Error("Your report session could not be confirmed.");
      window.location.assign("/report/" + assessmentId);
    } catch (cause) {
      setReportError(cause instanceof Error ? cause.message : "The School Health Check report could not be opened.");
      setOpeningReport(false);
    }
  }

  const baseline = workspace?.baseline;
  const priorityCount = workspace?.transformation.activePriorityCount ?? 0;

  return (
    <details
      id="today-school-health"
      className="khpos-interface-card group overflow-hidden scroll-mt-24"
      onToggle={(event) => {
        if (event.currentTarget.open) void loadSummary();
      }}
    >
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 p-5 text-base font-extrabold text-slate-950 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600 sm:p-6">
        <span>
          <span className="block">School health & improvement</span>
          <span className="mt-1 block text-sm font-medium leading-6 text-slate-600">
            School Health Check, approved priorities, school setup and improvement progress
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-xl font-black text-brand-700 transition group-open:rotate-45">+</span>
      </summary>
      <div className="space-y-5 border-t border-slate-200 p-4 sm:p-6">
        {busy && <p role="status" className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading school information…</p>}
        {error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p role="alert" className="text-sm font-semibold text-amber-900">{error}</p>
          <button type="button" onClick={() => void loadSummary()} className="mt-3 min-h-11 rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white">Try again</button>
        </div>}
        {workspace && <>
          <p className="text-sm text-slate-600">
            <strong className="text-slate-950">{workspace.organisation.name}</strong>
            {" · "}{workspace.organisation.schoolType || "School"}
            {workspace.organisation.schoolLevel ? " · " + workspace.organisation.schoolLevel : ""}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workspace.canViewHealthReport && <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <Gauge className="size-5 text-brand-700" aria-hidden="true" />
              <p className="mt-3 text-xs font-black uppercase tracking-wide text-slate-600">First School Health Check</p>
              <p className="mt-1 text-3xl font-black text-slate-950">{baseline?.overallScore ?? "—"}{baseline?.overallScore != null && <span className="ml-1 text-sm font-semibold text-slate-600">/100</span>}</p>
              <p className="mt-2 text-sm text-slate-600">{baseline?.healthRating || "Health check not completed"}</p>
              {baseline && <Link
                href={"/report/" + baseline.assessmentId}
                prefetch={false}
                onClick={(event) => void openReport(event, baseline.assessmentId)}
                aria-disabled={openingReport}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white hover:bg-brand-800"
              >
                {openingReport ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileText className="size-4" aria-hidden="true" />}
                {openingReport ? "Opening report…" : "View health report"}
              </Link>}
              {reportError && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{reportError}</p>}
            </article>}
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <Target className="size-5 text-amber-700" aria-hidden="true" />
              <p className="mt-3 text-xs font-black uppercase tracking-wide text-slate-600">Approved school priorities</p>
              <p className="mt-1 text-3xl font-black text-slate-950">{priorityCount}<span className="ml-1 text-sm font-semibold text-slate-600">/3</span></p>
              <p className="mt-2 text-sm text-slate-600">Leadership-approved actions, not automatic suggestions.</p>
              <Link href={"/khpos/" + organisationId + "/priorities"} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-700 hover:underline">View priorities <ArrowRight className="size-4" aria-hidden="true" /></Link>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <Building2 className="size-5 text-mint-700" aria-hidden="true" />
              <p className="mt-3 text-xs font-black uppercase tracking-wide text-slate-600">School setup</p>
              <p className="mt-1 text-lg font-black text-slate-950">Keep operations ready</p>
              <p className="mt-2 text-sm text-slate-600">Roles, safeguarding, policies and operating processes.</p>
              <Link href={"/khpos/" + organisationId + "/activation"} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-700 hover:underline">Open school setup <ArrowRight className="size-4" aria-hidden="true" /></Link>
            </article>
          </div>

          {workspace.canViewHealthReport && workspace.priorityAreas.length > 0 && <section aria-labelledby="health-priorities-heading">
            <h3 id="health-priorities-heading" className="text-lg font-extrabold text-slate-950">Diagnostic priorities</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-3">{workspace.priorityAreas.slice(0, 3).map((area, index) => <div key={area.title + index} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-extrabold text-slate-950">{index + 1}. {area.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{area.why}</p>
              <p className="mt-2 text-sm leading-6 text-slate-700"><strong>First step:</strong> {area.firstStep}</p>
            </div>)}</div>
          </section>}

          {workspace.canViewHealthReport && workspace.departmentScores.length > 0 && <details className="rounded-2xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-bold text-brand-800">View 11 School Health Check areas</summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{workspace.departmentScores.map(area => <div key={area.chapter} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3"><span className="text-sm font-semibold text-slate-700">{area.title}</span><span className="text-sm font-black tabular-nums text-slate-950">{area.score}%</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-brand-700" style={{ width: Math.max(0, Math.min(100, area.score)) + "%" }} /></div>
            </div>)}</div>
          </details>}

          <details className="rounded-2xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-bold text-brand-800">View the school improvement journey</summary>
            <ol className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {["Diagnose", "Interpret", "Prioritise", "Intervene", "Implement", "Evidence", "Review", "Reassess", "Improve"].map((stage, index) => (
                <li key={stage} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-xs font-black text-brand-700">Step {index + 1}</span>
                  <span className="mt-1 block text-sm font-bold text-slate-800">{stage}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-slate-600">The sequence guides improvement. Individual steps become complete only when the appropriate evidence and approvals are recorded.</p>
          </details>

          <div className="flex flex-wrap gap-3">
            <Link href={"/khpos/" + organisationId + "/improvement"} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-bold text-brand-800 hover:bg-brand-100">Review improvement <ArrowRight className="size-4" aria-hidden="true" /></Link>
            <Link href={"/khpos/" + organisationId + "/playbooks"} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Step-by-step guides</Link>
          </div>
          {!workspace.canViewHealthReport && <p className="flex items-start gap-2 text-sm text-slate-600"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />School Health Check reports and detailed diagnostics are available only to authorised school leaders.</p>}
        </>}
      </div>
    </details>
  );
}
