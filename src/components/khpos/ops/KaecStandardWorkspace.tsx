"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FileCheck2,
  Loader2,
  PauseCircle,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposStandardWorkspace } from "@/lib/khpos/ops/standard";

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}

function coverageTone(current: number, expected: number) {
  if (expected === 0) return "bg-slate-100 text-slate-700";
  if (current >= expected) return "bg-emerald-50 text-emerald-800";
  return "bg-amber-50 text-amber-900";
}

export function KaecStandardWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] = useState<KhposStandardWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busy, setBusy] = useState(false);

  const token = useCallback(async () => {
    if (!supabase) throw new Error("KHP-OS sign-in is not configured.");
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) {
      throw new Error("Your session has ended. Sign in again.");
    }
    return data.session.access_token;
  }, [supabase]);

  const load = useCallback(async () => {
    const accessToken = await token();
    const response = await fetch(
      "/api/khpos/ops/standard/" + organisationId,
      {
        headers: { Authorization: "Bearer " + accessToken },
        cache: "no-store",
      },
    );
    const body = (await response.json()) as {
      ok?: boolean;
      workspace?: KhposStandardWorkspace;
      error?: string;
    };
    if (!response.ok || !body.ok || !body.workspace) {
      throw new Error(
        body.error ?? "KAEC Standard workspace could not be loaded.",
      );
    }
    setWorkspace(body.workspace);
    setError("");
  }, [organisationId, token]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void Promise.resolve()
      .then(load)
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "KAEC Standard workspace could not be loaded.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [load, supabase]);

  async function adopt() {
    if (!workspace?.installation) return;

    setBusy(true);
    setError("");
    try {
      const accessToken = await token();
      const response = await fetch(
        "/api/khpos/ops/standard/" + organisationId,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "adopt_standard",
            installationId: workspace.installation.id,
          }),
        },
      );

      const body = (await response.json()) as {
        ok?: boolean;
        workspace?: KhposStandardWorkspace;
        error?: string;
      };

      if (!response.ok || !body.ok || !body.workspace) {
        throw new Error(
          body.error ?? "The KAEC Standard could not be adopted.",
        );
      }

      setWorkspace(body.workspace);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The KAEC Standard could not be adopted.",
      );
    } finally {
      setBusy(false);
    }
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
        <div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <CircleAlert className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">
            KAEC Standard unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
        </div>
      </main>
    );
  }

  const release = workspace.release;
  const installation = workspace.installation;
  const next = workspace.readiness.nextAction;
  const cards = [
    ["Policies", workspace.coverage.policies, BookOpen],
    ["Processes", workspace.coverage.processes, Workflow],
    ["Tools", workspace.coverage.tools, FileCheck2],
    ["Execution profiles", workspace.coverage.executionProfiles, ShieldCheck],
    ["Checklists", workspace.coverage.checklists, ClipboardCheck],
    ["Reports & logs", workspace.coverage.controlledRecords, FileCheck2],
  ] as const;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-black text-mint-200">
              One standard · local governance · full lineage
            </span>
            <Link
              href={"/khpos/" + organisationId}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black"
            >
              <ArrowLeft className="size-4" />
              Command Centre
            </Link>
          </div>

          <div className="mt-6 flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-mint-300 text-slate-950">
              <BadgeCheck className="size-6" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-mint-200">
                KHP-OS | KAEC Standard
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                Scale the operating standard, not founder memory.
              </h1>
              <p className="mt-4 max-w-4xl text-sm leading-7 text-brand-100">
                Every approved school receives the same versioned KAEC operating
                baseline. The school adopts it explicitly, may govern legitimate
                local revisions, and retains a clear history of what came from
                KAEC and what changed locally.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}

        {!release ? (
          <section className="rounded-[30px] border border-amber-200 bg-amber-50 p-7">
            <CircleAlert className="size-7 text-amber-800" />
            <h2 className="mt-3 text-2xl font-black">
              No active KAEC Standard release is published.
            </h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              School operations continue under their currently approved local
              controls. A platform release must exist before inheritance can begin.
            </p>
          </section>
        ) : (
          <>
            <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
                      Active platform release
                    </p>
                    <h2 className="mt-2 text-2xl font-black">{release.name}</h2>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {release.code} · version {release.version}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                    Platform standard
                  </span>
                </div>
                <p className="mt-5 text-sm leading-7 text-slate-600">
                  {release.description}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-500">Published</p>
                    <p className="mt-1 font-black">
                      {dateLabel(release.publishedAt)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-500">
                      Installation
                    </p>
                    <p className="mt-1 font-black capitalize">
                      {installation
                        ? readable(installation.status)
                        : "Not installed"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-500">
                      Adopted
                    </p>
                    <p className="mt-1 font-black">
                      {dateLabel(installation?.adoptedAt)}
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-[30px] bg-slate-950 p-6 text-white shadow-sm sm:p-8">
                <Sparkles className="size-7 text-mint-300" />
                <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-mint-300">
                  Next institutional action
                </p>
                <h2 className="mt-2 text-2xl font-black capitalize">
                  {next === "current"
                    ? "Standard is current"
                    : readable(next)}
                </h2>

                {next === "adopt" && (
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    The inherited release is unchanged and ready for explicit
                    institutional adoption by the active{" "}
                    {workspace.access.custodianLabel}.
                  </p>
                )}
                {next === "finish_local_governance" && (
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    A local edit deliberately broke baseline lineage. Complete
                    that revision through independent governance before blanket
                    adoption.
                  </p>
                )}
                {next === "activate_operations" && (
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    The standard is adopted. Recurring operating routines remain
                    paused until the school confirms real role holders and
                    deliberately activates execution.
                  </p>
                )}
                {next === "current" && (
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    The current standard is adopted and no standard-level action
                    is waiting.
                  </p>
                )}

                {workspace.readiness.blockers.length > 0 && (
                  <div className="mt-5 space-y-2">
                    {workspace.readiness.blockers.map((blocker) => (
                      <div
                        key={blocker}
                        className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100"
                      >
                        {blocker}
                      </div>
                    ))}
                  </div>
                )}

                {workspace.readiness.adoptable && installation && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void adopt()}
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-mint-300 px-5 py-3 text-xs font-black text-slate-950 disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <BadgeCheck className="size-4" />
                    )}
                    Adopt this KAEC Standard
                  </button>
                )}

                {next === "finish_local_governance" && (
                  <Link
                    href={"/khpos/" + organisationId + "/library"}
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-black text-slate-950"
                  >
                    Open Institutional Library
                    <ArrowRight className="size-4" />
                  </Link>
                )}

                {next === "activate_operations" && (
                  <Link
                    href={"/khpos/" + organisationId + "/execution-control"}
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-black text-slate-950"
                  >
                    Review Execution Control
                    <ArrowRight className="size-4" />
                  </Link>
                )}
              </article>
            </section>

            <section>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                Standard coverage
              </p>
              <h2 className="mt-2 text-2xl font-black">
                What is actually installed in this school?
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {cards.map(([label, item, Icon]) => (
                  <article
                    key={label}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <Icon className="size-5 text-brand-700" />
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-sm font-black">{label}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Current / expected
                        </p>
                      </div>
                      <span
                        className={
                          "rounded-full px-3 py-1 text-xs font-black " +
                          coverageTone(item.current, item.expected)
                        }
                      >
                        {item.current}/{item.expected}
                      </span>
                    </div>

                    {(item.inheritedDrafts ?? 0) > 0 && (
                      <p className="mt-3 text-xs font-semibold text-brand-700">
                        {item.inheritedDrafts} inherited baseline draft
                        {item.inheritedDrafts === 1 ? "" : "s"}
                      </p>
                    )}
                    {(item.localOpenRevisions ?? 0) > 0 && (
                      <p className="mt-2 text-xs font-semibold text-amber-800">
                        {item.localOpenRevisions} local revision
                        {item.localOpenRevisions === 1 ? "" : "s"} in governance
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
              <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <PauseCircle className="size-6 text-brand-700" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-brand-700">
                      Recurring operations
                    </p>
                    <h2 className="mt-1 text-xl font-black">
                      Safe activation boundary
                    </h2>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-slate-100 p-4">
                    <p className="text-xs font-bold text-slate-500">Installed</p>
                    <p className="mt-1 text-2xl font-black">
                      {workspace.coverage.recurringRules.current}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-4">
                    <p className="text-xs font-bold text-amber-800">Paused</p>
                    <p className="mt-1 text-2xl font-black text-amber-950">
                      {workspace.coverage.recurringRules.paused}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <p className="text-xs font-bold text-emerald-800">Active</p>
                    <p className="mt-1 text-2xl font-black text-emerald-950">
                      {workspace.coverage.recurringRules.active}
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-[30px] border border-brand-200 bg-brand-50 p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-brand-700" />
                  <div>
                    <h2 className="text-xl font-black">
                      Standardisation does not erase school judgement.
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-700">
                      The KAEC Standard supplies a tested baseline. If a school
                      changes an inherited policy or process, KHP-OS marks it as a
                      local revision and removes automatic baseline lineage. That
                      revision must complete the school&apos;s normal independent
                      governance before it becomes authoritative.
                    </p>
                  </div>
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
