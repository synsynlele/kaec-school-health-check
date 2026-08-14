"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BrainCircuit,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposPipupathWorkspace,
  PipupathSignalState,
} from "@/lib/khpos/pipupath-integration";

function tone(state: PipupathSignalState) {
  if (state === "strong") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (state === "developing") return "border-blue-200 bg-blue-50 text-blue-800";
  if (state === "attention") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function HumanPotentialIntelligenceWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] = useState<KhposPipupathWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busy, setBusy] = useState<"connect" | "refresh" | "">("");
  const [copied, setCopied] = useState(false);

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

        const response = await fetch(
          `/api/khpos/integrations/pipupath/${organisationId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          },
        );
        const body = (await response.json()) as {
          ok?: boolean;
          workspace?: KhposPipupathWorkspace;
          error?: string;
        };
        if (!active) return;
        if (!response.ok || !body.ok || !body.workspace) {
          setError(
            body.error ?? "Human Potential Intelligence could not be loaded.",
          );
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
            : "Human Potential Intelligence could not be loaded.",
        );
      });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  async function operate(action: "connect" | "refresh") {
    if (!supabase) return;
    setBusy(action);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session has ended. Sign in again to continue.");
      const response = await fetch(
        `/api/khpos/integrations/pipupath/${organisationId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        workspace?: KhposPipupathWorkspace;
        error?: string;
      };
      if (!response.ok || !body.ok || !body.workspace) {
        throw new Error(
          body.error ?? "PipuPath integration could not complete this action.",
        );
      }
      setWorkspace(body.workspace);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "PipuPath integration could not complete this action.",
      );
    } finally {
      setBusy("");
    }
  }

  async function copyInvitation() {
    const url = workspace?.integration.invitationUrl;
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

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
          <h1 className="mt-4 text-2xl font-black">
            Human Potential Intelligence unavailable
          </h1>
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

  const connected = workspace.integration.status === "active";
  const eligible = workspace.latest?.reportingEligible ?? false;

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
                KHP-OS | PipuPath Human Potential Intelligence
              </p>
              <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
                Is human potential actually moving into capability and value?
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                PipuPath remains private and learner-facing. KHP-OS receives only
                privacy-thresholded school-cohort signals that help leadership see
                institutional patterns.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Institution
              </p>
              <p className="mt-1 max-w-xs truncate text-lg font-black">
                {workspace.organisation.name}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                  Institutional cohort bridge
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {connected
                    ? "PipuPath is connected."
                    : "Connect this school to PipuPath."}
                </h2>
              </div>
              <BrainCircuit className="size-7 text-brand-700" />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Membership is never inferred. Learners voluntarily join the school
              development cohort inside PipuPath, while their profiles, missions,
              reflections, contacts and project content remain private.
            </p>
            {workspace.membership.canConnect && !connected && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void operate("connect")}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                {busy === "connect" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Users className="size-4" />
                )}
                Create school cohort connection
              </button>
            )}
            {connected &&
              workspace.integration.invitationUrl &&
              workspace.membership.canConnect && (
                <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50 p-5">
                  <p className="text-sm font-black text-brand-950">
                    Learner invitation link
                  </p>
                  <p className="mt-1 text-xs leading-5 text-brand-800">
                    Share this only with learners who belong to this institution.
                    Joining is voluntary and can be withdrawn in PipuPath.
                  </p>
                  <button
                    type="button"
                    onClick={() => void copyInvitation()}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-brand-900 shadow-sm"
                  >
                    {copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    {copied ? "Copied" : "Copy invitation"}
                  </button>
                </div>
              )}
          </div>

          <div className="rounded-[30px] bg-slate-950 p-6 text-white sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-mint-300">
              Privacy rule
            </p>
            <h2 className="mt-2 text-2xl font-black">No small-cohort leakage.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Detailed signals stay suppressed until at least{" "}
              {workspace.privacy.reportingMinimum} learners have voluntarily joined.
              When the cohort is smaller, KHP-OS receives zero detailed counts—not
              the exact small number.
            </p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-slate-200">
              Learner-level data received:{" "}
              <span className="text-mint-300">No</span>
            </div>
            {connected && workspace.membership.canConnect && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void operate("refresh")}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-mint-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
              >
                {busy === "refresh" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Refresh governed signals
              </button>
            )}
          </div>
        </section>

        {connected && (
          <section>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                  Four institutional signals
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  No composite score. No learner ranking.
                </h2>
              </div>
              <p className="text-xs font-semibold text-slate-400">
                {eligible
                  ? `Privacy-safe cohort: ${workspace.latest?.cohortMemberCount ?? 0} participants`
                  : `Reporting begins at ${workspace.privacy.reportingMinimum} participants`}
              </p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {workspace.signals.map((signal) => (
                <article
                  key={signal.key}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-lg font-black">{signal.title}</h3>
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase ${tone(signal.state)}`}
                    >
                      {signal.state}
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-black text-slate-800">
                    {signal.headline}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {signal.detail}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {signal.systems.map((system) => (
                      <span
                        key={system}
                        className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600"
                      >
                        {system}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-[30px] border border-amber-200 bg-amber-50 p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-800">
            Authority boundary
          </p>
          <h2 className="mt-2 text-xl font-black text-amber-950">
            PipuPath context can inform institutional judgement; it cannot certify
            institutional improvement.
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-amber-900">
            These signals may strengthen interpretation and review. They cannot close
            a KSHC priority, change a reassessment result or declare Verified
            Institutional Improvement. Fresh KSHC reassessment remains authoritative.
          </p>
        </section>
      </div>
    </main>
  );
}
