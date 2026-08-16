"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Gauge,
  Loader2,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposReviewDecision,
  KhposReviewWorkspace,
  KhposTransformationReview,
} from "@/lib/khpos/review";

const DECISIONS: Array<{
  value: KhposReviewDecision;
  label: string;
  description: string;
}> = [
  { value: "continue", label: "Continue", description: "Keep the intervention operating." },
  { value: "adjust", label: "Adjust", description: "Correct the execution before continuing." },
  { value: "escalate", label: "Escalate", description: "Return the constraint to transformation leadership." },
  { value: "complete", label: "Complete", description: "Close implementation and move to reassessment." },
  { value: "pause", label: "Pause", description: "Preserve the cycle but suspend execution." },
  { value: "stop", label: "Stop", description: "Abandon this intervention and re-prioritise the problem." },
];

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function readable(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function decisionTone(decision: KhposReviewDecision): string {
  if (decision === "complete") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (decision === "continue") return "border-brand-200 bg-brand-50 text-brand-800";
  if (decision === "adjust") return "border-amber-200 bg-amber-50 text-amber-900";
  if (decision === "escalate") return "border-orange-200 bg-orange-50 text-orange-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function ReviewDecisionPanel({
  review,
  canDecide,
  selected,
  note,
  busy,
  onSelect,
  onNote,
  onSubmit,
}: {
  review: KhposTransformationReview;
  canDecide: boolean;
  selected: KhposReviewDecision;
  note: string;
  busy: boolean;
  onSelect: (decision: KhposReviewDecision) => void;
  onNote: (note: string) => void;
  onSubmit: () => void;
}) {
  const override = selected !== review.recommendation.decision;
  const noteRequired = override || selected === "pause" || selected === "stop";

  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
          <Scale className="size-5" />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Human authority</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">Approve the decision—not the review report.</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            KHP-OS has prepared the evidence, progress analysis, adaptation intelligence and deterministic recommendation. An Executive or Transformation Lead retains the final decision.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {DECISIONS.map((item) => {
          const active = selected === item.value;
          const recommended = review.recommendation.decision === item.value;
          return (
            <button
              key={item.value}
              type="button"
              disabled={!canDecide || busy}
              onClick={() => onSelect(item.value)}
              className={`rounded-2xl border p-4 text-left transition ${
                active
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black">{item.label}</span>
                {recommended && (
                  <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${active ? "bg-white/15 text-white" : "bg-mint-100 text-mint-900"}`}>
                    recommended
                  </span>
                )}
              </div>
              <p className={`mt-2 text-xs leading-5 ${active ? "text-slate-300" : "text-slate-500"}`}>
                {item.description}
              </p>
            </button>
          );
        })}
      </div>

      <textarea
        value={note}
        disabled={!canDecide || busy}
        maxLength={2000}
        onChange={(event) => onNote(event.target.value)}
        placeholder={
          noteRequired
            ? "Required: briefly explain why you are overriding the recommendation, pausing or stopping."
            : "Optional decision note for the institutional record."
        }
        className="mt-4 min-h-24 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm outline-none focus:border-brand-500 disabled:bg-slate-100"
      />

      {!canDecide ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          You can review this intelligence, but only an Executive or Transformation Lead can approve the institutional decision.
        </div>
      ) : (
        <button
          type="button"
          disabled={busy || (noteRequired && note.trim().length < 12)}
          onClick={onSubmit}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Approve {DECISIONS.find((item) => item.value === selected)?.label}
        </button>
      )}

      {selected === "complete" && (
        <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
          Complete closes the implementation cycle only. The underlying priority remains active until reassessment verifies improvement.
        </p>
      )}
    </section>
  );
}

