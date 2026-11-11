"use client";

import { LoadingScreen } from "@/components/navigation/LoadingScreen";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PortfolioSystemHealth } from "./PortfolioSystemHealth";
import {
  ArrowLeft,
  Building2,
  CircleAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposPortfolioIntelligence, KhposPortfolioObservabilityInstitution } from "@/lib/khpos/benchmarking";
import type { NetworkAgentPlan } from "@/lib/khpos/agentic/plan";
import { composeNetworkSupportDigest } from "@/lib/khpos/writing-assistant";

const attentionLabels: Record<string, string> = {
  baseline_required: "Baseline required",
  regression: "Regression detected",
  critical_priorities: "Critical priorities",
  reassessment_required: "Reassessment required",
  monitor: "Monitor",
};

const institutionMetrics = [
  { label: "Failed triggers (7 days)", value: (school: KhposPortfolioObservabilityInstitution) => school.failedTriggers7d },
  { label: "Overdue work items", value: (school: KhposPortfolioObservabilityInstitution) => school.overdueWork },
  { label: "Verification overdue", value: (school: KhposPortfolioObservabilityInstitution) => school.staleVerification },
  { label: "Critical processes unmapped", value: (school: KhposPortfolioObservabilityInstitution) => school.p0Unmapped },
  { label: "Routines", value: (school: KhposPortfolioObservabilityInstitution) => `${school.activeRoutines} active · ${school.pausedRoutines} paused` },
];

const standardLabels = {
  current: "Current",
  pending_adoption: "Pending adoption",
  missing: "Missing",
};

function StandardStatus({ status }: { status: KhposPortfolioObservabilityInstitution["standardStatus"] }) {
  const color = status === "current" ? "bg-emerald-50 text-emerald-800"
    : status === "pending_adoption" ? "bg-amber-50 text-amber-900"
      : "bg-red-50 text-red-800";
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{standardLabels[status]}</span>;
}

