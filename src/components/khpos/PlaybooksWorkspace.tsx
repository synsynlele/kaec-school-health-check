"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock3,
  FileCheck2,
  Loader2,
  ShieldAlert,
  Target,
  Workflow,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposImplementationWorkspace } from "@/lib/khpos/implementation";
import {
  interventionPlaybookProgress,
  UNIVERSAL_SCHOOL_PLAYBOOKS,
} from "@/lib/khpos/playbooks";

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not scheduled";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function readableStatus(value: string): string {
  return value.replaceAll("_", " ");
}

export function PlaybooksWorkspace({ organisationId }: { organisationId: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] = useState<KhposImplementationWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setError("Your session has ended. Sign in again to continue.");
        return;
      }

      const response = await fetch(`/api/khpos/implementation/${organisationId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const body = (await response.json()) as {
        ok?: boolean;
        workspace?: KhposImplementationWorkspace;
        error?: string;
      };

      if (!active) return;
      if (!response.ok || !body.ok || !body.workspace) {
        setError(body.error ?? "The school playbooks could not be loaded.");
        return;
      }

      setWorkspace(body.workspace);
      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  if (!workspace && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-mint-300" />
          <p className="mt-4 text-sm font-semibold text-slate-300">
            Loading the school's implementation playbooks…
          </p>
        </div>
      </main>
    );
  }

  if (error || !workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <ShieldAlert className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Playbook access could not be confirmed</h1>
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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-white/10 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-mint-300 text-slate-950">
              <BookOpen className="size-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-mint-300">KHP-OS | Schools</p>
              <p className="text-sm font-extrabold">Implementation Playbooks</p>
            </div>
          </div>
          <Link
            href={`/khpos/${organisationId}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
          >
            <ArrowLeft className="size-4" /> Command Centre
          </Link>
        </div>
      </header>

      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-bold text-mint-200">
            School-side execution guidance
          </span>
          <h1 className="mt-5 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
            Know what to do, how to do it and what proves it was done.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
            Universal playbooks give every partner school the same transformation discipline. Active intervention playbooks are generated from the school's approved KHP-OS plans, so execution remains specific to the institution.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2">
              {UNIVERSAL_SCHOOL_PLAYBOOKS.length} universal playbooks
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2">
              {workspace.plans.length} active intervention {workspace.plans.length === 1 ? "playbook" : "playbooks"}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 capitalize">
              {workspace.membership.role.replaceAll("_", " ")}
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 sm:py-10">
        <section>
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Always available</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">Universal School Transformation Playbooks</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Use these playbooks throughout every KAEC-NG transformation engagement. They define the school's operating discipline; they do not replace institutional judgement.
            </p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {UNIVERSAL_SCHOOL_PLAYBOOKS.map((playbook, index) => (
              <details
                key={playbook.id}
                className="group rounded-[28px] border border-slate-200 bg-white shadow-sm open:shadow-md"
              >
                <summary className="cursor-pointer list-none p-6 sm:p-7">
                  <div className="flex items-start gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-sm font-black text-brand-700">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-lg font-black">{playbook.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{playbook.purpose}</p>
                      <p className="mt-3 text-xs font-bold text-brand-700 group-open:hidden">Open playbook ↓</p>
                    </div>
                  </div>
                </summary>

                <div className="border-t border-slate-100 px-6 pb-7 pt-5 sm:px-7">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Primary owner</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{playbook.owner}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Completion outcome</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{playbook.completionOutcome}</p>
                    </div>
                  </div>

                  <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-brand-700">When to use it</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{playbook.useWhen}</p>

                  <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-brand-700">What the school must do</p>
                  <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    {playbook.steps.map((step, stepIndex) => (
                      <li key={`${playbook.id}-step-${stepIndex}`} className="flex gap-3">
                        <span className="font-black text-brand-700">{stepIndex + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-6 grid gap-5 xl:grid-cols-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">Checklist</p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                        {playbook.checklist.map((item, itemIndex) => (
                          <li key={`${playbook.id}-check-${itemIndex}`} className="flex gap-2">
                            <Circle className="mt-1 size-3.5 shrink-0 text-slate-300" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">Evidence</p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                        {playbook.evidence.map((item, itemIndex) => (
                          <li key={`${playbook.id}-evidence-${itemIndex}`} className="flex gap-2">
                            <FileCheck2 className="mt-1 size-3.5 shrink-0 text-mint-700" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Escalate when</p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                        {playbook.escalation.map((item, itemIndex) => (
                          <li key={`${playbook.id}-escalate-${itemIndex}`} className="flex gap-2">
                            <ShieldAlert className="mt-1 size-3.5 shrink-0 text-amber-600" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>

        <section>
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-mint-800">Activated by approved priorities</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">Active Intervention Playbooks</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              These are not generic manuals. They use the live intervention plan, actions, milestones, evidence standards and review dates already generated for this school.
            </p>
          </div>

          {!workspace.plans.length ? (
            <div className="mt-6 rounded-[30px] border border-slate-200 bg-white p-8 shadow-sm">
              <Workflow className="size-8 text-brand-700" />
              <h3 className="mt-5 text-xl font-black">No intervention playbook is active yet.</h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Once an authorised priority is approved, KHP-OS creates the implementation plan and this workspace turns that plan into the school's live intervention playbook.
              </p>
              <Link
                href={`/khpos/${organisationId}/priorities`}
                className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-extrabold text-white"
              >
                Open transformation priorities
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {workspace.plans.map((plan) => {
                const progress = interventionPlaybookProgress(plan);
                return (
                  <article key={plan.id} className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
                    <div className="bg-slate-950 p-6 text-white sm:p-8">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-3xl">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-mint-300">{plan.priority.systemName}</p>
                          <h3 className="mt-2 text-2xl font-black sm:text-3xl">{plan.intervention.title}</h3>
                          <p className="mt-3 text-sm leading-6 text-slate-300">{plan.objective}</p>
                        </div>
                        <div className="min-w-52 rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-xs font-bold text-slate-400">Action progress</p>
                          <p className="mt-1 text-3xl font-black text-mint-300">{progress.percent}%</p>
                          <p className="mt-1 text-xs font-semibold text-slate-400">
                            {progress.completedActions}/{progress.totalActions} actions complete
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-7 p-6 sm:p-8">
                      <section className="grid gap-4 lg:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 lg:col-span-2">
                          <p className="text-xs font-black uppercase tracking-wide text-brand-700">What this school is changing</p>
                          <p className="mt-3 text-sm leading-7 text-slate-600">
                            {plan.intervention.problemInterpretation ?? plan.intervention.intelligenceSummary ?? plan.intervention.description}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-5">
                          <Target className="size-5 text-brand-700" />
                          <p className="mt-3 text-xs font-black uppercase tracking-wide text-slate-400">Target date</p>
                          <p className="mt-2 text-sm font-black">{formatDate(plan.intervention.targetDate)}</p>
                          <p className="mt-4 text-xs font-black uppercase tracking-wide text-slate-400">Status</p>
                          <p className="mt-2 text-sm font-black capitalize">{readableStatus(plan.status)}</p>
                        </div>
                      </section>

                      {plan.outcomeContract && (
                        <section className="rounded-[26px] border border-mint-200 bg-mint-50 p-5 sm:p-6">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-mint-800">Outcome contract</p>
                          <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            <div className="rounded-2xl bg-white p-4">
                              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Desired condition</p>
                              <p className="mt-2 text-sm leading-6 text-slate-700">{plan.outcomeContract.desiredCondition}</p>
                            </div>
                            <div className="rounded-2xl bg-white p-4">
                              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Success threshold</p>
                              <p className="mt-2 text-sm leading-6 text-slate-700">{plan.outcomeContract.successThreshold}</p>
                            </div>
                          </div>
                        </section>
                      )}

                      <section>
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">Implementation checklist</p>
                            <h4 className="mt-1 text-xl font-black">Do these actions in order</h4>
                          </div>
                          <Link
                            href={`/khpos/${organisationId}/implementation`}
                            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                          >
                            Open full implementation view
                          </Link>
                        </div>
                        <div className="mt-4 space-y-3">
                          {plan.actions.map((action) => {
                            const complete = action.status === "completed";
                            return (
                              <div key={action.id} className="flex gap-3 rounded-2xl border border-slate-200 p-4">
                                {complete ? (
                                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-mint-700" />
                                ) : (
                                  <Circle className="mt-0.5 size-5 shrink-0 text-slate-300" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-black">{action.sequence}. {action.title}</p>
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black capitalize text-slate-500">
                                      {readableStatus(action.status)}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-sm leading-6 text-slate-600">{action.description}</p>
                                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-bold text-slate-400">
                                    <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" /> {formatDate(action.dueDate)}</span>
                                    {action.evidenceRequired && <span>Evidence required</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>

                      <section className="grid gap-5 lg:grid-cols-2">
                        <div className="rounded-[26px] border border-slate-200 p-5">
                          <div className="flex items-center gap-2">
                            <FileCheck2 className="size-5 text-brand-700" />
                            <h4 className="font-black">Evidence requirements</h4>
                          </div>
                          <p className="mt-2 text-xs font-semibold text-slate-400">
                            {progress.completedEvidence}/{progress.totalEvidence} evidence requirements completed or accepted
                          </p>
                          <ul className="mt-4 space-y-3">
                            {plan.evidenceRequirements.map((requirement) => (
                              <li key={requirement.id} className="rounded-2xl bg-slate-50 p-4">
                                <p className="text-sm font-black">{requirement.title}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">{requirement.description}</p>
                                <p className="mt-2 text-[11px] font-bold capitalize text-slate-400">{readableStatus(requirement.status)} · due {formatDate(requirement.dueDate)}</p>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="rounded-[26px] border border-slate-200 p-5">
                          <div className="flex items-center gap-2">
                            <Clock3 className="size-5 text-brand-700" />
                            <h4 className="font-black">Review cadence</h4>
                          </div>
                          <ul className="mt-4 space-y-3">
                            {plan.reviews.map((review) => (
                              <li key={review.id} className="rounded-2xl bg-slate-50 p-4">
                                <p className="text-sm font-black capitalize">{review.reviewType} review</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(review.scheduledFor)}</p>
                                <p className="mt-2 text-[11px] font-bold capitalize text-slate-400">
                                  {review.decision ? `Decision: ${readableStatus(review.decision)}` : readableStatus(review.status)}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </section>

                      {!!plan.intervention.risksAndGuardrails.length && (
                        <section className="rounded-[26px] border border-amber-200 bg-amber-50 p-5 sm:p-6">
                          <div className="flex items-center gap-2 text-amber-900">
                            <ShieldAlert className="size-5" />
                            <h4 className="font-black">Risks & guardrails</h4>
                          </div>
                          <ul className="mt-4 space-y-2 text-sm leading-6 text-amber-950">
                            {plan.intervention.risksAndGuardrails.map((item, itemIndex) => (
                              <li key={`${plan.id}-risk-${itemIndex}`}>• {item}</li>
                            ))}
                          </ul>
                        </section>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
