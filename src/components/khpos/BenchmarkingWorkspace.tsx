"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Gauge,
  Loader2,
  LockKeyhole,
  Minus,
  MoveDownRight,
  MoveUpRight,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  BenchmarkPosition,
  BenchmarkSystem,
  KhposBenchmarkWorkspace,
} from "@/lib/khpos/benchmarking";

const systemLabels: Record<string, string> = {
  identity_direction: "Identity & Direction",
  learning_mastery: "Learning & Mastery",
  capability_development: "Capability Development",
  value_creation_application: "Value Creation & Application",
  human_development_ecosystem: "Human Development Ecosystem",
  institutional_excellence: "Institutional Excellence",
  intelligence_continuous_improvement: "Intelligence & Continuous Improvement",
};

function positionCopy(position: BenchmarkPosition) {
  if (position === "above_peer_band") {
    return {
      label: "Above peer middle band",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      icon: MoveUpRight,
    };
  }
  if (position === "below_peer_band") {
    return {
      label: "Below peer middle band",
      className: "border-amber-200 bg-amber-50 text-amber-900",
      icon: MoveDownRight,
    };
  }
  if (position === "within_peer_band") {
    return {
      label: "Within peer middle band",
      className: "border-blue-200 bg-blue-50 text-blue-800",
      icon: Minus,
    };
  }
  return {
    label: "Insufficient peer data",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    icon: LockKeyhole,
  };
}

