"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Loader2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ActivationSnapshot } from "@/lib/khpos/ops/activation";

function Fraction({
  complete,
  total,
}: {
  complete: number;
  total: number;
}) {
  return (
    <span className="text-3xl font-black">
      {complete}
      <span className="text-base text-slate-500">/{total}</span>
    </span>
  );
}

export function ActivationCentre({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [activation, setActivation] = useState<ActivationSnapshot | null>(null);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState<"policies" | "processes" | null>(null);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.access_token) {
        if (active) setError("Your session has ended. Sign in again.");
        return;
      }

      try {
        const response = await fetch(
          `/api/khpos/ops/activation/${organisationId}`,
          {
            headers: {
              Authorization: `Bearer ${data.session.access_token}`,
            },
            cache: "no-store",
          },
        );
        const body = (await response.json()) as {
          ok?: boolean;
          activation?: ActivationSnapshot;
          error?: string;
        };

        if (!active) return;
        if (!response.ok || !body.ok || !body.activation) {
          setError(body.error || "Activation status could not be loaded.");
          return;
        }

        setActivation(body.activation);
      } catch {
        if (active) setError("Activation status could not be loaded.");
      }
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  async function prepareDrafts(kind: "policies" | "processes") {
    if (!supabase || !activation?.canPrepareDrafts || busyAction) return;

    setBusyAction(kind);
    setActionMessage("");
    setError("");

    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) {
        throw new Error("Your session has ended. Sign in again.");
      }

      const response = await fetch(
        `/api/khpos/ops/activation/${organisationId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action:
              kind === "policies"
                ? "prepare_critical_policy_drafts"
                : "prepare_ready_process_drafts",
          }),
        },
      );

      const body = (await response.json()) as {
        ok?: boolean;
        activation?: ActivationSnapshot;
        result?: {
          requested: number;
          existingOpen: number;
          created: number;
          failedCodes: string[];
        };
        error?: string;
      };

      if (!response.ok || !body.ok || !body.activation || !body.result) {
        throw new Error(body.error || "Activation drafts could not be prepared.");
      }

      setActivation(body.activation);
      const subject = kind === "policies" ? "critical policy" : "ready P0 process";
      const failed = body.result.failedCodes.length;
      setActionMessage(
        `Prepared ${body.result.created} ${subject} draft${body.result.created === 1 ? "" : "s"}` +
          (body.result.existingOpen
            ? `; ${body.result.existingOpen} already had an open revision`
            : "") +
          (failed
            ? `; ${failed} could not be prepared and still need attention`
            : "."),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Activation drafts could not be prepared.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  if (!activation && !error) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-6">
        <div className="text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-brand-700" />
          <p className="mt-3 text-sm font-semibold text-slate-600">
            Checking the school operating foundation…
          </p>
        </div>
      </main>
    );
  }

  if (error || !activation) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-black text-red-900">
            Activation status could not be loaded
          </h1>
          <p className="mt-2 text-sm text-red-800">{error}</p>
        </div>
      </main>
    );
  }

  const { people, safeguarding, policies, processes, adoption } = activation;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section
        className={
          activation.foundationComplete
            ? "bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 text-white"
            : "bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white"
        }
      >
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em]">
              Operational Activation
            </span>
            <span
              className={
                activation.foundationComplete
                  ? "rounded-full bg-emerald-300 px-3 py-1 text-xs font-black text-emerald-950"
                  : "rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-amber-950"
              }
            >
              {activation.foundationComplete
                ? "Core foundation active"
                : `${activation.blockerCount} blocking area${activation.blockerCount === 1 ? "" : "s"}`}
            </span>
          </div>

          <h1 className="mt-5 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
            {activation.foundationComplete
              ? "The school has the minimum governed operating foundation."
              : "Do not confuse installed modules with an operating school."}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
            KHP-OS becomes operational when authority is assigned, safeguarding
            coverage exists, critical policies are approved, and critical
            processes are published. This page measures those facts directly.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 sm:py-10">
        {actionMessage && (
          <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
            {actionMessage}
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <UsersRound className="size-6 text-brand-700" />
            <p className="mt-4 text-xs font-black uppercase tracking-[0.15em] text-slate-500">
              People & authority
            </p>
            <div className="mt-2">
              <Fraction
                complete={people.assignedMembers}
                total={people.activeMembers}
              />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Active members with at least one operating-role assignment.
            </p>
            <div className="mt-4 space-y-1 text-xs font-bold">
              <p className={people.custodianPresent ? "text-emerald-700" : "text-amber-700"}>
                {people.custodianPresent ? "✓" : "○"} Custodian authority
              </p>
              <p className={people.guardianPresent ? "text-emerald-700" : "text-amber-700"}>
                {people.guardianPresent ? "✓" : "○"} School Guardian authority
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <ShieldCheck className="size-6 text-rose-700" />
            <p className="mt-4 text-xs font-black uppercase tracking-[0.15em] text-slate-500">
              Safeguarding
            </p>
            <div className="mt-2">
              <Fraction
                complete={safeguarding.designatedCampuses}
                total={safeguarding.activeCampuses}
              />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Active campuses with both a lead and deputy designation.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <BookOpen className="size-6 text-amber-700" />
            <p className="mt-4 text-xs font-black uppercase tracking-[0.15em] text-slate-500">
              Critical policies
            </p>
            <div className="mt-2">
              <Fraction
                complete={policies.criticalActive}
                total={policies.criticalRegistered}
              />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              C0 policies with an active school-approved version.
            </p>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              All policies: {policies.active}/{policies.registered}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <FileCheck2 className="size-6 text-emerald-700" />
            <p className="mt-4 text-xs font-black uppercase tracking-[0.15em] text-slate-500">
              Critical processes
            </p>
            <div className="mt-2">
              <Fraction
                complete={processes.criticalActive}
                total={processes.criticalRegistered}
              />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              P0 processes with an active controlled procedure.
            </p>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              All processes: {processes.active}/{processes.registered}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              {activation.foundationComplete ? (
                <CheckCircle2 className="size-5" />
              ) : (
                <CircleAlert className="size-5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
                Do next
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {activation.foundationComplete
                  ? "Keep governance alive through daily execution."
                  : "Clear blockers in this order."}
              </h2>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {activation.actions.map((action, index) => (
              <Link
                key={action.key}
                href={action.href}
                className="group flex items-start gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50/50"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-950 text-xs font-black text-white">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-black text-slate-950">
                    {action.title}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-slate-600">
                    {action.detail}
                  </span>
                </span>
                <ArrowRight className="mt-1 size-4 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-brand-700" />
              </Link>
            ))}
          </div>
        </section>

        {!activation.foundationComplete && (
          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                C0 policy queue
              </p>
              <h2 className="mt-2 text-xl font-black">
                Policy comes before process.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {policies.criticalMissing} critical policies still need a controlled,
                approved version.
              </p>
              <div className="mt-5 space-y-2">
                {policies.missingCritical.map((policy) => (
                  <div
                    key={policy.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-amber-700">{policy.code}</p>
                        <p className="mt-1 text-sm font-black text-slate-900">
                          {policy.name}
                        </p>
                      </div>
                      <span className="text-right text-[11px] font-semibold text-slate-500">
                        {policy.ownerLabel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {policies.criticalMissing > policies.missingCritical.length && (
                <p className="mt-3 text-xs text-slate-500">
                  Showing {policies.missingCritical.length} of {policies.criticalMissing}.
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {activation.canPrepareDrafts && policies.criticalMissing > 0 && (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void prepareDrafts("policies")}
                    className="inline-flex items-center gap-2 rounded-full bg-amber-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
                  >
                    {busyAction === "policies" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <FileCheck2 className="size-4" />
                    )}
                    Prepare missing C0 drafts
                  </button>
                )}
                <Link
                  href={`/khpos/${organisationId}/library`}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-black text-white"
                >
                  Open policy register <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                P0 process queue
              </p>
              <h2 className="mt-2 text-xl font-black">
                Critical execution must be controlled.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {processes.criticalMissing} critical processes are inactive.{" "}
                {processes.blockedByPolicy} are blocked by policy dependencies;{" "}
                {processes.readyForDrafting} can proceed now.
              </p>
              <div className="mt-5 space-y-2">
                {processes.missingCritical.map((process) => (
                  <div
                    key={process.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-emerald-700">
                          {process.code}
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-900">
                          {process.title}
                        </p>
                        {process.missingPolicyCodes.length > 0 && (
                          <p className="mt-1 text-xs text-amber-700">
                            Waiting for: {process.missingPolicyCodes.join(", ")}
                          </p>
                        )}
                      </div>
                      <span className="text-right text-[11px] font-semibold text-slate-500">
                        {process.ownerLabel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {processes.criticalMissing > processes.missingCritical.length && (
                <p className="mt-3 text-xs text-slate-500">
                  Showing {processes.missingCritical.length} of {processes.criticalMissing}.
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {activation.canPrepareDrafts && processes.readyForDrafting > 0 && (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void prepareDrafts("processes")}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
                  >
                    {busyAction === "processes" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <FileCheck2 className="size-4" />
                    )}
                    Prepare ready P0 drafts
                  </button>
                )}
                <Link
                  href={`/khpos/${organisationId}/library`}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-black text-white"
                >
                  Open process register <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Adoption signals
          </p>
          <h2 className="mt-2 text-xl font-black">
            Governance only compounds when the school uses it.
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["Work records", adoption.workItems],
              ["Issues recorded", adoption.issues],
              ["Decisions recorded", adoption.decisions],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-2xl font-black">{String(value)}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{String(label)}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            These are usage signals, not activation blockers. A school can finish
            its foundation before volume builds, but sustained use is what turns
            KHP-OS from software into an operating system.
          </p>
        </section>
      </div>
    </main>
  );
}
