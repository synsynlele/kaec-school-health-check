"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  Gauge,
  Loader2,
  LogOut,
  ShieldCheck,
  Target,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposWorkspaceSnapshot } from "@/lib/khpos/workspace";

const TRANSFORMATION_STAGES = [
  "Diagnose",
  "Interpret",
  "Prioritise",
  "Intervene",
  "Implement",
  "Evidence",
  "Review",
  "Reassess",
  "Improve",
];

export function CommandCentre({ organisationId }: { organisationId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] = useState<KhposWorkspaceSnapshot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setError("KHP-OS sign-in is not configured.");
      return;
    }

    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setError("Your session has ended. Return to your KSHC report and activate KHP-OS again.");
        return;
      }

      const response = await fetch(`/api/khpos/workspace/${organisationId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const body = (await response.json()) as {
        ok?: boolean;
        workspace?: KhposWorkspaceSnapshot;
        error?: string;
      };
      if (!active) return;
      if (!response.ok || !body.ok || !body.workspace) {
        setError(body.error ?? "The KHP-OS workspace could not be loaded.");
        return;
      }
      setWorkspace(body.workspace);
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    router.push("/");
  }

  if (!workspace && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-mint-400" />
          <p className="mt-4 text-sm font-semibold text-slate-300">Opening institutional command centre…</p>
        </div>
      </main>
    );
  }

  if (error || !workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <ShieldCheck className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">KHP-OS access could not be confirmed</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <button onClick={() => router.push("/")} className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950">
            Return to KSHC
          </button>
        </div>
      </main>
    );
  }

  const baseline = workspace.baseline;
  const location = [workspace.organisation.state, workspace.organisation.country].filter(Boolean).join(", ");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-white/10 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-mint-400 text-slate-950">
              <Activity className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-mint-300">KHP-OS | Schools</p>
              <p className="truncate text-sm font-extrabold text-white">Institutional Command Centre</p>
            </div>
          </div>
          <button onClick={signOut} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/10">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </header>

      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold">Baseline activated</span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold capitalize">
              {workspace.membership.role.replaceAll("_", " ")}
            </span>
          </div>
          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">{workspace.organisation.name}</h1>
              <p className="mt-3 text-sm text-brand-100">
                {[workspace.organisation.schoolType, workspace.organisation.schoolLevel, location].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-200">Current transformation position</p>
              <p className="mt-1 text-lg font-black">Diagnosis complete → Prioritisation next</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <Gauge className="size-6 text-brand-700" />
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">KSHC baseline</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-4xl font-black tracking-tight">{baseline?.overallScore ?? "—"}</span>
              {baseline?.overallScore !== null && baseline?.overallScore !== undefined && <span className="pb-1 text-sm font-bold text-slate-400">/100</span>}
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-600">{baseline?.healthRating ?? "Baseline awaiting completion"}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <Target className="size-6 text-amber-600" />
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">Primary attention area</p>
            <p className="mt-2 text-xl font-black text-slate-900">{baseline?.priorityArea ?? "Not yet identified"}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">This remains a diagnostic signal until leadership approves transformation priorities.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <Building2 className="size-6 text-mint-700" />
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">Institutional record</p>
            <p className="mt-2 text-xl font-black text-slate-900">Baseline preserved</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">KSHC framework v{baseline?.frameworkVersion ?? "1.0"} is now attached to this permanent school identity.</p>
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Transformation lifecycle</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">Your first KHP-OS cycle has started.</h2>
            </div>
            <span className="text-xs font-semibold text-slate-400">AI may propose. Humans decide. The system records.</span>
          </div>
          <div className="mt-7 grid gap-3 md:grid-cols-3 lg:grid-cols-9">
            {TRANSFORMATION_STAGES.map((stage, index) => {
              const done = index === 0;
              const current = index === 1 || index === 2;
              return (
                <div key={stage} className={`rounded-2xl border p-3 ${done ? "border-mint-200 bg-mint-50" : current ? "border-brand-200 bg-brand-50" : "border-slate-200 bg-slate-50"}`}>
                  {done ? <CheckCircle2 className="size-4 text-mint-700" /> : <Circle className={`size-4 ${current ? "text-brand-600" : "text-slate-300"}`} />}
                  <p className="mt-2 text-xs font-extrabold text-slate-800">{stage}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Diagnostic priorities</p>
                <h2 className="mt-2 text-2xl font-black">What KSHC says deserves leadership attention</h2>
              </div>
              <Target className="size-7 text-brand-700" />
            </div>
            <div className="mt-6 space-y-4">
              {workspace.priorityAreas.slice(0, 3).map((priority, index) => (
                <div key={`${priority.title}-${index}`} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex gap-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-950 text-xs font-black text-white">{index + 1}</span>
                    <div>
                      <p className="font-extrabold text-slate-900">{priority.title}</p>
                      <p className="mt-1.5 text-sm leading-6 text-slate-500">{priority.why}</p>
                      <p className="mt-3 text-sm leading-6"><span className="font-extrabold text-brand-700">Diagnostic first step:</span> <span className="text-slate-600">{priority.firstStep}</span></p>
                    </div>
                  </div>
                </div>
              ))}
              {!workspace.priorityAreas.length && <p className="text-sm text-slate-500">No structured priority areas were stored with this baseline report.</p>}
            </div>
          </div>

          <div className="rounded-[30px] bg-slate-950 p-6 text-white shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint-300">Next operating layer</p>
            <h2 className="mt-3 text-2xl font-black">Approve the few priorities that matter most.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              KSHC can identify many recommendations. KHP-OS will convert them into a small, human-approved transformation agenda with owners, interventions, evidence and review dates.
            </p>
            <div className="mt-7 rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-bold">Stage 2 — Priority & Intervention intelligence</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">The command centre is live now. Priority approval is the next capability to be activated.</p>
            </div>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-mint-300">
              Diagnosis is no longer the end <ArrowRight className="size-4" />
            </div>
          </div>
        </section>

        {!!workspace.departmentScores.length && (
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Baseline detail</p>
            <h2 className="mt-2 text-2xl font-black">The 11 KSHC areas preserved as your starting point</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {workspace.departmentScores.map((area) => (
                <div key={area.chapter} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold text-slate-800">{area.title}</p>
                    <span className="text-sm font-black text-slate-900">{area.score}%</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-brand-700" style={{ width: `${Math.max(0, Math.min(100, area.score))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
