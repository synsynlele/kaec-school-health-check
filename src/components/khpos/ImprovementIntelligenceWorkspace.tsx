"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Gauge,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposImprovementWorkspace } from "@/lib/khpos/improvement";

const SYSTEM_NAMES: Record<string, string> = {
  identity_direction: "Identity & Direction",
  learning_mastery: "Learning & Mastery",
  capability_development: "Capability Development",
  value_creation_application: "Value Creation & Application",
  human_development_ecosystem: "Human Development Ecosystem",
  institutional_excellence: "Institutional Excellence",
  intelligence_continuous_improvement: "Intelligence & Continuous Improvement",
};

function readable(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function delta(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function changeTone(value: number) {
  if (value >= 5) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (value <= -5) return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function outcomeTone(outcome: string) {
  if (outcome === "resolved") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (outcome === "improving") return "border-brand-200 bg-brand-50 text-brand-800";
  if (outcome === "regressed") return "border-red-200 bg-red-50 text-red-800";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export function ImprovementIntelligenceWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] = useState<KhposImprovementWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const token = data.session?.access_token;
      if (!token) {
        setError("Your session has ended. Sign in again to continue.");
        return;
      }

      const response = await fetch(`/api/khpos/improvement/${organisationId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = (await response.json()) as {
        ok?: boolean;
        workspace?: KhposImprovementWorkspace;
        error?: string;
      };
      if (!active) return;
      if (!response.ok || !body.ok || !body.workspace) {
        setError(body.error ?? "Improvement intelligence could not be loaded.");
        return;
      }
      setWorkspace(body.workspace);
      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  async function beginReassessment() {
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session has ended. Sign in again to continue.");

      const response = await fetch(`/api/khpos/improvement/${organisationId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "start_reassessment" }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        reassessment?: { assessmentId: string; sequence: number | null; resumed: boolean };
        error?: string;
      };
      if (!response.ok || !body.ok || !body.reassessment?.assessmentId) {
        throw new Error(body.error ?? "Reassessment could not be started.");
      }

      localStorage.setItem("kaec_assessment_id", body.reassessment.assessmentId);
      sessionStorage.setItem("khpos_return_to", `/khpos/${organisationId}/improvement`);
      window.location.assign("/assessment");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reassessment could not be started.");
      setBusy(false);
    }
  }

  if (!workspace && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-mint-300" />
          <p className="mt-4 text-sm font-semibold text-slate-300">Calculating institutional change…</p>
        </div>
      </main>
    );
  }

  if (error && !workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <ShieldCheck className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Improvement intelligence unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <Link href={`/khpos/${organisationId}`} className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950">
            Return to Command Centre
          </Link>
        </div>
      </main>
    );
  }

  if (!workspace) return null;

  const latest = workspace.latest;
  const canStart = workspace.membership.canStartReassessment;
  const inProgress = workspace.inProgress;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
          <Link href={`/khpos/${organisationId}`} className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white">
            <ArrowLeft className="size-4" /> Command Centre
          </Link>
          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-mint-300">KHP-OS | Reassessment & Improvement Intelligence</p>
              <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
                Did the institution actually get better?
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                KHP-OS compares fresh KSHC evidence with the original baseline and previous assessment, then updates priorities and the next operating cycle automatically.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Institution</p>
              <p className="mt-1 max-w-xs truncate text-lg font-black">{workspace.organisation.name}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <CircleAlert className="mt-0.5 size-5 shrink-0" /> {error}
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Reassessment control</p>
            <h2 className="mt-2 text-2xl font-black">Fresh institutional truth, same KSHC framework.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              School identity, framework, baseline linkage and comparison logic are handled automatically. The reassessment asks only the 55 KSHC indicators again so the new claim is based on fresh evidence rather than implementation activity.
            </p>
            {inProgress && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Reassessment {inProgress.sequence ?? ""} is in progress · {inProgress.answeredCount}/55 indicators answered.
              </div>
            )}
            {canStart ? (
              <button
                type="button"
                onClick={beginReassessment}
                disabled={busy}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                {inProgress ? "Resume reassessment" : "Start KSHC reassessment"}
                {!busy && <ArrowRight className="size-4" />}
              </button>
            ) : (
              <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                You can view improvement intelligence. An Executive or Transformation Lead starts a new institutional reassessment.
              </p>
            )}
          </div>

          <div className="rounded-[30px] bg-slate-950 p-6 text-white shadow-sm sm:p-8">
            <Gauge className="size-7 text-mint-300" />
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Verified improvement rule</p>
            <p className="mt-2 text-xl font-black">Implementation is not improvement.</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              KHP-OS only marks verified institutional improvement when the fresh KSHC score improves meaningfully and more indicators improve than regress. Individual priorities require their own maturity threshold before resolution.
            </p>
          </div>
        </section>

        {!latest ? (
          <section className="rounded-[30px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Target className="mx-auto size-9 text-slate-400" />
            <h2 className="mt-4 text-2xl font-black">Your baseline is preserved. No reassessment has completed yet.</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Once a reassessment is completed, KHP-OS will automatically calculate all 55 indicator changes, 11 area changes, seven system changes and every active priority outcome.
            </p>
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase text-slate-400">Baseline</p>
                <p className="mt-2 text-4xl font-black">{latest.baselineOverallScore?.toFixed(1) ?? "—"}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase text-slate-400">Current</p>
                <p className="mt-2 text-4xl font-black">{latest.reassessmentOverallScore?.toFixed(1) ?? "—"}</p>
              </div>
              <div className={`rounded-3xl border p-5 shadow-sm ${changeTone(latest.deltaFromBaseline ?? 0)}`}>
                <p className="text-xs font-black uppercase opacity-70">Change from baseline</p>
                <p className="mt-2 text-4xl font-black">{delta(latest.deltaFromBaseline)}</p>
              </div>
              <div className={`rounded-3xl border p-5 shadow-sm ${latest.verifiedImprovement ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-900"}`}>
                <p className="text-xs font-black uppercase opacity-70">Institutional finding</p>
                <p className="mt-2 text-lg font-black capitalize">{readable(latest.classification)}</p>
                <p className="mt-2 text-xs font-bold">{latest.verifiedImprovement ? "Verified improvement" : "No verified improvement claim"}</p>
              </div>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">55-indicator movement</p>
                  <h2 className="mt-2 text-2xl font-black">What changed across the diagnostic evidence</h2>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-black">
                  <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">{latest.improvedIndicatorCount} improved</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">{latest.stableIndicatorCount} stable</span>
                  <span className="rounded-full bg-red-100 px-3 py-1.5 text-red-800">{latest.regressedIndicatorCount} regressed</span>
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">11 KSHC areas</p>
                <h2 className="mt-2 text-2xl font-black">Area-level change</h2>
                <div className="mt-5 space-y-3">
                  {workspace.areaChanges.map((area) => (
                    <div key={area.chapter} className={`rounded-2xl border p-4 ${changeTone(area.deltaFromBaseline)}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-black capitalize">{readable(area.chapter)}</p>
                          <p className="mt-1 text-xs opacity-70">{area.baselineScore.toFixed(1)} → {area.reassessmentScore.toFixed(1)}</p>
                        </div>
                        <span className="text-lg font-black">{delta(area.deltaFromBaseline)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Seven institutional systems</p>
                <h2 className="mt-2 text-2xl font-black">System-level change</h2>
                <div className="mt-5 space-y-3">
                  {workspace.systemChanges.map((system) => (
                    <div key={system.systemId} className={`rounded-2xl border p-4 ${changeTone(system.deltaFromBaseline)}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-black">{SYSTEM_NAMES[system.systemId] ?? readable(system.systemId)}</p>
                          <p className="mt-1 text-xs opacity-70">{system.baselineScore.toFixed(1)} → {system.reassessmentScore.toFixed(1)}</p>
                        </div>
                        <span className="text-lg font-black">{delta(system.deltaFromBaseline)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {!!workspace.priorityOutcomes.length && (
              <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Priority outcomes</p>
                <h2 className="mt-2 text-2xl font-black">What KHP-OS does next</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  Priority status is updated from the fresh indicator result. Resolved priorities close; improving but unresolved priorities continue automatically; regression returns the problem to leadership review.
                </p>
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {workspace.priorityOutcomes.map((outcome) => (
                    <div key={outcome.priorityId} className={`rounded-2xl border p-5 ${outcomeTone(outcome.outcome)}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase opacity-70">{outcome.sourceIndicatorId}</p>
                          <p className="mt-1 text-lg font-black capitalize">{outcome.outcome}</p>
                        </div>
                        {outcome.scoreDelta > 0 ? <TrendingUp className="size-5" /> : outcome.scoreDelta < 0 ? <TrendingDown className="size-5" /> : <Sparkles className="size-5" />}
                      </div>
                      <p className="mt-4 text-sm font-bold">Score {outcome.sourceScore} → {outcome.reassessmentScore}</p>
                      <p className="mt-2 text-xs leading-5 opacity-80">Next: {readable(outcome.nextState)}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <section className="rounded-[30px] border border-brand-100 bg-brand-50 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-brand-700" />
            <div>
              <h2 className="text-xl font-black text-slate-950">Historical truth is preserved.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                KHP-OS never overwrites the baseline or previous assessment. Every reassessment remains versioned, attributable and reconstructable, including the exact priority outcome it produced.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}