export function PortfolioIntelligenceWorkspace() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [portfolio, setPortfolio] = useState<KhposPortfolioIntelligence | null>(null);
  const [agentPlan, setAgentPlan] = useState<NetworkAgentPlan | null>(null);
  const [hqDigest,setHqDigest]=useState("");
  const [copyMessage,setCopyMessage]=useState("");

  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return;
        const token = data.session?.access_token;
        if (!token) {
          setError("Your session has ended. Sign in again to continue.");
          return;
        }
        const response = await fetch("/api/khpos/portfolio", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body = (await response.json()) as {
          ok?: boolean;
          portfolio?: KhposPortfolioIntelligence;
          agentPlan?: NetworkAgentPlan;
          error?: string;
        };
        if (!active) return;
        if (!response.ok || !body.ok || !body.portfolio) {
          setError(body.error ?? "Network summary could not be loaded.");
          return;
        }
        setPortfolio(body.portfolio);
        setAgentPlan(body.agentPlan ?? null);
        setError("");
      })
      .catch((caught) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Network summary could not be loaded.",
        );
      });

    return () => {
      active = false;
    };
  }, [supabase]);

  if (!portfolio && !error) {
    return <LoadingScreen />;
  }

  if (!portfolio) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <ShieldCheck className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Network summary unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            This view is reserved for explicitly authorised KHP-OS platform custodians. School membership alone never grants cross-institution access.
          </p>
        </div>
      </main>
    );
  }

  const summary = portfolio.summary;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6">
          <Link
            href="/khpos/admin"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white"
          >
            <ArrowLeft className="size-4" /> Admin Dashboard
          </Link>
          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-mint-300">
                KHP-OS | KAEC-NG Network summary
              </p>
              <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
                Schools that need support
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                Internal platform-custodian oversight across participating institutions. This is not a public leaderboard and contains no learner-level data or evidence content.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Portfolio</p>
              <p className="mt-1 text-2xl font-black">{summary.activeInstitutions} active institutions</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ["Active institutions", summary.activeInstitutions],
            ["With baseline", summary.institutionsWithBaseline],
            ["With reassessment", summary.institutionsWithReassessment],
            ["Verified improvement", summary.verifiedImprovementInstitutions],
            ["Active priorities", summary.activePriorities],
            ["Critical priorities", summary.criticalPriorities],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-black">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                Portfolio observability
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Is the operating network healthy enough to scale?
              </h2>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-500">
                See schools that need help with setup, failed automatic tasks, overdue work, delayed reviews or procedures without task settings. Private learner records and evidence content are not shown.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-950 p-4 text-white">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Current standard
              </p>
              <p className="mt-1 font-black">
                {portfolio.observability.release?.code ?? "No active release"}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["On current standard", portfolio.observability.summary.currentStandard],
              ["Pending adoption", portfolio.observability.summary.pendingAdoption],
              ["Missing standard", portfolio.observability.summary.missingInstallation],
              ["Trigger failures · 7d", portfolio.observability.summary.failedTriggers7d],
              ["P0 processes unmapped", portfolio.observability.summary.p0Unmapped],
              ["Overdue work items", portfolio.observability.summary.overdueWork],
              ["Stale verification", portfolio.observability.summary.staleVerification],
              ["Paused routines", portfolio.observability.summary.pausedRoutines],
              ["Active routines", portfolio.observability.summary.activeRoutines],
              ["Eligible institutions", portfolio.observability.summary.eligibleInstitutions],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-black">{value}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm text-slate-600">
            Overdue work items are open tasks past their due date. Standard adoption is tracked separately.
          </p>

          <ul aria-label="Institution operations" className="mt-3 grid gap-3 sm:grid-cols-2 lg:hidden">
            {portfolio.observability.institutions.map((school) => (
              <li key={school.organisationId} className="min-w-0 rounded-2xl border border-slate-200 p-4">
                <h3 className="text-base font-black">{school.name}</h3>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <dt className="text-xs font-semibold text-slate-600">Standard adoption</dt>
                    <dd className="mt-1"><StandardStatus status={school.standardStatus} /></dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-slate-600">Attention</dt>
                    <dd className="mt-1 text-sm font-bold capitalize">{school.attention}</dd>
                  </div>
                  {institutionMetrics.map(({ label, value }) => (
                    <div key={label} className="rounded-xl bg-slate-50 p-2.5 last:col-span-2">
                      <dt className="text-xs font-semibold text-slate-600">{label}</dt>
                      <dd className="mt-1 text-sm font-black tabular-nums">{value(school)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>

          <div className="mt-3 hidden overflow-x-auto rounded-2xl border border-slate-200 lg:block">
            <table aria-label="Institution operations" className="w-full min-w-[52rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Institution</th>
                  <th scope="col" className="px-4 py-3">Standard adoption</th>
                  {institutionMetrics.map(({ label }) => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {portfolio.observability.institutions.map((school) => (
                  <tr key={school.organisationId}>
                    <th scope="row" className="px-4 py-4">
                      <div className="flex items-start gap-2">
                        {school.attention === "standard"
                          ? <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                          : <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-700" />}
                        <div>
                          <p className="font-black">{school.name}</p>
                          <p className="mt-1 text-xs font-semibold capitalize text-slate-600">{school.attention}</p>
                        </div>
                      </div>
                    </th>
                    <td className="px-4 py-4"><StandardStatus status={school.standardStatus} /></td>
                    {institutionMetrics.map(({ label, value }) => (
                      <td key={label} className="whitespace-nowrap px-4 py-4 font-bold tabular-nums">{value(school)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {agentPlan && (
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-label="Network support priorities">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Phase 4 · KAEC network intelligence</p>
                <h2 className="mt-2 text-2xl font-black">Which schools should HQ support first?</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Ranked from existing operating records and KSHC outcomes. This is a Pathfinder planning aid, not a public school ranking or an instruction to make unapproved changes.
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">No model tokens</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["Schools examined", agentPlan.summary.schoolsScanned],
                ["Need human review", agentPlan.summary.needsHumanReview],
                ["Critical support cases", agentPlan.summary.critical],
              ].map(([label,value]) => (
                <div key={String(label)} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-600">{label}</p>
                  <p className="mt-1 text-2xl font-black">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50 p-4">
              <h3 className="font-black text-brand-950">Confidential Pathfinder support digest · No AI tokens</h3>
              <p className="mt-2 text-xs text-brand-900">Prepare a private HQ follow-up summary using existing network evidence. It is never published or sent to partner schools automatically.</p>
              <button type="button" className="mt-3 rounded-xl bg-brand-800 px-4 py-2 text-sm font-bold text-white"
                onClick={()=>{setHqDigest(composeNetworkSupportDigest(agentPlan));setCopyMessage("");}}>
                Prepare HQ digest
              </button>
              {hqDigest&&<div className="mt-3 space-y-2">
                <textarea aria-label="Editable confidential HQ digest" rows={12} className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
                  value={hqDigest} onChange={e=>setHqDigest(e.target.value)}/>
                <button type="button" className="rounded-xl border border-brand-300 bg-white px-3 py-2 text-sm font-bold" onClick={async()=>{
                  try{await navigator.clipboard.writeText(hqDigest);setCopyMessage("Digest copied.");}
                  catch{setCopyMessage("Copy unavailable. Select the text above to copy manually.");}
                }}>Copy private digest</button>
                {copyMessage&&<p role="status" className="text-xs text-brand-900">{copyMessage}</p>}
              </div>}
            </div>
            <ol className="mt-5 grid gap-3 md:grid-cols-2">
              {agentPlan.actions.map((item,index) => (
                <li key={item.organisationId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-black uppercase text-brand-700">
                    {index+1}. {item.priority} support priority
                  </p>
                  <h3 className="mt-2 text-lg font-black">{item.schoolName}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{item.reasons.join("; ")}</p>
                  <p className="mt-3 text-sm"><strong>Suggested HQ next step:</strong> {item.proposedNextStep}</p>
                  <p className="mt-2 text-xs text-slate-600">{item.evidenceToCheck}</p>
                  <Link href={item.href} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-brand-800">
                    Review portfolio record <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ol>
            {!agentPlan.actions.length && (
              <p className="mt-5 text-sm text-emerald-900">No exception-triggered school support is currently identified by the available records.</p>
            )}
            <p className="mt-5 text-xs leading-5 text-slate-500">{agentPlan.caveat}</p>
          </section>
        )}

        <PortfolioSystemHealth systems={portfolio.systems} />

        <section id="portfolio-institutions" className="scroll-mt-40 rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Institution portfolio</p>
              <h2 className="mt-2 text-2xl font-black">Named internal oversight</h2>
            </div>
            <p className="max-w-xl text-xs leading-5 text-slate-500">
              Names appear only in this privileged KAEC-NG view so the platform custodian can support institutions. They never appear in another school&apos;s benchmark response.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-black">Institution</th>
                  <th className="px-6 py-4 font-black">Current score</th>
                  <th className="px-6 py-4 font-black">Change</th>
                  <th className="px-6 py-4 font-black">Priorities</th>
                  <th className="px-6 py-4 font-black">Attention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {portfolio.institutions.map((institution) => (
                  <tr key={institution.organisationId} className="align-top">
                    <td className="px-6 py-5">
                      <div className="flex items-start gap-3">
                        <Building2 className="mt-0.5 size-5 shrink-0 text-brand-700" />
                        <div>
                          <p className="font-black">{institution.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {[institution.city, institution.state, institution.country].filter(Boolean).join(", ") || "Location not configured"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 font-black">{institution.currentOverallScore ?? "—"}</td>
                    <td className="px-6 py-5">
                      <div className="inline-flex items-center gap-2">
                        <TrendingUp className="size-4 text-slate-400" />
                        <span className="font-bold">{institution.deltaFromBaseline ?? "—"}</span>
                      </div>
                      {institution.verifiedImprovement && (
                        <p className="mt-1 text-xs font-black text-emerald-700">Verified improvement</p>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-black">{institution.activePriorityCount}</p>
                      <p className="text-xs text-slate-500">{institution.criticalPriorityCount} critical</p>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${institution.attention === "monitor" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
                        {institution.attention !== "monitor" && <CircleAlert className="size-3.5" />}
                        {attentionLabels[institution.attention] ?? institution.attention}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
          <ShieldCheck className="size-8 text-mint-300" />
          <h2 className="mt-4 text-xl font-black">Use the summary to decide which schools need support.</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
            This view excludes learner-level data, teacher rankings, raw evidence, uploaded files and private narrative content. It exists to help KAEC-NG identify where school transformation support is required. Public ranking remains disabled.
          </p>
        </section>
      </div>
    </main>
  );
}
