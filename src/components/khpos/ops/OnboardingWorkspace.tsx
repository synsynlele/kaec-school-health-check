"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FileCheck2,
  Loader2,
  PlayCircle,
  Route,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposOnboardingGuide } from "@/lib/khpos/ops/onboarding";

const practiceSteps = [
  ["start", "Start work", "Confirm you understand the responsibility and begin it in KHP-OS."],
  ["checklist", "Complete checklist", "Follow required controls rather than relying on memory."],
  ["evidence", "Add evidence", "Record proof that the work actually happened."],
  ["submit", "Submit", "Send completed work for verification when the process requires it."],
  ["verify", "Verification", "A different authorised role reviews the evidence and either verifies or returns the work."],
] as const;

function readable(value: string) {
  return value.replaceAll("_", " ");
}

export function OnboardingWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [guide, setGuide] = useState<KhposOnboardingGuide | null>(null);
  const [error, setError] = useState("");
  const [practiceIndex, setPracticeIndex] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const token = data.session?.access_token;
      if (!token) {
        setError("Your session has ended. Sign in again.");
        return;
      }

      const response = await fetch(
        `/api/khpos/ops/onboarding/${organisationId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        onboarding?: KhposOnboardingGuide;
        error?: string;
      };

      if (!active) return;
      if (!response.ok || !body.ok || !body.onboarding) {
        setError(body.error ?? "Your operating guide could not be loaded.");
        return;
      }

      setGuide(body.onboarding);
      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  if (!guide && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <Loader2 className="size-9 animate-spin text-mint-300" />
      </main>
    );
  }

  if (!guide) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <CircleAlert className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Operating guide unavailable</h1>
          <p className="mt-3 text-sm text-slate-300">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-black text-mint-200">
              <Route className="size-3.5" />
              My operating guide
            </span>
            <Link
              href={`/khpos/${organisationId}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black"
            >
              <ArrowLeft className="size-4" />
              Command Centre
            </Link>
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">Learn KHP-OS by your role.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
            Your guide is assembled from your live operating assignments, required
            policies and controlled processes. It changes automatically when your
            institutional role changes.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Roles", guide.summary.assignedRoles],
              ["Required policies", guide.summary.requiredPolicies],
              ["Acknowledged", guide.summary.policiesAcknowledged],
              ["Owned processes", guide.summary.ownedProcesses],
              ["Operationally ready", guide.summary.ready ? "Yes" : "Not yet"],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs font-bold text-brand-100">{label}</p>
                <p className="mt-1 text-2xl font-black">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        <section className="grid gap-4 lg:grid-cols-2">
          {guide.roles.map((role) => (
            <div key={role.assignmentId} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                  <UserRoundCheck className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-brand-700">{role.code}</p>
                  <h2 className="text-xl font-black">{role.title}</h2>
                </div>
              </div>
              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-black text-slate-500">Reports to</p>
                  <p className="mt-1 font-bold">{role.reportsTo ?? "Top institutional authority"}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-black text-slate-500">Scope</p>
                  <p className="mt-1 font-bold">
                    {role.unitName ?? role.campusName ?? "Institution-wide"}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {!guide.roles.length && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
              <CircleAlert className="size-6" />
              <h2 className="mt-3 text-xl font-black">No operating role assigned</h2>
              <p className="mt-2 text-sm leading-6">
                KHP-OS cannot infer authority. A school leader must assign the real operating role first.
              </p>
              <Link href={`/khpos/${organisationId}/team`} className="mt-4 inline-flex items-center gap-2 text-sm font-black">
                Open Team & Roles <ArrowRight className="size-4" />
              </Link>
            </div>
          )}
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">First actions</p>
          <h2 className="mt-2 text-2xl font-black">How to become ready</h2>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {guide.firstActions.map((item) => (
              <Link key={item.key} href={item.href} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:border-brand-300">
                <div className="flex gap-3">
                  {item.complete ? (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                  ) : (
                    <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-700" />
                  )}
                  <div>
                    <p className="font-black">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-6 text-brand-700" />
              <h2 className="text-xl font-black">Policies required for you</h2>
            </div>
            <div className="mt-5 space-y-2">
              {guide.requiredPolicies.map((policy) => (
                <Link
                  key={policy.id}
                  href={`/khpos/${organisationId}/library?tab=policies&q=${encodeURIComponent(policy.code)}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"
                >
                  <span>
                    <span className="block text-xs font-black text-brand-700">{policy.code}</span>
                    <span className="mt-1 block text-sm font-bold">{policy.name}</span>
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                    policy.acknowledged
                      ? "bg-emerald-100 text-emerald-800"
                      : policy.published
                        ? "bg-amber-100 text-amber-900"
                        : "bg-slate-200 text-slate-600"
                  }`}>
                    {policy.acknowledged ? "ACKNOWLEDGED" : policy.published ? "READ" : "PENDING PUBLICATION"}
                  </span>
                </Link>
              ))}
              {!guide.requiredPolicies.length && (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">No policy acknowledgement is currently assigned to your role.</p>
              )}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <FileCheck2 className="size-6 text-brand-700" />
              <h2 className="text-xl font-black">Processes connected to your role</h2>
            </div>
            <div className="mt-5 max-h-[32rem] space-y-2 overflow-y-auto pr-1">
              {guide.processes.map((process) => (
                <Link
                  key={process.id}
                  href={`/khpos/${organisationId}/library?tab=processes&q=${encodeURIComponent(process.code)}`}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 p-4 hover:border-brand-300"
                >
                  <span>
                    <span className="text-xs font-black text-brand-700">{process.code}</span>
                    <span className="mt-1 block text-sm font-black">{process.title}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[10px] font-black uppercase text-slate-500">{readable(process.participation)}</span>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-black ${
                      process.published ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                    }`}>
                      {process.published ? "PUBLISHED" : "NOT ACTIVE"}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="practice" className="rounded-[30px] border border-brand-200 bg-brand-50 p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <PlayCircle className="size-6 text-brand-700" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Safe simulation</p>
              <h2 className="mt-1 text-2xl font-black">Practice the KHP-OS work loop</h2>
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            This simulation writes nothing to institutional records. It teaches the operating sequence before a staff member handles real work.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-5">
            {practiceSteps.map(([key, title], index) => (
              <button
                key={key}
                type="button"
                onClick={() => setPracticeIndex(index)}
                className={`rounded-2xl border p-4 text-left ${
                  practiceIndex === index
                    ? "border-brand-500 bg-white shadow-sm"
                    : "border-brand-100 bg-brand-50/50"
                }`}
              >
                <span className="text-xs font-black text-brand-700">{index + 1}</span>
                <span className="mt-1 block text-sm font-black">{title}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-2xl bg-white p-5">
            <div className="flex items-start gap-3">
              <ClipboardCheck className="mt-0.5 size-5 text-brand-700" />
              <div>
                <p className="font-black">{practiceSteps[practiceIndex][1]}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{practiceSteps[practiceIndex][2]}</p>
                {practiceIndex < practiceSteps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setPracticeIndex((value) => value + 1)}
                    className="mt-4 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
                  >
                    Practice next step
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPracticeIndex(0)}
                    className="mt-4 rounded-full bg-emerald-700 px-4 py-2 text-xs font-black text-white"
                  >
                    Practice again
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
