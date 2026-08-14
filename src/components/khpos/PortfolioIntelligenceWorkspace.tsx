"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CircleAlert,
  Gauge,
  Loader2,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposPortfolioIntelligence } from "@/lib/khpos/benchmarking";

const systemLabels: Record<string, string> = {
  identity_direction: "Identity & Direction",
  learning_mastery: "Learning & Mastery",
  capability_development: "Capability Development",
  value_creation_application: "Value Creation & Application",
  human_development_ecosystem: "Human Development Ecosystem",
  institutional_excellence: "Institutional Excellence",
  intelligence_continuous_improvement: "Intelligence & Continuous Improvement",
};

const attentionLabels: Record<string, string> = {
  baseline_required: "Baseline required",
  regression: "Regression detected",
  critical_priorities: "Critical priorities",
  reassessment_required: "Reassessment required",
  monitor: "Monitor",
};

export function PortfolioIntelligenceWorkspace() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [portfolio, setPortfolio] = useState<KhposPortfolioIntelligence | null>(null);
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
          error?: string;
        };
        if (!active) return;
        if (!response.ok || !body.ok || !body.portfolio) {
          setError(body.error ?? "Portfolio Intelligence could not be loaded.");
          return;
        }
        setPortfolio(body.portfolio);
        setError("");
      })
      .catch((caught) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Portfolio Intelligence could not be loaded.",
        );
      });

    return () => {
      active = false;
    };
  }, [supabase]);

  if (!portfolio && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <Loader2 className="size-9 animate-spin text-mint-300" />
      </main>
    );
  }

  if (!portfolio) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <ShieldCheck className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Portfolio Intelligence unavailable</h1>
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
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white"
          >
            <ArrowLeft className="size-4" /> KSHC / KHP-OS
          </Link>
          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-mint-300">
                KHP-OS | KAEC-NG Portfolio Intelligence
              </p>
              <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
                Where does the transformation portfolio need attention?
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

        <section>
          <div className="flex items-end justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Portfolio system health</p>
              <h2 className="mt-2 text-2xl font-black">Seven-system distribution across institutions</h2>
            </div>
            <Gauge className="hidden size-8 text-brand-700 sm:block" />
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {portfolio.systems.map((system) => (
              <article key={system.systemId} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-black">{systemLabels[system.systemId] ?? system.systemId}</h3>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                    n={system.institutionCount}
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-slate-100 p-4">
                    <p className="text-[11px] font-bold text-slate-500">P25</p>
                    <p className="mt-1 text-xl font-black">{system.p25}</p>
                  </div>
                  <div className="rounded-2xl bg-brand-50 p-4">
                    <p className="text-[11px] font-bold text-brand-700">Median</p>
                    <p className="mt-1 text-xl font-black text-brand-950">{system.median}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 p-4">
                    <p className="text-[11px] font-bold text-slate-500">P75</p>
                    <p className="mt-1 text-xl font-black">{system.p75}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white shadow-sm">
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
            <table className="min-w-full text-left text-sm">
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
          <h2 className="mt-4 text-xl font-black">Portfolio intelligence is stewardship, not surveillance.</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
            This view excludes learner-level data, teacher rankings, raw evidence, uploaded files and private narrative content. It exists to help KAEC-NG identify where institutional transformation support is required. Public ranking remains disabled.
          </p>
        </section>
      </div>
    </main>
  );
}