export function ReviewDecisionWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] = useState<KhposReviewWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyReviewId, setBusyReviewId] = useState("");
  const [selections, setSelections] = useState<Record<string, KhposReviewDecision>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

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

      const response = await fetch(`/api/khpos/reviews/${organisationId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = (await response.json()) as {
        ok?: boolean;
        workspace?: KhposReviewWorkspace;
        error?: string;
      };
      if (!active) return;
      if (!response.ok || !body.ok || !body.workspace) {
        setError(body.error ?? "Transformation reviews could not be loaded.");
        return;
      }

      setWorkspace(body.workspace);
      setSelections(
        Object.fromEntries(
          body.workspace.reviews
            .filter((review) => review.status === "awaiting_decision")
            .map((review) => [review.id, review.recommendation.decision]),
        ),
      );
      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  async function decide(review: KhposTransformationReview) {
    if (!supabase) return;
    const selected = selections[review.id] ?? review.recommendation.decision;
    const note = notes[review.id] ?? "";

    setBusyReviewId(review.id);
    setError("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session has ended. Sign in again to continue.");

      const response = await fetch(`/api/khpos/reviews/${organisationId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "decide",
          reviewId: review.id,
          decision: selected,
          note,
        }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        workspace?: KhposReviewWorkspace;
        error?: string;
      };
      if (!response.ok || !body.ok || !body.workspace) {
        throw new Error(body.error ?? "The review decision could not be applied.");
      }

      setWorkspace(body.workspace);
      setNotes((current) => ({ ...current, [review.id]: "" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The review decision could not be applied.");
    } finally {
      setBusyReviewId("");
    }
  }

  if (!workspace && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-mint-300" />
          <p className="mt-4 text-sm font-semibold text-slate-300">Preparing the institutional review…</p>
        </div>
      </main>
    );
  }

  if (error && !workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <ShieldCheck className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Review workspace unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <Link href={`/khpos/${organisationId}`} className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950">
            Return to Command Centre
          </Link>
        </div>
      </main>
    );
  }

  if (!workspace) return null;

  const pending = workspace.reviews.filter((review) => review.status === "awaiting_decision");
  const history = workspace.reviews.filter((review) => review.status === "decided");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
          <Link href={`/khpos/${organisationId}/evidence`} className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white">
            <ArrowLeft className="size-4" /> Evidence & Verification
          </Link>
          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-mint-300">KHP-OS | Review & Decision</p>
              <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
                Evidence drives the review. Leadership makes the call.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                KHP-OS separates implementation activity from institutional change, interprets the evidence against the outcome contract and explains what should happen next. The deterministic recommendation remains authoritative; human leadership retains the final decision.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
              <BrainCircuit className="size-5 text-mint-300" />
              <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-400">Awaiting leadership</p>
              <p className="mt-1 text-3xl font-black">{workspace.awaitingDecisionCount}</p>
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

        {!pending.length && (
          <section className="rounded-[30px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <FileCheck2 className="mx-auto size-9 text-slate-400" />
            <h2 className="mt-4 text-2xl font-black">No review decision is due right now.</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              KHP-OS prepares a review when the scheduled date arrives or evidence coverage makes the review ready. Continue implementation and provide real evidence rather than creating a manual report.
            </p>
            <Link href={`/khpos/${organisationId}/evidence`} className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-extrabold text-white">
              Open Evidence & Verification
            </Link>
          </section>
        )}

        {pending.map((review) => {
          const selected = selections[review.id] ?? review.recommendation.decision;
          return (
            <article key={review.id} className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-950 p-6 text-white sm:p-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-mint-300 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-slate-950">
                        {review.reviewType} review
                      </span>
                      <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] font-bold text-slate-300">
                        Scheduled {formatDate(review.scheduledFor)}
                      </span>
                      {review.narrative.provider === "openai" && (
                        <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-[10px] font-bold text-mint-200">
                          AI interpretation · {review.narrative.model}
                        </span>
                      )}
                    </div>
                    <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-mint-300">{review.context.systemName}</p>
                    <h2 className="mt-2 text-2xl font-black sm:text-3xl">{review.context.interventionTitle}</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{review.context.priorityTitle}</p>
                  </div>
                  <div className="min-w-56 rounded-2xl border border-white/10 bg-white/5 p-5">
                    <Gauge className="size-5 text-mint-300" />
                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Evidence coverage</p>
                    <p className="mt-1 text-3xl font-black">{review.metrics.evidenceCoveragePercent}%</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {review.metrics.evidenceAcceptedCount}/{review.metrics.evidenceRequiredCount} accepted
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-7 p-6 sm:p-8">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Actions complete" value={`${review.metrics.completedActionCount}/${review.metrics.actionCount}`} />
                  <Metric label="Milestones achieved" value={`${review.metrics.achievedMilestoneCount}/${review.metrics.milestoneCount}`} />
                  <Metric label="Blocked actions" value={String(review.metrics.blockedActionCount)} />
                  <Metric label="Overdue items" value={String(review.metrics.overdueActionCount + review.metrics.overdueMilestoneCount)} />
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <section className="rounded-3xl border border-slate-200 p-6">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Plan vs Actual</p>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{review.planVsActual}</p>
                  </section>
                  <section className="rounded-3xl border border-slate-200 p-6">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Progress</p>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{review.progressSummary}</p>
                  </section>
                  <section className="rounded-3xl border border-slate-200 p-6">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Evidence</p>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{review.evidenceSummary}</p>
                    <p className="mt-3 text-xs font-semibold text-slate-400">
                      {review.metrics.evidenceClarificationCount} clarification · {review.metrics.evidenceRejectedCount} rejected
                    </p>
                  </section>
                  <section className="rounded-3xl border border-slate-200 p-6">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Evidence gaps</p>
                    {review.evidenceGaps.length ? (
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                        {review.evidenceGaps.map((gap, index) => <li key={`${review.id}-gap-${index}`}>• {gap}</li>)}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">No additional evidence gap is recorded for this review.</p>
                    )}
                  </section>
                </div>

                {review.narrative.provider === "openai" && review.adaptation.whatChanged && (
                  <section className="rounded-[30px] border border-mint-200 bg-mint-50 p-6 sm:p-7">
                    <div className="flex items-center gap-3">
                      <Sparkles className="size-5 text-mint-800" />
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-mint-800">Adaptive review intelligence</p>
                        <h3 className="mt-1 text-xl font-black">What the evidence means for the next move</h3>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl bg-white p-5">
                        <p className="text-xs font-black uppercase tracking-wide text-emerald-700">What changed</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{review.adaptation.whatChanged}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-5">
                        <p className="text-xs font-black uppercase tracking-wide text-amber-700">What remains unproven</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{review.adaptation.whatNotChanged}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-5">
                        <p className="text-xs font-black uppercase tracking-wide text-brand-700">Execution assessment</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{review.adaptation.executionAssessment}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-5">
                        <p className="text-xs font-black uppercase tracking-wide text-brand-700">Adaptation advice</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{review.adaptation.advice}</p>
                      </div>
                    </div>
                    {!!review.adaptation.missingEvidence.length && (
                      <div className="mt-4 rounded-2xl bg-white p-5">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Evidence still needed</p>
                        <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-600 md:grid-cols-2">
                          {review.adaptation.missingEvidence.map((item, index) => (
                            <li key={`${review.id}-missing-${index}`}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                )}

                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Institutional lessons</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {review.lessons.map((lesson, index) => (
                      <div key={`${review.id}-lesson-${index}`} className="rounded-2xl bg-white p-4 text-sm leading-6 text-slate-600">
                        {lesson}
                      </div>
                    ))}
                  </div>
                </section>

                <section className={`rounded-3xl border p-6 ${decisionTone(review.recommendation.decision)}`}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em]">KHP-OS deterministic recommendation</p>
                      <h3 className="mt-2 text-2xl font-black capitalize">{review.recommendation.decision}</h3>
                      <p className="mt-3 max-w-3xl text-sm leading-7">{review.recommendation.reason}</p>
                    </div>
                    <div className="rounded-2xl bg-white/70 px-4 py-3 text-center">
                      <p className="text-[10px] font-black uppercase tracking-wide">Rule confidence</p>
                      <p className="mt-1 text-2xl font-black">{review.recommendation.confidence}%</p>
                    </div>
                  </div>
                  <div className="mt-5 rounded-2xl bg-white/70 p-4 text-sm leading-6">
                    <strong>Operating directive:</strong> {review.recommendation.operatingDirective}
                  </div>
                </section>

                <ReviewDecisionPanel
                  review={review}
                  canDecide={workspace.canDecide}
                  selected={selected}
                  note={notes[review.id] ?? ""}
                  busy={busyReviewId === review.id}
                  onSelect={(decision) => setSelections((current) => ({ ...current, [review.id]: decision }))}
                  onNote={(note) => setNotes((current) => ({ ...current, [review.id]: note }))}
                  onSubmit={() => void decide(review)}
                />
              </div>
            </article>
          );
        })}

        {!!history.length && (
          <section>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-5 text-emerald-700" />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Decision history</p>
                <h2 className="mt-1 text-2xl font-black">Institutional review record</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {history.map((review) => (
                <article key={review.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{review.reviewType} · {formatDate(review.scheduledFor)}</p>
                      <h3 className="mt-2 text-lg font-black">{review.context.interventionTitle}</h3>
                    </div>
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black uppercase text-white">
                      {readable(review.decision.approved)}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{review.recommendation.reason}</p>
                  <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                    <strong>Next step:</strong> {readable(review.decision.nextStep)}
                  </div>
                  {review.decision.note && (
                    <p className="mt-3 text-xs leading-5 text-slate-500"><strong>Decision note:</strong> {review.decision.note}</p>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
