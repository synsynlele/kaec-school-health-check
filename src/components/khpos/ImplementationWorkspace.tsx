"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Circle,
  FileCheck2,
  Gauge,
  Layers3,
  Loader2,
  Milestone,
  ShieldCheck,
  Target,
  Workflow,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposImplementationWorkspace } from "@/lib/khpos/implementation";

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not scheduled";
  const date = new Date(`${value}T00:00:00`);
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

export function ImplementationWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
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
        setError(body.error ?? "The implementation workspace could not be loaded.");
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
            Loading the system-generated implementation plan…
          </p>
        </div>
      </main>
    );
  }

  if (error || !workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <ShieldCheck className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Implementation access could not be confirmed</h1>
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
              <Workflow className="size-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-mint-300">KHP-OS | Schools</p>
              <p className="text-sm font-extrabold">Implementation Automation</p>
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
            System-generated execution
          </span>
          <h1 className="mt-5 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
            Approval is complete. KHP-OS builds the execution path.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
            The institution does not design task lists or review calendars manually. KHP-OS converts each approved intervention into actions, milestones, required evidence and scheduled reviews. Humans execute the real-world work and provide proof.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2">
              {workspace.activePlanCount} active {workspace.activePlanCount === 1 ? "plan" : "plans"}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 capitalize">
              {workspace.membership.role.replaceAll("_", " ")}
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        {!workspace.plans.length ? (
          <section className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-sm">
            <Layers3 className="size-8 text-brand-700" />
            <h2 className="mt-5 text-2xl font-black">No implementation plan is active yet.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Approve a transformation priority first. The implementation plan will be created automatically at the moment of approval; no separate planning form is required.
            </p>
            <Link
              href={`/khpos/${organisationId}/priorities`}
              className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-extrabold text-white"
            >
              Open transformation agenda
            </Link>
          </section>
        ) : (
          <div className="space-y-8">
            {workspace.plans.map((plan) => {
              const completedActions = plan.actions.filter(
                (action) => action.status === "completed",
              ).length;

              return (
                <section
                  key={plan.id}
                  className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm"
                >
                  <div className="border-b border-slate-200 bg-slate-950 p-6 text-white sm:p-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-mint-300 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-slate-950">
                            Automated plan v{plan.planVersion}
                          </span>
                          <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold capitalize text-slate-300">
                            {readableStatus(plan.status)}
                          </span>
                        </div>
                        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-mint-300">
                          {plan.priority.systemName}
                        </p>
                        <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                          {plan.intervention.title}
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-slate-300">
                          {plan.objective}
                        </p>
                      </div>
                      <div className="grid min-w-60 grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <Gauge className="size-5 text-mint-300" />
                          <p className="mt-3 text-xs font-bold text-slate-400">KSHC evidence</p>
                          <p className="mt-1 text-xl font-black">{plan.priority.indicatorScore}/5</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <Target className="size-5 text-amber-300" />
                          <p className="mt-3 text-xs font-bold text-slate-400">Target date</p>
                          <p className="mt-1 text-sm font-black">{formatDate(plan.intervention.targetDate)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8 p-6 sm:p-8">
                    <section>
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Actions</p>
                          <h3 className="mt-2 text-xl font-black">Execution sequence generated by KHP-OS</h3>
                        </div>
                        <span className="text-xs font-bold text-slate-400">
                          {completedActions}/{plan.actions.length} complete
                        </span>
                      </div>
                      <div className="mt-5 grid gap-3 lg:grid-cols-2">
                        {plan.actions.map((action) => (
                          <div key={action.id} className="rounded-2xl border border-slate-200 p-5">
                            <div className="flex items-start gap-3">
                              {action.status === "completed" ? (
                                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-mint-700" />
                              ) : (
                                <Circle className="mt-0.5 size-5 shrink-0 text-slate-300" />
                              )}
                              <div>
                                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                                  Action {action.sequence} · {formatDate(action.dueDate)}
                                </p>
                                <p className="mt-1 font-extrabold text-slate-900">{action.title}</p>
                                <p className="mt-2 text-sm leading-6 text-slate-500">{action.description}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="grid gap-5 lg:grid-cols-2">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                        <div className="flex items-center gap-3">
                          <Milestone className="size-5 text-brand-700" />
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Milestones</p>
                            <h3 className="mt-1 text-lg font-black">What progress should look like</h3>
                          </div>
                        </div>
                        <div className="mt-5 space-y-4">
                          {plan.milestones.map((milestone) => (
                            <div key={milestone.id} className="border-l-2 border-brand-200 pl-4">
                              <p className="text-sm font-extrabold text-slate-900">{milestone.title}</p>
                              <p className="mt-1 text-xs font-bold text-slate-400">{formatDate(milestone.targetDate)}</p>
                              <p className="mt-2 text-sm leading-6 text-slate-500">{milestone.successSignal}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                        <div className="flex items-center gap-3">
                          <FileCheck2 className="size-5 text-mint-700" />
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint-700">Evidence required</p>
                            <h3 className="mt-1 text-lg font-black">What must prove implementation</h3>
                          </div>
                        </div>
                        <div className="mt-5 space-y-4">
                          {plan.evidenceRequirements.map((evidence) => (
                            <div key={evidence.id} className="rounded-2xl bg-white p-4">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-extrabold text-slate-900">{evidence.title}</p>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">
                                  {readableStatus(evidence.status)}
                                </span>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-500">{evidence.description}</p>
                              <p className="mt-2 text-xs font-bold text-slate-400">Due {formatDate(evidence.dueDate)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>

                    <section className="rounded-3xl border border-brand-100 bg-brand-50 p-6">
                      <div className="flex items-center gap-3">
                        <CalendarClock className="size-5 text-brand-700" />
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Review schedule</p>
                          <h3 className="mt-1 text-lg font-black">KHP-OS has already scheduled the checks.</h3>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {plan.reviews.map((review) => (
                          <div key={review.id} className="rounded-2xl border border-brand-100 bg-white p-5">
                            <p className="text-xs font-black uppercase tracking-wide text-brand-700">
                              {review.reviewType} review
                            </p>
                            <p className="mt-2 text-xl font-black text-slate-900">{formatDate(review.scheduledFor)}</p>
                            <p className="mt-2 text-sm font-semibold capitalize text-slate-500">{readableStatus(review.status)}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
                      <strong>Human role:</strong> approve the institutional commitment, execute the real-world actions and provide evidence. KHP-OS controls the sequence, deadlines, evidence standard and review cadence.
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