function SystemCard({ system }: { system: BenchmarkSystem }) {
  const state = positionCopy(system.position);
  const Icon = state.icon;
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            KHP-OS system
          </p>
          <h3 className="mt-2 text-lg font-black">
            {systemLabels[system.systemId] ?? system.systemId}
          </h3>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-black ${state.className}`}>
          <Icon className="size-3.5" /> {state.label}
        </span>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-slate-950 p-4 text-white">
          <p className="text-xs font-bold text-slate-400">Your current score</p>
          <p className="mt-1 text-2xl font-black">{system.ownScore.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-4">
          <p className="text-xs font-bold text-slate-500">Peer median</p>
          <p className="mt-1 text-2xl font-black">{system.peerMedian.toFixed(2)}</p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        Peer middle 50%: {system.peerP25.toFixed(2)}–{system.peerP75.toFixed(2)} · {system.peerCount} qualifying peers.
      </p>
    </article>
  );
}

export function BenchmarkingWorkspace({ organisationId }: { organisationId: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] = useState<KhposBenchmarkWorkspace | null>(null);
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
        const response = await fetch(`/api/khpos/benchmarking/${organisationId}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body = (await response.json()) as {
          ok?: boolean;
          workspace?: KhposBenchmarkWorkspace;
          error?: string;
        };
        if (!active) return;
        if (!response.ok || !body.ok || !body.workspace) {
          setError(body.error ?? "Benchmark Intelligence could not be loaded.");
          return;
        }
        setWorkspace(body.workspace);
        setError("");
      })
      .catch((caught) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Benchmark Intelligence could not be loaded.",
        );
      });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  if (!workspace && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <Loader2 className="size-9 animate-spin text-mint-300" />
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <ShieldCheck className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Benchmark Intelligence unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <Link
            href={`/khpos/${organisationId}`}
            className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950"
          >
            Return to Command Centre
          </Link>
        </div>
      </main>
    );
  }

  const overall = workspace.overall;
  const overallState = overall ? positionCopy(overall.position) : null;
  const OverallIcon = overallState?.icon ?? Gauge;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6">
          <Link
            href={`/khpos/${organisationId}`}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white"
          >
            <ArrowLeft className="size-4" /> Command Centre
          </Link>
          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-mint-300">
                KHP-OS | Benchmark Intelligence
              </p>
              <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
                Context without competition.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                See how your institution sits within an anonymised peer band. KHP-OS never exposes another school&apos;s identity, exact score or rank here.
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
        {workspace.status === "awaiting_baseline" && (
          <section className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-sm">
            <Gauge className="size-9 text-brand-700" />
            <h2 className="mt-4 text-2xl font-black">Complete the institutional baseline first.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Benchmarking starts from the school&apos;s own completed KSHC truth. KHP-OS will not compare an institution before it has a valid baseline.
            </p>
          </section>
        )}

        {workspace.status === "insufficient_peers" && (
          <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <div className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-sm">
              <LockKeyhole className="size-9 text-brand-700" />
              <h2 className="mt-4 text-2xl font-black">Peer benchmark is deliberately withheld.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                KHP-OS requires at least {workspace.policy.minimumPeers} other qualifying institutions before any peer statistic is shown. There are currently {workspace.policy.availablePeers ?? 0} eligible peers in the broadest safe cohort.
              </p>
            </div>
            <div className="rounded-[30px] bg-slate-950 p-8 text-white">
              <ShieldCheck className="size-8 text-mint-300" />
              <h2 className="mt-4 text-xl font-black">Privacy beats premature comparison.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                KHP-OS will wait for a privacy-safe peer group rather than expose thin cohorts or create misleading rankings.
              </p>
            </div>
          </section>
        )}

        {workspace.status === "ready" && overall && overallState && (
          <>
            <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Overall institutional position</p>
                    <h2 className="mt-2 text-3xl font-black">{overall.ownScore}</h2>
                    <p className="mt-1 text-sm text-slate-500">Latest completed KSHC overall score</p>
                  </div>
                  <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black ${overallState.className}`}>
                    <OverallIcon className="size-4" /> {overallState.label}
                  </span>
                </div>
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-100 p-4">
                    <p className="text-xs font-bold text-slate-500">Peer 25th percentile</p>
                    <p className="mt-1 text-2xl font-black">{overall.peerP25}</p>
                  </div>
                  <div className="rounded-2xl bg-brand-50 p-4">
                    <p className="text-xs font-bold text-brand-700">Peer median</p>
                    <p className="mt-1 text-2xl font-black text-brand-950">{overall.peerMedian}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 p-4">
                    <p className="text-xs font-bold text-slate-500">Peer 75th percentile</p>
                    <p className="mt-1 text-2xl font-black">{overall.peerP75}</p>
                  </div>
                </div>
                <p className="mt-5 text-xs leading-5 text-slate-500">
                  {workspace.policy.scopeLabel} · {overall.peerCount} peers · latest compatible KSHC version only.
                </p>
              </div>

              <div className="rounded-[30px] bg-slate-950 p-6 text-white sm:p-8">
                <Users className="size-8 text-mint-300" />
                <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-mint-300">Benchmark rule</p>
                <h2 className="mt-2 text-2xl font-black">No league tables.</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  The middle 50% peer band gives strategic context without turning institutional transformation into a public contest. Benchmarking informs judgement; it cannot close a priority or certify improvement.
                </p>
                {workspace.portfolioAccess && (
                  <Link
                    href="/khpos/portfolio"
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-black text-slate-950"
                  >
                    <Building2 className="size-4" /> Open KAEC Portfolio Intelligence
                  </Link>
                )}
              </div>
            </section>

            <section>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Seven-system benchmark</p>
                  <h2 className="mt-2 text-2xl font-black">Where is the institution structurally strong or exposed?</h2>
                </div>
                <BarChart3 className="hidden size-8 text-brand-700 sm:block" />
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {(workspace.systems ?? []).map((system) => (
                  <SystemCard key={system.systemId} system={system} />
                ))}
              </div>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Improvement benchmark</p>
                  <h2 className="mt-2 text-2xl font-black">Are we improving at a credible pace?</h2>
                </div>
                <TrendingUp className="size-8 text-brand-700" />
              </div>
              {workspace.improvement?.eligible ? (
                <div className="mt-6 grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl bg-slate-950 p-5 text-white">
                    <p className="text-xs font-bold text-slate-400">Your delta from baseline</p>
                    <p className="mt-1 text-2xl font-black">{workspace.improvement.ownDeltaFromBaseline ?? "—"}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 p-5">
                    <p className="text-xs font-bold text-slate-500">Peer median delta</p>
                    <p className="mt-1 text-2xl font-black">{workspace.improvement.peerMedian ?? "—"}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 p-5">
                    <p className="text-xs font-bold text-slate-500">Peer middle 50%</p>
                    <p className="mt-1 text-xl font-black">{workspace.improvement.peerP25 ?? "—"}–{workspace.improvement.peerP75 ?? "—"}</p>
                  </div>
                  <div className="rounded-2xl bg-brand-50 p-5">
                    <p className="text-xs font-bold text-brand-700">Peers with verified improvement</p>
                    <p className="mt-1 text-2xl font-black text-brand-950">{workspace.improvement.peerVerifiedImprovementRate ?? "—"}%</p>
                  </div>
                </div>
              ) : (
                <p className="mt-5 max-w-3xl rounded-2xl bg-slate-100 p-5 text-sm leading-6 text-slate-600">
                  Improvement benchmarking remains hidden until at least {workspace.policy.minimumPeers} peer institutions have completed a valid reassessment. Baseline comparison remains available only within your own institution until then.
                </p>
              )}
            </section>
          </>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-700" />
            <p className="leading-6">
              <strong className="text-slate-950">Epistemic boundary:</strong> benchmark position is context, not proof of quality or causality. Only fresh KSHC reassessment can change Verified Institutional Improvement or resolve a diagnosed priority.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
