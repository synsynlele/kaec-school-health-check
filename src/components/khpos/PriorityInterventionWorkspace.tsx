"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Gauge,
  Layers3,
  Loader2,
  LockKeyhole,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposPriorityWorkspace } from "@/lib/khpos/priorities";

function formatDate(value: string | null | undefined): string {
  if (!value) return "Review date not set";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function scoreTone(score: number): string {
  if (score === 1) return "border-red-200 bg-red-50 text-red-700";
  if (score === 2) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export function PriorityInterventionWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] = useState<KhposPriorityWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setError("Your session has ended. Return to the Command Centre and sign in again.");
        return;
      }

      const response = await fetch(`/api/khpos/priorities/${organisationId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const body = (await response.json()) as {
        ok?: boolean;
        workspace?: KhposPriorityWorkspace;
        error?: string;
      };

      if (!active) return;
      if (!response.ok || !body.ok || !body.workspace) {
        setError(body.error ?? "The transformation agenda could not be loaded.");
        return;
      }

      setWorkspace(body.workspace);
      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  async function mutateAgenda(
    payload:
      | { action: "approve"; indicatorId: string }
      | { action: "archive"; priorityId: string },
    key: string,
  ) {
    if (!supabase) return;
    setBusyKey(key);
    setError("");

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setBusyKey("");
      setError("Your session has ended. Sign in again to continue.");
      return;
    }

    const response = await fetch(`/api/khpos/priorities/${organisationId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as {
      ok?: boolean;
      workspace?: KhposPriorityWorkspace;
      error?: string;
    };

    setBusyKey("");
    if (!response.ok || !body.ok || !body.workspace) {
      setError(body.error ?? "The transformation agenda could not be updated.");
      return;
    }

    setWorkspace(body.workspace);
  }

  if (!workspace && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-mint-300" />
          <p className="mt-4 text-sm font-semibold text-slate-300">Ranking diagnostic evidence…</p>
        </div>
      </main>
    );
  }

  if (error && !workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <CircleAlert className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Transformation agenda unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <button onClick={() => router.push(`/khpos/${organisationId}`)} className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950">
            Return to Command Centre
          </button>
        </div>
      </main>
    );
  }

  if (!workspace) return null;

  const atLimit = workspace.approvedCount >= workspace.agendaLimit;
  const baselineScore = workspace.baseline?.overallScore;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-white/10 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-mint-300 text-slate-950">
              <Target className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-mint-300">KHP-OS | Schools</p>
              <p className="truncate text-sm font-extrabold text-white">Priority & Intervention Engine</p>
            </div>
          </div>
          <Link href={`/khpos/${organisationId}`} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/10">
            <ArrowLeft className="size-4" /> Command Centre
          </Link>
        </div>
      </header>

      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-end lg:py-14">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-mint-200">
              Stage 2 — Priority & Intervention
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
              Turn diagnosis into a focused transformation agenda.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-brand-100 sm:text-base">
              KSHC evidence can surface many weaknesses. KHP-OS ranks the material gaps, maps each one to a reusable intervention, and keeps leadership focused on the few commitments that matter most.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-200">Focus discipline</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-5xl font-black">{workspace.approvedCount}</span>
              <span className="pb-1 text-lg font-bold text-brand-200">/ {workspace.agendaLimit}</span>
            </div>
            <p className="mt-2 max-w-xs text-xs leading-5 text-brand-100">Maximum 3 active priorities per KSHC baseline.</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <Gauge className="size-5 text-brand-700" />
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Baseline</p>
            <p className="mt-1 text-3xl font-black">{baselineScore ?? "—"}{baselineScore !== null && baselineScore !== undefined ? <span className="text-sm text-slate-400">/100</span> : null}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <LockKeyhole className="size-5 text-mint-700" />
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Decision authority</p>
            <p className="mt-1 text-lg font-black capitalize">{workspace.membership.role.replaceAll("_", " ")}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{workspace.canApprove ? "Authorised to approve the school transformation agenda." : "Read-only view; leadership approval is required."}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <Layers3 className="size-5 text-amber-600" />
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Intervention library</p>
            <p className="mt-1 text-lg font-black">55 mapped systems</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Every KSHC indicator has a versioned Intervention Library v1.0 route.</p>
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint-700">Approved agenda</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">What leadership has committed the institution to change</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{workspace.approvedCount} active</span>
          </div>

          {workspace.approved.length ? (
            <div className="mt-7 grid gap-5 lg:grid-cols-3">
              {workspace.approved.map((priority, index) => (
                <article key={priority.id} className="flex flex-col rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-950 text-xs font-black text-white">{index + 1}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${scoreTone(priority.indicatorScore)}`}>KSHC {priority.indicatorScore}/5</span>
                  </div>
                  <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">{priority.systemName}</p>
                  <h3 className="mt-2 text-lg font-black leading-6 text-slate-950">{priority.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{priority.problemStatement}</p>

                  {priority.intervention && (
                    <div className="mt-5 rounded-2xl border border-brand-100 bg-white p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600">Selected intervention</p>
                      <p className="mt-1.5 text-sm font-extrabold text-slate-900">{priority.intervention.title}</p>
                      {priority.intervention.expectedOutcome && <p className="mt-2 text-xs leading-5 text-slate-500"><span className="font-bold text-slate-700">Expected outcome:</span> {priority.intervention.expectedOutcome}</p>}
                      {priority.intervention.implementationGuidance && <p className="mt-2 text-xs leading-5 text-slate-500"><span className="font-bold text-slate-700">How to begin:</span> {priority.intervention.implementationGuidance}</p>}
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 capitalize">{priority.intervention.status}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1">Review: {formatDate(priority.intervention.targetDate)}</span>
                      </div>
                    </div>
                  )}

                  {workspace.canApprove && (
                    <button
                      type="button"
                      disabled={busyKey === priority.id}
                      onClick={() => void mutateAgenda({ action: "archive", priorityId: priority.id }, priority.id)}
                      className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-600 transition hover:border-red-200 hover:text-red-700 disabled:opacity-60"
                    >
                      {busyKey === priority.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      Archive from active agenda
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-7 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <Target className="mx-auto size-8 text-slate-300" />
              <p className="mt-3 font-extrabold text-slate-800">No institutional priority has been approved yet.</p>
              <p className="mt-2 text-sm text-slate-500">The evidence below is still diagnostic intelligence—not an institutional commitment.</p>
            </div>
          )}
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Evidence-ranked shortlist</p>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-extrabold text-brand-700">Deterministic, not AI-guessed</span>
              </div>
              <h2 className="mt-2 max-w-3xl text-2xl font-black tracking-tight">The strongest candidates for this transformation cycle</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Only recorded indicators scoring 1–3 are eligible. The engine ranks severity, surrounding area weakness and institutional risk, then limits chapter concentration so one problem area does not drown out the whole school.</p>
            </div>
            {atLimit && <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">Agenda full — archive one to change focus</span>}
          </div>

          <div className="mt-7 space-y-4">
            {workspace.candidates.map((candidate, index) => (
              <article key={candidate.indicatorId} className="rounded-3xl border border-slate-200 p-5 sm:p-6">
                <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${scoreTone(candidate.indicatorScore)}`}>{candidate.routeLabel} · {candidate.indicatorScore}/5</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{candidate.chapterTitle}</span>
                      <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-bold text-white">Priority score {candidate.priorityScore}</span>
                    </div>
                    <div className="mt-4 flex gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-black text-brand-700">{index + 1}</span>
                      <div>
                        <h3 className="text-lg font-black text-slate-950">{candidate.priorityTitle}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{candidate.question}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-400">Evidence lens: {candidate.hint}</p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Institutional system</p>
                        <p className="mt-1.5 text-sm font-extrabold text-slate-800">{candidate.systemName}</p>
                      </div>
                      <div className="rounded-2xl bg-brand-50 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-500">Mapped intervention</p>
                        <p className="mt-1.5 text-sm font-extrabold text-brand-900">{candidate.interventionTitle}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">{candidate.whyNow}</p>
                  </div>

                  <div className="lg:w-52">
                    {workspace.canApprove ? (
                      <button
                        type="button"
                        disabled={atLimit || busyKey === candidate.indicatorId}
                        onClick={() => void mutateAgenda({ action: "approve", indicatorId: candidate.indicatorId }, candidate.indicatorId)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-extrabold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {busyKey === candidate.indicatorId ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                        Approve priority & intervention
                      </button>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-xs font-semibold leading-5 text-slate-500">Leadership approval required</div>
                    )}
                  </div>
                </div>
              </article>
            ))}

            {!workspace.candidates.length && !atLimit && (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <Sparkles className="mx-auto size-8 text-mint-500" />
                <p className="mt-3 font-extrabold text-slate-800">No additional material gap is currently eligible.</p>
                <p className="mt-2 text-sm text-slate-500">This baseline has no unapproved KSHC indicator scoring 1–3 in the current shortlist.</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[30px] bg-slate-950 p-6 text-white sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint-300">Governance rule</p>
              <h2 className="mt-2 text-2xl font-black">A recommendation is not a commitment.</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">The engine may rank evidence and map an intervention. Only an authorised human can commit the school. Every approval and agenda change is recorded in institutional history.</p>
            </div>
            <Link href={`/khpos/${organisationId}`} className="inline-flex items-center gap-2 text-sm font-extrabold text-mint-300">Return to Command Centre <ArrowRight className="size-4" /></Link>
          </div>
        </section>
      </div>
    </main>
  );
}
