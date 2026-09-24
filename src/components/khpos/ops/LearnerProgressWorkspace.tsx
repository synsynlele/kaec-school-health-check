"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpenCheck,
  CircleAlert,
  Loader2,
  ShieldCheck,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsLearnerProgressWorkspace,
  KhposOpsLearnerRiskSignal,
  KhposOpsLearnerSupportCase,
} from "@/lib/khpos/ops/learner-progress";

function readable(value: string | null | undefined) {
  return (value ?? "—").replaceAll("_", " ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function badgeClass(value: string) {
  if (["green", "recovered", "resolved", "confirmed", "closed"].includes(value))
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["amber", "improving", "open", "diagnosis"].includes(value))
    return "border-amber-200 bg-amber-50 text-amber-900";
  if (["red", "escalated", "no_improvement"].includes(value))
    return "border-orange-200 bg-orange-50 text-orange-900";
  if (["critical", "redirect", "redirected"].includes(value))
    return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function LearnerProgressWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] =
    useState<KhposOpsLearnerProgressWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const [anchorCampusId, setAnchorCampusId] = useState("");
  const [anchorSource, setAnchorSource] = useState("SIS");
  const [anchorExternalRef, setAnchorExternalRef] = useState("");
  const [anchorName, setAnchorName] = useState("");
  const [anchorClass, setAnchorClass] = useState("");
  const [anchorSection, setAnchorSection] = useState("");

  const [baselineLearnerId, setBaselineLearnerId] = useState("");
  const [baselineTermId, setBaselineTermId] = useState("");
  const [baselineSource, setBaselineSource] = useState("SIS");
  const [baselineStart, setBaselineStart] = useState("");
  const [baselineStrengths, setBaselineStrengths] = useState("");
  const [baselineGaps, setBaselineGaps] = useState("");
  const [baselineEvidence, setBaselineEvidence] = useState("");

  const [signalLearnerId, setSignalLearnerId] = useState("");
  const [signalTermId, setSignalTermId] = useState("");
  const [signalType, setSignalType] = useState("teacher_concern");
  const [signalSeverity, setSignalSeverity] = useState("amber");
  const [signalSource, setSignalSource] = useState("manual");
  const [signalSourceRef, setSignalSourceRef] = useState("");
  const [signalNote, setSignalNote] = useState("");
  const [signalObservedAt, setSignalObservedAt] = useState("");

  const [progressionLearnerId, setProgressionLearnerId] = useState("");
  const [progressionYear, setProgressionYear] = useState("");
  const [progressionFromClass, setProgressionFromClass] = useState("");
  const [progressionNextClass, setProgressionNextClass] = useState("");
  const [progressionDecision, setProgressionDecision] = useState("progress");
  const [progressionAttainment, setProgressionAttainment] = useState("");
  const [progressionFoundation, setProgressionFoundation] = useState("");
  const [progressionTrajectory, setProgressionTrajectory] = useState("");
  const [progressionIntervention, setProgressionIntervention] = useState("");
  const [progressionAttendance, setProgressionAttendance] = useState("");
  const [progressionExam, setProgressionExam] = useState("");
  const [progressionRationale, setProgressionRationale] = useState("");
  const [progressionSupport, setProgressionSupport] = useState("");
  const [progressionParentRef, setProgressionParentRef] = useState("");

  const [termReviewLearnerId, setTermReviewLearnerId] = useState("");
  const [termReviewTermId, setTermReviewTermId] = useState("");
  const [termReviewStatus, setTermReviewStatus] = useState("green");
  const [termReviewProgress, setTermReviewProgress] = useState("");
  const [termReviewRisks, setTermReviewRisks] = useState("");
  const [termReviewIntervention, setTermReviewIntervention] = useState("");
  const [termReviewActions, setTermReviewActions] = useState("");
  const [termReviewEvidence, setTermReviewEvidence] = useState("");

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [references, setReferences] = useState<Record<string, string>>({});
  const [selects, setSelects] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});

  async function token() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

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

      const response = await fetch(
        `/api/khpos/ops/learner-progress/${organisationId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        learnerProgress?: KhposOpsLearnerProgressWorkspace;
        error?: string;
      };

      if (!active) return;
      if (!response.ok || !body.ok || !body.learnerProgress) {
        setError(body.error ?? "Learner Progress could not be loaded.");
        return;
      }

      const next = body.learnerProgress;
      setWorkspace(next);
      setAnchorCampusId((current) => current || next.campuses[0]?.id || "");
      setBaselineLearnerId(
        (current) => current || next.learners[0]?.id || "",
      );
      setSignalLearnerId((current) => current || next.learners[0]?.id || "");
      setProgressionLearnerId(
        (current) => current || next.learners[0]?.id || "",
      );
      setTermReviewLearnerId(
        (current) => current || next.learners[0]?.id || "",
      );
      setBaselineTermId((current) => current || next.terms[0]?.id || "");
      setSignalTermId((current) => current || next.terms[0]?.id || "");
      setTermReviewTermId((current) => current || next.terms[0]?.id || "");
      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  async function submit(payload: Record<string, unknown>, busyKey: string) {
    const accessToken = await token();
    if (!accessToken) {
      setError("Your session has ended. Sign in again to continue.");
      return false;
    }

    setBusyId(busyKey);
    setError("");

    const response = await fetch(
      `/api/khpos/ops/learner-progress/${organisationId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const body = (await response.json()) as {
      ok?: boolean;
      learnerProgress?: KhposOpsLearnerProgressWorkspace;
      error?: string;
    };

    setBusyId(null);
    if (!response.ok || !body.ok || !body.learnerProgress) {
      setError(body.error ?? "Learner Progress operation could not be completed.");
      return false;
    }

    setWorkspace(body.learnerProgress);
    return true;
  }

  if (!workspace && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-brand-600" />
          <p className="mt-3 text-sm font-semibold text-slate-500">
            Loading Learner Progress…
          </p>
        </div>
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <CircleAlert className="mx-auto size-8 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">
            Learner Progress is unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <Link
            href={`/khpos/${organisationId}`}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black text-slate-950"
          >
            <ArrowLeft className="size-4" />
            Command Centre
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-bold text-mint-200">
              Operations · O14
            </span>
            <Link
              href={`/khpos/${organisationId}/academic-delivery`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black"
            >
              <ArrowLeft className="size-4" />
              Academic Delivery
            </Link>
          </div>

          <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-5xl">
            Learner Progress & Intervention
          </h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-brand-100 sm:text-base">
            Detect early. Diagnose before structured intervention. Assign a real
            owner. Review evidence. Close only after recovery or governed
            redirection.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {[
              ["Learners", workspace.summary.activeLearners],
              ["Open signals", workspace.summary.openSignals],
              ["Open cases", workspace.summary.openCases],
              ["Critical", workspace.summary.criticalCases],
              ["Reviews due", workspace.summary.reviewsDue],
              ["Recovered", workspace.summary.recoveredThisTerm],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-white/10 bg-white/10 p-4"
              >
                <p className="text-xs font-bold text-brand-100">{label}</p>
                <p className="mt-1 text-3xl font-black">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" />
              <div>
                <p className="text-sm font-black text-emerald-950">
                  No learner should quietly fall through the cracks
                </p>
                <p className="mt-1 text-sm leading-6 text-emerald-900/80">
                  {workspace.principle}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-[28px] border border-brand-200 bg-brand-50 p-5">
            <div className="flex gap-3">
              <BookOpenCheck className="mt-0.5 size-5 shrink-0 text-brand-700" />
              <div>
                <p className="text-sm font-black text-brand-950">
                  System boundary
                </p>
                <p className="mt-1 text-sm leading-6 text-brand-900/80">
                  {workspace.systemBoundary}
                </p>
              </div>
            </div>
          </div>
        </section>

        {workspace.executiveSummaryOnly ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
            <UserRoundSearch className="size-7 text-brand-700" />
            <h2 className="mt-3 text-xl font-black">
              Aggregate learner-risk visibility
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              This account receives institutional learner-risk patterns by
              default, not routine individual learner identities or intervention
              case files. Individual cases remain with the operating leadership
              responsible for them.
            </p>
          </section>
        ) : (
          <>
            {workspace.canCoordinate ? (
              <section className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
                    Minimal learner anchor
                  </p>
                  <h2 className="mt-2 text-xl font-black">
                    Link KHP-OS to the authoritative learner record
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Store only the identity/context needed to run support work.
                    The SIS remains authoritative.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <select
                      value={anchorCampusId}
                      onChange={(event) => setAnchorCampusId(event.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    >
                      <option value="">Choose campus</option>
                      {workspace.campuses.map((campus) => (
                        <option key={campus.id} value={campus.id}>
                          {campus.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={anchorSource}
                      onChange={(event) => setAnchorSource(event.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    >
                      <option value="SIS">SIS</option>
                      <option value="external">External</option>
                      <option value="manual">Manual</option>
                    </select>
                    <input
                      value={anchorExternalRef}
                      onChange={(event) =>
                        setAnchorExternalRef(event.target.value)
                      }
                      placeholder="External learner ID"
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <input
                      value={anchorName}
                      onChange={(event) => setAnchorName(event.target.value)}
                      placeholder="Display name"
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <input
                      value={anchorClass}
                      onChange={(event) => setAnchorClass(event.target.value)}
                      placeholder="Class, e.g. JSS1"
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <input
                      value={anchorSection}
                      onChange={(event) => setAnchorSection(event.target.value)}
                      placeholder="Section, e.g. A"
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void submit(
                        {
                          mode: "upsert_learner",
                          campusId: anchorCampusId,
                          externalSystem: anchorSource,
                          externalLearnerReference: anchorExternalRef,
                          displayName: anchorName,
                          classLabel: anchorClass,
                          sectionLabel: anchorSection,
                        },
                        "anchor",
                      )
                    }
                    disabled={busyId === "anchor"}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                  >
                    {busyId === "anchor" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <UsersRound className="size-3.5" />
                    )}
                    Save learner anchor
                  </button>
                </div>

                <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">
                    Baseline
                  </p>
                  <h2 className="mt-2 text-xl font-black">
                    Record the learner starting point
                  </h2>
                  <div className="mt-5 space-y-3">
                    <select
                      value={baselineLearnerId}
                      onChange={(event) =>
                        setBaselineLearnerId(event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    >
                      <option value="">Choose learner</option>
                      {workspace.learners.map((learner) => (
                        <option key={learner.id} value={learner.id}>
                          {learner.displayName} · {learner.classLabel}
                          {learner.sectionLabel
                            ? ` ${learner.sectionLabel}`
                            : ""}
                        </option>
                      ))}
                    </select>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        value={baselineTermId}
                        onChange={(event) => setBaselineTermId(event.target.value)}
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      >
                        <option value="">No term / entry baseline</option>
                        {workspace.terms.map((term) => (
                          <option key={term.id} value={term.id}>
                            {term.sessionLabel} · {term.termName}
                          </option>
                        ))}
                      </select>
                      <select
                        value={baselineSource}
                        onChange={(event) =>
                          setBaselineSource(event.target.value)
                        }
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      >
                        <option value="SIS">SIS</option>
                        <option value="KSI">KSI</option>
                        <option value="external">External</option>
                        <option value="manual">Manual</option>
                      </select>
                    </div>
                    <textarea
                      value={baselineStart}
                      onChange={(event) => setBaselineStart(event.target.value)}
                      rows={3}
                      placeholder="Starting point summary"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <textarea
                      value={baselineStrengths}
                      onChange={(event) =>
                        setBaselineStrengths(event.target.value)
                      }
                      rows={2}
                      placeholder="Strengths"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <textarea
                      value={baselineGaps}
                      onChange={(event) => setBaselineGaps(event.target.value)}
                      rows={2}
                      placeholder="Priority learning gaps"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <input
                      value={baselineEvidence}
                      onChange={(event) =>
                        setBaselineEvidence(event.target.value)
                      }
                      placeholder="Evidence reference"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void submit(
                        {
                          mode: "record_baseline",
                          learnerId: baselineLearnerId,
                          termId: baselineTermId || null,
                          baselineSource,
                          startingPointSummary: baselineStart,
                          strengthsSummary: baselineStrengths,
                          priorityGapsSummary: baselineGaps,
                          evidenceReference: baselineEvidence,
                        },
                        "baseline",
                      )
                    }
                    disabled={busyId === "baseline"}
                    className="mt-4 rounded-full bg-violet-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                  >
                    Record baseline
                  </button>
                </div>
              </section>
            ) : null}

            {workspace.canReport ? (
              <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                  Early risk detection
                </p>
                <h2 className="mt-2 text-xl font-black">
                  Record one specific learner-risk signal
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  A signal is a reason to investigate—not a permanent label on
                  the learner.
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <select
                    value={signalLearnerId}
                    onChange={(event) => setSignalLearnerId(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="">Choose learner</option>
                    {workspace.learners.map((learner) => (
                      <option key={learner.id} value={learner.id}>
                        {learner.displayName} · {learner.classLabel}
                        {learner.sectionLabel ? ` ${learner.sectionLabel}` : ""}
                      </option>
                    ))}
                  </select>
                  <select
                    value={signalTermId}
                    onChange={(event) => setSignalTermId(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="">No term link</option>
                    {workspace.terms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.sessionLabel} · {term.termName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={signalType}
                    onChange={(event) => setSignalType(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    {[
                      "low_formative_performance",
                      "sharp_decline",
                      "incomplete_work",
                      "absence_pattern",
                      "prerequisite_gap",
                      "teacher_concern",
                      "behaviour_interference",
                      "external_diagnostic",
                      "other",
                    ].map((value) => (
                      <option key={value} value={value}>
                        {readable(value)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={signalSeverity}
                    onChange={(event) => setSignalSeverity(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="amber">Amber</option>
                    <option value="red">Red</option>
                    <option value="critical">Critical</option>
                  </select>
                  <select
                    value={signalSource}
                    onChange={(event) => setSignalSource(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="manual">Teacher/manual evidence</option>
                    <option value="SIS">SIS</option>
                    <option value="KSI">KSI</option>
                    <option value="KHP">KHP-OS</option>
                    <option value="external">External</option>
                  </select>
                  <input
                    value={signalSourceRef}
                    onChange={(event) => setSignalSourceRef(event.target.value)}
                    placeholder="Evidence/source reference"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <input
                    type="datetime-local"
                    value={signalObservedAt}
                    onChange={(event) => setSignalObservedAt(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void submit(
                        {
                          mode: "create_signal",
                          learnerId: signalLearnerId,
                          termId: signalTermId || null,
                          streamId: null,
                          academicDebtId: null,
                          signalType,
                          severity: signalSeverity,
                          sourceSystem: signalSource,
                          sourceReference: signalSourceRef || null,
                          signalNote,
                          observedAt: signalObservedAt
                            ? new Date(signalObservedAt).toISOString()
                            : "",
                        },
                        "signal",
                      )
                    }
                    disabled={busyId === "signal"}
                    className="rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
                  >
                    Record signal
                  </button>
                  <textarea
                    value={signalNote}
                    onChange={(event) => setSignalNote(event.target.value)}
                    rows={3}
                    placeholder="What specific pattern or concern did you observe?"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:col-span-2 xl:col-span-4"
                  />
                </div>
              </section>
            ) : null}

            <section>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                Risk signals
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Early concerns waiting for response
              </h2>
              {workspace.signals.length === 0 ? (
                <Empty text="No learner-risk signals are visible." />
              ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {workspace.signals.map((signal) => (
                    <RiskSignalCard
                      key={signal.id}
                      signal={signal}
                      workspace={workspace}
                      busyId={busyId}
                      notes={notes}
                      references={references}
                      selects={selects}
                      dates={dates}
                      setNotes={setNotes}
                      setReferences={setReferences}
                      setSelects={setSelects}
                      setDates={setDates}
                      submit={submit}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
                Structured support
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Diagnose → intervene → reassess → recover or redirect
              </h2>
              {workspace.cases.length === 0 ? (
                <Empty text="No structured learner-support cases are visible." />
              ) : (
                <div className="mt-4 space-y-5">
                  {workspace.cases.map((supportCase) => (
                    <SupportCaseCard
                      key={supportCase.id}
                      supportCase={supportCase}
                      workspace={workspace}
                      notes={notes}
                      references={references}
                      selects={selects}
                      dates={dates}
                      setNotes={setNotes}
                      setReferences={setReferences}
                      setSelects={setSelects}
                      setDates={setDates}
                      submit={submit}
                    />
                  ))}
                </div>
              )}
            </section>

            {workspace.canManage ? (
              <section className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-fuchsia-700">
                    Formal progression
                  </p>
                  <h2 className="mt-2 text-xl font-black">
                    Propose a multi-evidence progression decision
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    No single score, AI diagnosis, attendance signal or fee status
                    can make this decision automatically.
                  </p>
                  <div className="mt-5 grid gap-3">
                    <select
                      value={progressionLearnerId}
                      onChange={(event) =>
                        setProgressionLearnerId(event.target.value)
                      }
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    >
                      <option value="">Choose learner</option>
                      {workspace.learners.map((learner) => (
                        <option key={learner.id} value={learner.id}>
                          {learner.displayName} · {learner.classLabel}
                        </option>
                      ))}
                    </select>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={progressionYear}
                        onChange={(event) =>
                          setProgressionYear(event.target.value)
                        }
                        placeholder="Academic year"
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                      <select
                        value={progressionDecision}
                        onChange={(event) =>
                          setProgressionDecision(event.target.value)
                        }
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      >
                        {[
                          "progress",
                          "progress_with_support",
                          "retain_reteach",
                          "defer_pending_review",
                          "external_review_required",
                          "graduate_transition",
                        ].map((value) => (
                          <option key={value} value={value}>
                            {readable(value)}
                          </option>
                        ))}
                      </select>
                      <input
                        value={progressionFromClass}
                        onChange={(event) =>
                          setProgressionFromClass(event.target.value)
                        }
                        placeholder="Current class"
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                      <input
                        value={progressionNextClass}
                        onChange={(event) =>
                          setProgressionNextClass(event.target.value)
                        }
                        placeholder="Proposed next class"
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </div>
                    <input
                      value={progressionAttainment}
                      onChange={(event) =>
                        setProgressionAttainment(event.target.value)
                      }
                      placeholder="SIS/assessment attainment reference"
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <textarea
                      value={progressionFoundation}
                      onChange={(event) =>
                        setProgressionFoundation(event.target.value)
                      }
                      rows={2}
                      placeholder="Foundational-gap summary"
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <textarea
                      value={progressionTrajectory}
                      onChange={(event) =>
                        setProgressionTrajectory(event.target.value)
                      }
                      rows={2}
                      placeholder="Trajectory summary"
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <textarea
                      value={progressionIntervention}
                      onChange={(event) =>
                        setProgressionIntervention(event.target.value)
                      }
                      rows={2}
                      placeholder="Intervention/reassessment summary"
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={progressionAttendance}
                        onChange={(event) =>
                          setProgressionAttendance(event.target.value)
                        }
                        placeholder="Attendance evidence reference"
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                      <input
                        value={progressionExam}
                        onChange={(event) => setProgressionExam(event.target.value)}
                        placeholder="Exam requirement summary"
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </div>
                    <textarea
                      value={progressionRationale}
                      onChange={(event) =>
                        setProgressionRationale(event.target.value)
                      }
                      rows={3}
                      placeholder="Reasoned decision"
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <textarea
                      value={progressionSupport}
                      onChange={(event) =>
                        setProgressionSupport(event.target.value)
                      }
                      rows={2}
                      placeholder="Required support carried forward"
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <input
                      value={progressionParentRef}
                      onChange={(event) =>
                        setProgressionParentRef(event.target.value)
                      }
                      placeholder="Parent meeting reference for high-impact decision"
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void submit(
                        {
                          mode: "create_progression",
                          learnerId: progressionLearnerId,
                          academicYear: progressionYear,
                          fromClassLabel: progressionFromClass,
                          proposedNextClassLabel: progressionNextClass,
                          decision: progressionDecision,
                          attainmentReference: progressionAttainment,
                          foundationalGapSummary: progressionFoundation,
                          trajectorySummary: progressionTrajectory,
                          interventionSummary: progressionIntervention,
                          attendanceReference: progressionAttendance,
                          examRequirementSummary: progressionExam,
                          decisionRationale: progressionRationale,
                          requiredSupport: progressionSupport,
                          parentMeetingReference: progressionParentRef,
                        },
                        "progression",
                      )
                    }
                    disabled={busyId === "progression"}
                    className="mt-4 rounded-full bg-fuchsia-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                  >
                    Propose decision
                  </button>
                </div>

                <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                    Term review
                  </p>
                  <h2 className="mt-2 text-xl font-black">
                    Carry unresolved support into the next term
                  </h2>
                  <div className="mt-5 space-y-3">
                    <select
                      value={termReviewLearnerId}
                      onChange={(event) =>
                        setTermReviewLearnerId(event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    >
                      <option value="">Choose learner</option>
                      {workspace.learners.map((learner) => (
                        <option key={learner.id} value={learner.id}>
                          {learner.displayName} · {learner.classLabel}
                        </option>
                      ))}
                    </select>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        value={termReviewTermId}
                        onChange={(event) =>
                          setTermReviewTermId(event.target.value)
                        }
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      >
                        <option value="">Choose term</option>
                        {workspace.terms.map((term) => (
                          <option key={term.id} value={term.id}>
                            {term.sessionLabel} · {term.termName}
                          </option>
                        ))}
                      </select>
                      <select
                        value={termReviewStatus}
                        onChange={(event) =>
                          setTermReviewStatus(event.target.value)
                        }
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      >
                        <option value="green">Green</option>
                        <option value="amber">Amber</option>
                        <option value="red">Red</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <textarea
                      value={termReviewProgress}
                      onChange={(event) =>
                        setTermReviewProgress(event.target.value)
                      }
                      rows={3}
                      placeholder="Progress summary"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <textarea
                      value={termReviewRisks}
                      onChange={(event) => setTermReviewRisks(event.target.value)}
                      rows={2}
                      placeholder="Open risks"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <textarea
                      value={termReviewIntervention}
                      onChange={(event) =>
                        setTermReviewIntervention(event.target.value)
                      }
                      rows={2}
                      placeholder="Intervention summary"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <textarea
                      value={termReviewActions}
                      onChange={(event) =>
                        setTermReviewActions(event.target.value)
                      }
                      rows={2}
                      placeholder="Next-term actions"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <input
                      value={termReviewEvidence}
                      onChange={(event) =>
                        setTermReviewEvidence(event.target.value)
                      }
                      placeholder="Evidence reference"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void submit(
                        {
                          mode: "term_review",
                          learnerId: termReviewLearnerId,
                          termId: termReviewTermId,
                          overallStatus: termReviewStatus,
                          progressSummary: termReviewProgress,
                          openRisksSummary: termReviewRisks,
                          interventionSummary: termReviewIntervention,
                          nextTermActions: termReviewActions,
                          evidenceReference: termReviewEvidence,
                        },
                        "term-review",
                      )
                    }
                    disabled={busyId === "term-review"}
                    className="mt-4 rounded-full bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                  >
                    Save term review
                  </button>
                </div>
              </section>
            ) : null}

            {workspace.progressionDecisions.length > 0 ? (
              <section>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-fuchsia-700">
                  Progression decisions
                </p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {workspace.progressionDecisions.map((decision) => (
                    <article
                      key={decision.id}
                      className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-black capitalize ${badgeClass(
                            decision.status,
                          )}`}
                        >
                          {readable(decision.status)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black capitalize text-slate-700">
                          {readable(decision.decision)}
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-black">
                        {decision.learnerName} · {decision.academicYear}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {decision.decisionRationale}
                      </p>
                      {decision.requiredSupport ? (
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          Support: {decision.requiredSupport}
                        </p>
                      ) : null}
                      {workspace.canManage && decision.status === "proposed" ? (
                        <div className="mt-4 space-y-2">
                          <textarea
                            value={notes[`progression-${decision.id}`] ?? ""}
                            onChange={(event) =>
                              setNotes((current) => ({
                                ...current,
                                [`progression-${decision.id}`]:
                                  event.target.value,
                              }))
                            }
                            rows={2}
                            placeholder="Confirmation/cancellation note"
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void submit(
                                  {
                                    mode: "progression_action",
                                    decisionId: decision.id,
                                    action: "confirm",
                                    confirmationNote:
                                      notes[
                                        `progression-${decision.id}`
                                      ] ?? "",
                                  },
                                  `progression-confirm-${decision.id}`,
                                )
                              }
                              className="rounded-full bg-emerald-700 px-3 py-2 text-xs font-black text-white"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void submit(
                                  {
                                    mode: "progression_action",
                                    decisionId: decision.id,
                                    action: "cancel",
                                    confirmationNote:
                                      notes[
                                        `progression-${decision.id}`
                                      ] ?? "",
                                  },
                                  `progression-cancel-${decision.id}`,
                                )
                              }
                              className="rounded-full border border-slate-200 px-3 py-2 text-xs font-black text-slate-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-[28px] border border-dashed border-slate-300 bg-white p-7 text-center text-sm font-semibold text-slate-500">
      {text}
    </div>
  );
}

function RiskSignalCard({
  signal,
  workspace,
  busyId,
  notes,
  references,
  selects,
  dates,
  setNotes,
  setReferences,
  setSelects,
  setDates,
  submit,
}: {
  signal: KhposOpsLearnerRiskSignal;
  workspace: KhposOpsLearnerProgressWorkspace;
  busyId: string | null;
  notes: Record<string, string>;
  references: Record<string, string>;
  selects: Record<string, string>;
  dates: Record<string, string>;
  setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setReferences: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setSelects: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setDates: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  submit: (payload: Record<string, unknown>, busyKey: string) => Promise<boolean>;
}) {
  const responseKey = `signal-response-${signal.id}`;
  const responseRefKey = `signal-ref-${signal.id}`;
  const ownerKey = `signal-owner-${signal.id}`;
  const reviewKey = `signal-review-${signal.id}`;
  const concernKey = `signal-concern-${signal.id}`;
  const caseOwners = workspace.assignments.filter((item) =>
    ["SECTIONAL_PROMOTER", "ACADEMIC_INSPECTOR", "SCHOOL_GUARDIAN"].includes(
      item.roleCode,
    ),
  );

  return (
    <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-black capitalize ${badgeClass(
            signal.severity,
          )}`}
        >
          {signal.severity}
        </span>
        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-black capitalize ${badgeClass(
            signal.status,
          )}`}
        >
          {signal.status}
        </span>
        <span className="text-[11px] font-bold text-slate-400">
          {signal.reference}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-black">
        {signal.learnerName} · {signal.classLabel}
        {signal.sectionLabel ? ` ${signal.sectionLabel}` : ""}
      </h3>
      <p className="mt-1 text-xs font-bold capitalize text-slate-500">
        {readable(signal.signalType)} · {signal.sourceSystem}
      </p>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {signal.signalNote}
      </p>
      <p className="mt-2 text-xs text-slate-400">
        Observed {formatDateTime(signal.observedAt)}
      </p>

      {signal.canResolveQuickly ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-black text-amber-950">
            Amber quick response
          </p>
          <textarea
            value={notes[responseKey] ?? ""}
            onChange={(event) =>
              setNotes((current) => ({
                ...current,
                [responseKey]: event.target.value,
              }))
            }
            rows={2}
            placeholder="What did you do, and what changed?"
            className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs"
          />
          <input
            value={references[responseRefKey] ?? ""}
            onChange={(event) =>
              setReferences((current) => ({
                ...current,
                [responseRefKey]: event.target.value,
              }))
            }
            placeholder="Evidence reference"
            className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs"
          />
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "resolve_signal",
                  signalId: signal.id,
                  action: "resolve",
                  responseNote: notes[responseKey] ?? "",
                  evidenceReference: references[responseRefKey] ?? null,
                },
                `signal-resolve-${signal.id}`,
              )
            }
            disabled={busyId === `signal-resolve-${signal.id}`}
            className="mt-2 rounded-full bg-amber-800 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
          >
            Resolve with evidence
          </button>
        </div>
      ) : null}

      {workspace.canCoordinate &&
      signal.status === "open" &&
      !signal.linkedCaseId ? (
        <details className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-3">
          <summary className="cursor-pointer text-xs font-black text-brand-950">
            Open structured support case
          </summary>
          <div className="mt-3 grid gap-2">
            <select
              value={selects[ownerKey] ?? ""}
              onChange={(event) =>
                setSelects((current) => ({
                  ...current,
                  [ownerKey]: event.target.value,
                }))
              }
              className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs"
            >
              <option value="">Choose case owner</option>
              {caseOwners.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.roleTitle} · {item.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dates[reviewKey] ?? ""}
              onChange={(event) =>
                setDates((current) => ({
                  ...current,
                  [reviewKey]: event.target.value,
                }))
              }
              className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs"
            />
            <textarea
              value={notes[concernKey] ?? signal.signalNote}
              onChange={(event) =>
                setNotes((current) => ({
                  ...current,
                  [concernKey]: event.target.value,
                }))
              }
              rows={2}
              className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs"
            />
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "create_case",
                    learnerId: signal.learnerId,
                    primarySignalId: signal.id,
                    termId: null,
                    severity: signal.severity,
                    concernSummary: notes[concernKey] ?? signal.signalNote,
                    caseOwnerAssignmentId: selects[ownerKey] ?? "",
                    reviewDueDate: dates[reviewKey] ?? "",
                  },
                  `signal-case-${signal.id}`,
                )
              }
              className="rounded-full bg-brand-700 px-3 py-2 text-xs font-black text-white"
            >
              Open case
            </button>
          </div>
        </details>
      ) : null}
    </article>
  );
}

function SupportCaseCard({
  supportCase,
  workspace,
  notes,
  references,
  selects,
  dates,
  setNotes,
  setReferences,
  setSelects,
  setDates,
  submit,
}: {
  supportCase: KhposOpsLearnerSupportCase;
  workspace: KhposOpsLearnerProgressWorkspace;
  notes: Record<string, string>;
  references: Record<string, string>;
  selects: Record<string, string>;
  dates: Record<string, string>;
  setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setReferences: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setSelects: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setDates: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  submit: (payload: Record<string, unknown>, busyKey: string) => Promise<boolean>;
}) {
  const diagnosisSummaryKey = `diag-summary-${supportCase.id}`;
  const diagnosisEvidenceKey = `diag-evidence-${supportCase.id}`;
  const diagnosisRefKey = `diag-ref-${supportCase.id}`;
  const diagnosisBarrierKey = `diag-barriers-${supportCase.id}`;
  const interventionOwnerKey = `int-owner-${supportCase.id}`;
  const interventionTierKey = `int-tier-${supportCase.id}`;
  const interventionTargetKey = `int-target-${supportCase.id}`;
  const interventionPlanKey = `int-plan-${supportCase.id}`;
  const interventionStartKey = `int-start-${supportCase.id}`;
  const interventionReviewKey = `int-review-${supportCase.id}`;
  const interventionCriteriaKey = `int-criteria-${supportCase.id}`;
  const parentSummaryKey = `parent-summary-${supportCase.id}`;
  const parentActionKey = `parent-action-${supportCase.id}`;
  const parentRefKey = `parent-ref-${supportCase.id}`;
  const reassessOutcomeKey = `reassess-outcome-${supportCase.id}`;
  const reassessInterventionKey = `reassess-intervention-${supportCase.id}`;
  const reassessEvidenceKey = `reassess-evidence-${supportCase.id}`;
  const reassessRefKey = `reassess-ref-${supportCase.id}`;
  const reassessNextKey = `reassess-next-${supportCase.id}`;
  const escalationOwnerKey = `escalate-owner-${supportCase.id}`;
  const escalationSeverityKey = `escalate-severity-${supportCase.id}`;
  const escalationNoteKey = `escalate-note-${supportCase.id}`;
  const issueRefKey = `escalate-issue-${supportCase.id}`;
  const closeKey = `close-${supportCase.id}`;

  const caseOwners = workspace.assignments.filter((item) =>
    ["SECTIONAL_PROMOTER", "ACADEMIC_INSPECTOR", "SCHOOL_GUARDIAN"].includes(
      item.roleCode,
    ),
  );

  return (
    <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-white">
              {supportCase.reference}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-[11px] font-black capitalize ${badgeClass(
                supportCase.severity,
              )}`}
            >
              {supportCase.severity}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-[11px] font-black capitalize ${badgeClass(
                supportCase.status,
              )}`}
            >
              {readable(supportCase.status)}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-black">
            {supportCase.learnerName} · {supportCase.classLabel}
            {supportCase.sectionLabel
              ? ` ${supportCase.sectionLabel}`
              : ""}
          </h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
            {supportCase.concernSummary}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 text-xs">
          <p className="font-black uppercase tracking-[0.12em] text-slate-500">
            Review due
          </p>
          <p className="mt-2 font-bold">{formatDate(supportCase.reviewDueDate)}</p>
        </div>
      </div>

      {supportCase.diagnosis ? (
        <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-violet-700">
            Current diagnosis hypothesis · v{supportCase.diagnosis.version}
          </p>
          <p className="mt-2 text-sm leading-6 text-violet-950">
            {supportCase.diagnosis.diagnosisSummary}
          </p>
          <p className="mt-2 text-xs leading-5 text-violet-800">
            Evidence: {supportCase.diagnosis.evidenceNote}
          </p>
        </div>
      ) : null}

      {supportCase.canCoordinate &&
      !["closed", "redirected"].includes(supportCase.status) ? (
        <details className="mt-4 rounded-2xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-black">
            Record / revise diagnosis
          </summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <input
              value={references[diagnosisBarrierKey] ?? ""}
              onChange={(event) =>
                setReferences((current) => ({
                  ...current,
                  [diagnosisBarrierKey]: event.target.value,
                }))
              }
              placeholder="Barrier categories, comma separated"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <select
              value={selects[`diag-source-${supportCase.id}`] ?? "manual"}
              onChange={(event) =>
                setSelects((current) => ({
                  ...current,
                  [`diag-source-${supportCase.id}`]: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            >
              <option value="manual">Manual/evidence review</option>
              <option value="KSI">KSI</option>
              <option value="SIS">SIS</option>
              <option value="external">External</option>
            </select>
            <textarea
              value={notes[diagnosisSummaryKey] ?? ""}
              onChange={(event) =>
                setNotes((current) => ({
                  ...current,
                  [diagnosisSummaryKey]: event.target.value,
                }))
              }
              rows={2}
              placeholder="Diagnosis summary"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs md:col-span-2"
            />
            <textarea
              value={notes[diagnosisEvidenceKey] ?? ""}
              onChange={(event) =>
                setNotes((current) => ({
                  ...current,
                  [diagnosisEvidenceKey]: event.target.value,
                }))
              }
              rows={2}
              placeholder="What evidence supports this hypothesis?"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              value={references[diagnosisRefKey] ?? ""}
              onChange={(event) =>
                setReferences((current) => ({
                  ...current,
                  [diagnosisRefKey]: event.target.value,
                }))
              }
              placeholder="Evidence reference"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "record_diagnosis",
                  caseId: supportCase.id,
                  barrierCategories: (
                    references[diagnosisBarrierKey] ?? ""
                  )
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                  diagnosisSummary: notes[diagnosisSummaryKey] ?? "",
                  evidenceNote: notes[diagnosisEvidenceKey] ?? "",
                  evidenceReference: references[diagnosisRefKey] ?? "",
                  diagnosisSource:
                    selects[`diag-source-${supportCase.id}`] ?? "manual",
                },
                `diagnosis-${supportCase.id}`,
              )
            }
            className="mt-3 rounded-full bg-violet-700 px-3 py-2 text-xs font-black text-white"
          >
            Save diagnosis
          </button>
        </details>
      ) : null}

      {supportCase.canCoordinate &&
      supportCase.diagnosis &&
      !["closed", "redirected"].includes(supportCase.status) ? (
        <details className="mt-4 rounded-2xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-black">
            Create intervention plan
          </summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <select
              value={selects[interventionOwnerKey] ?? ""}
              onChange={(event) =>
                setSelects((current) => ({
                  ...current,
                  [interventionOwnerKey]: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            >
              <option value="">Choose owner</option>
              {workspace.assignments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.roleTitle} · {item.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <select
              value={selects[interventionTierKey] ?? "2"}
              onChange={(event) =>
                setSelects((current) => ({
                  ...current,
                  [interventionTierKey]: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            >
              <option value="1">Tier 1 · classroom response</option>
              <option value="2">Tier 2 · structured support</option>
              <option value="3">Tier 3 · leadership/specialist support</option>
              <option value="4">Tier 4 · enhanced/external support</option>
            </select>
            <textarea
              value={notes[interventionTargetKey] ?? ""}
              onChange={(event) =>
                setNotes((current) => ({
                  ...current,
                  [interventionTargetKey]: event.target.value,
                }))
              }
              rows={2}
              placeholder="Target outcome"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <textarea
              value={notes[interventionPlanKey] ?? ""}
              onChange={(event) =>
                setNotes((current) => ({
                  ...current,
                  [interventionPlanKey]: event.target.value,
                }))
              }
              rows={2}
              placeholder="Response plan"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              type="date"
              value={dates[interventionStartKey] ?? ""}
              onChange={(event) =>
                setDates((current) => ({
                  ...current,
                  [interventionStartKey]: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              type="date"
              value={dates[interventionReviewKey] ?? ""}
              onChange={(event) =>
                setDates((current) => ({
                  ...current,
                  [interventionReviewKey]: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <textarea
              value={notes[interventionCriteriaKey] ?? ""}
              onChange={(event) =>
                setNotes((current) => ({
                  ...current,
                  [interventionCriteriaKey]: event.target.value,
                }))
              }
              rows={2}
              placeholder="Success criteria"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs md:col-span-2"
            />
          </div>
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "create_intervention",
                  caseId: supportCase.id,
                  tier: Number(selects[interventionTierKey] ?? 2),
                  targetOutcome: notes[interventionTargetKey] ?? "",
                  responsePlan: notes[interventionPlanKey] ?? "",
                  ownerAssignmentId: selects[interventionOwnerKey] ?? "",
                  startDate: dates[interventionStartKey] ?? "",
                  reviewDate: dates[interventionReviewKey] ?? "",
                  successCriteria: notes[interventionCriteriaKey] ?? "",
                },
                `intervention-${supportCase.id}`,
              )
            }
            className="mt-3 rounded-full bg-brand-700 px-3 py-2 text-xs font-black text-white"
          >
            Create intervention
          </button>
        </details>
      ) : null}

      {supportCase.interventions.length > 0 ? (
        <div className="mt-5 space-y-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Intervention evidence
          </p>
          {supportCase.interventions.map((intervention) => (
            <div
              key={intervention.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-black">{intervention.targetOutcome}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Tier {intervention.tier} · review{" "}
                    {formatDate(intervention.reviewDate)}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-black capitalize ${badgeClass(
                    intervention.status,
                  )}`}
                >
                  {readable(intervention.status)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {intervention.responsePlan}
              </p>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Success: {intervention.successCriteria}
              </p>

              {intervention.activities.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {intervention.activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="rounded-xl bg-white p-3 text-xs text-slate-600"
                    >
                      <p className="font-black text-slate-800">
                        {formatDate(activity.activityDate)}
                      </p>
                      <p className="mt-1 leading-5">{activity.activityNote}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {(intervention.isOwner || supportCase.canCoordinate) &&
              !["completed", "cancelled"].includes(intervention.status) ? (
                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <textarea
                    value={notes[`activity-${intervention.id}`] ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [`activity-${intervention.id}`]: event.target.value,
                      }))
                    }
                    rows={2}
                    placeholder="Meaningful activity evidence"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                  />
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={dates[`activity-${intervention.id}`] ?? ""}
                      onChange={(event) =>
                        setDates((current) => ({
                          ...current,
                          [`activity-${intervention.id}`]:
                            event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                    <input
                      value={references[`activity-${intervention.id}`] ?? ""}
                      onChange={(event) =>
                        setReferences((current) => ({
                          ...current,
                          [`activity-${intervention.id}`]:
                            event.target.value,
                        }))
                      }
                      placeholder="Evidence ref"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void submit(
                        {
                          mode: "add_activity",
                          interventionId: intervention.id,
                          activityDate:
                            dates[`activity-${intervention.id}`] ?? "",
                          activityNote:
                            notes[`activity-${intervention.id}`] ?? "",
                          evidenceReference:
                            references[`activity-${intervention.id}`] ?? null,
                        },
                        `activity-${intervention.id}`,
                      )
                    }
                    className="self-end rounded-full bg-slate-900 px-3 py-2 text-xs font-black text-white"
                  >
                    Add evidence
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {supportCase.canCoordinate &&
      !["closed", "redirected"].includes(supportCase.status) ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <details className="rounded-2xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-black">
              Parent partnership
            </summary>
            <div className="mt-3 space-y-2">
              <input
                type="date"
                value={dates[`parent-date-${supportCase.id}`] ?? ""}
                onChange={(event) =>
                  setDates((current) => ({
                    ...current,
                    [`parent-date-${supportCase.id}`]: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <select
                value={selects[`parent-channel-${supportCase.id}`] ?? "meeting"}
                onChange={(event) =>
                  setSelects((current) => ({
                    ...current,
                    [`parent-channel-${supportCase.id}`]:
                      event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              >
                <option value="meeting">Meeting</option>
                <option value="phone">Phone</option>
                <option value="message">Message</option>
                <option value="email">Email</option>
                <option value="letter">Letter</option>
                <option value="other">Other</option>
              </select>
              <textarea
                value={notes[parentSummaryKey] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({
                    ...current,
                    [parentSummaryKey]: event.target.value,
                  }))
                }
                rows={2}
                placeholder="Summary"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <textarea
                value={notes[parentActionKey] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({
                    ...current,
                    [parentActionKey]: event.target.value,
                  }))
                }
                rows={2}
                placeholder="Agreed action"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <input
                value={references[parentRefKey] ?? ""}
                onChange={(event) =>
                  setReferences((current) => ({
                    ...current,
                    [parentRefKey]: event.target.value,
                  }))
                }
                placeholder="Evidence/reference"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "record_parent_partnership",
                      caseId: supportCase.id,
                      contactDate:
                        dates[`parent-date-${supportCase.id}`] ?? "",
                      channel:
                        selects[`parent-channel-${supportCase.id}`] ??
                        "meeting",
                      summary: notes[parentSummaryKey] ?? "",
                      agreedAction: notes[parentActionKey] ?? null,
                      parentActionDueDate: null,
                      staffActionDueDate: null,
                      evidenceReference: references[parentRefKey] ?? null,
                    },
                    `parent-${supportCase.id}`,
                  )
                }
                className="rounded-full bg-slate-900 px-3 py-2 text-xs font-black text-white"
              >
                Record
              </button>
            </div>
          </details>

          <details className="rounded-2xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-black">
              Reassess
            </summary>
            <div className="mt-3 space-y-2">
              <select
                value={selects[reassessInterventionKey] ?? ""}
                onChange={(event) =>
                  setSelects((current) => ({
                    ...current,
                    [reassessInterventionKey]: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              >
                <option value="">No intervention link</option>
                {supportCase.interventions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.reference} · Tier {item.tier}
                  </option>
                ))}
              </select>
              <select
                value={selects[reassessOutcomeKey] ?? "improving"}
                onChange={(event) =>
                  setSelects((current) => ({
                    ...current,
                    [reassessOutcomeKey]: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              >
                <option value="recovered">Recovered</option>
                <option value="improving">Improving</option>
                <option value="no_improvement">No improvement</option>
                <option value="redirect">Redirect</option>
              </select>
              <textarea
                value={notes[reassessEvidenceKey] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({
                    ...current,
                    [reassessEvidenceKey]: event.target.value,
                  }))
                }
                rows={2}
                placeholder="Evidence note"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <input
                value={references[reassessRefKey] ?? ""}
                onChange={(event) =>
                  setReferences((current) => ({
                    ...current,
                    [reassessRefKey]: event.target.value,
                  }))
                }
                placeholder="Evidence reference"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <textarea
                value={notes[reassessNextKey] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({
                    ...current,
                    [reassessNextKey]: event.target.value,
                  }))
                }
                rows={2}
                placeholder="Next action if needed"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "reassess_case",
                      caseId: supportCase.id,
                      interventionId:
                        selects[reassessInterventionKey] || null,
                      outcome:
                        selects[reassessOutcomeKey] ?? "improving",
                      evidenceNote: notes[reassessEvidenceKey] ?? "",
                      evidenceReference: references[reassessRefKey] ?? "",
                      nextAction: notes[reassessNextKey] ?? null,
                    },
                    `reassess-${supportCase.id}`,
                  )
                }
                className="rounded-full bg-brand-700 px-3 py-2 text-xs font-black text-white"
              >
                Record reassessment
              </button>
            </div>
          </details>

          <details className="rounded-2xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-black">
              Escalate
            </summary>
            <div className="mt-3 space-y-2">
              <select
                value={selects[escalationSeverityKey] ?? "red"}
                onChange={(event) =>
                  setSelects((current) => ({
                    ...current,
                    [escalationSeverityKey]: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              >
                <option value="red">Red</option>
                <option value="critical">Critical</option>
              </select>
              <select
                value={selects[escalationOwnerKey] ?? ""}
                onChange={(event) =>
                  setSelects((current) => ({
                    ...current,
                    [escalationOwnerKey]: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              >
                <option value="">Choose higher owner</option>
                {caseOwners.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.roleTitle} · {item.id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <textarea
                value={notes[escalationNoteKey] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({
                    ...current,
                    [escalationNoteKey]: event.target.value,
                  }))
                }
                rows={2}
                placeholder="Why is current support insufficient?"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <input
                value={references[issueRefKey] ?? ""}
                onChange={(event) =>
                  setReferences((current) => ({
                    ...current,
                    [issueRefKey]: event.target.value,
                  }))
                }
                placeholder="Optional O4 issue UUID"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "escalate_case",
                      caseId: supportCase.id,
                      newSeverity:
                        selects[escalationSeverityKey] ?? "red",
                      newOwnerAssignmentId:
                        selects[escalationOwnerKey] ?? "",
                      escalationNote: notes[escalationNoteKey] ?? "",
                      linkedIssueId: references[issueRefKey] || null,
                    },
                    `escalate-${supportCase.id}`,
                  )
                }
                className="rounded-full bg-orange-700 px-3 py-2 text-xs font-black text-white"
              >
                Escalate case
              </button>
            </div>
          </details>
        </div>
      ) : null}

      {supportCase.reassessments.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Reassessment history
          </p>
          <div className="mt-3 space-y-2">
            {supportCase.reassessments.map((item) => (
              <div key={item.id} className="rounded-xl bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-black capitalize ${badgeClass(
                      item.outcome,
                    )}`}
                  >
                    {readable(item.outcome)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatDateTime(item.assessedAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {item.evidenceNote}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {supportCase.canCoordinate &&
      ["recovered", "redirected"].includes(supportCase.status) ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-black text-emerald-950">
            Closure gate is available
          </p>
          <p className="mt-1 text-xs leading-5 text-emerald-900">
            A case closes only because the latest reassessment evidenced recovery
            or governed redirection—not because activities were completed.
          </p>
          <textarea
            value={notes[closeKey] ?? ""}
            onChange={(event) =>
              setNotes((current) => ({
                ...current,
                [closeKey]: event.target.value,
              }))
            }
            rows={2}
            placeholder="Closure note"
            className="mt-3 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs"
          />
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "close_case",
                  caseId: supportCase.id,
                  closureNote: notes[closeKey] ?? "",
                },
                `close-${supportCase.id}`,
              )
            }
            className="mt-2 rounded-full bg-emerald-700 px-3 py-2 text-xs font-black text-white"
          >
            Close case
          </button>
        </div>
      ) : null}
    </article>
  );
}
