"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileCheck2,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsDevelopmentAction,
  KhposOpsDevelopmentActionType,
  KhposOpsPerformanceEvidence,
  KhposOpsPerformanceState,
  KhposOpsStaffPerformanceReview,
  KhposOpsStaffPerformanceWorkspace,
  KhposOpsStaffReviewType,
} from "@/lib/khpos/ops/staff-performance";

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function reviewStatusClasses(status: KhposOpsStaffPerformanceReview["status"]) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "leader_reviewed") return "border-mint-200 bg-mint-50 text-mint-900";
  if (status === "self_submitted") return "border-brand-200 bg-brand-50 text-brand-800";
  if (status === "open") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function performanceStateClasses(status: KhposOpsPerformanceState) {
  if (status === "on_track") return "bg-emerald-50 text-emerald-800";
  if (status === "support_required") return "bg-amber-50 text-amber-900";
  if (status === "improvement_required") return "bg-red-50 text-red-800";
  return "bg-slate-100 text-slate-600";
}

function actionStatusClasses(status: KhposOpsDevelopmentAction["status"]) {
  if (status === "verified") return "bg-emerald-50 text-emerald-800";
  if (status === "evidence_submitted") return "bg-brand-50 text-brand-800";
  if (status === "in_progress") return "bg-mint-50 text-mint-900";
  if (status === "open") return "bg-amber-50 text-amber-900";
  return "bg-slate-100 text-slate-700";
}

export function StaffPerformanceWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] =
    useState<KhposOpsStaffPerformanceWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [staffId, setStaffId] = useState("");
  const [reviewType, setReviewType] =
    useState<KhposOpsStaffReviewType>("term_review");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const [reflections, setReflections] = useState<Record<string, string>>({});
  const [selfStrengths, setSelfStrengths] = useState<Record<string, string>>(
    {},
  );
  const [supportNeeded, setSupportNeeded] = useState<Record<string, string>>(
    {},
  );

  const [evidenceType, setEvidenceType] = useState<
    Record<string, KhposOpsPerformanceEvidence["evidenceType"]>
  >({});
  const [evidenceTitle, setEvidenceTitle] = useState<Record<string, string>>(
    {},
  );
  const [evidenceNote, setEvidenceNote] = useState<Record<string, string>>({});
  const [evidenceReference, setEvidenceReference] = useState<
    Record<string, string>
  >({});
  const [evidenceKpiMeasurement, setEvidenceKpiMeasurement] = useState<
    Record<string, string>
  >({});

  const [leaderState, setLeaderState] = useState<
    Record<string, Exclude<KhposOpsPerformanceState, "not_assessed">>
  >({});
  const [leaderSummary, setLeaderSummary] = useState<Record<string, string>>(
    {},
  );
  const [leaderStrengths, setLeaderStrengths] = useState<
    Record<string, string>
  >({});
  const [growthAreas, setGrowthAreas] = useState<Record<string, string>>({});

  const [developmentType, setDevelopmentType] = useState<
    Record<string, KhposOpsDevelopmentActionType>
  >({});
  const [developmentTitle, setDevelopmentTitle] = useState<
    Record<string, string>
  >({});
  const [developmentDescription, setDevelopmentDescription] = useState<
    Record<string, string>
  >({});
  const [developmentDue, setDevelopmentDue] = useState<Record<string, string>>(
    {},
  );
  const [developmentNotes, setDevelopmentNotes] = useState<
    Record<string, string>
  >({});
  const [developmentEvidence, setDevelopmentEvidence] = useState<
    Record<string, string>
  >({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

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
        `/api/khpos/ops/staff-performance/${organisationId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        },
      );

      const body = (await response.json()) as {
        ok?: boolean;
        performance?: KhposOpsStaffPerformanceWorkspace;
        error?: string;
      };

      if (!active) return;

      if (!response.ok || !body.ok || !body.performance) {
        setError(body.error ?? "Staff performance workspace could not be loaded.");
        return;
      }

      const performance = body.performance;
      setWorkspace(performance);
      const reviewable = performance.staffOptions.find(
        (staff) => staff.canReview,
      );
      setStaffId((current) => current || reviewable?.id || "");
      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  const reviewableStaff = useMemo(
    () => workspace?.staffOptions.filter((staff) => staff.canReview) ?? [],
    [workspace],
  );

  async function submit(payload: Record<string, unknown>, busyKey: string) {
    const accessToken = await token();
    if (!accessToken) {
      setError("Your session has ended. Sign in again to continue.");
      return false;
    }

    setBusyId(busyKey);
    setError("");

    const response = await fetch(
      `/api/khpos/ops/staff-performance/${organisationId}`,
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
      performance?: KhposOpsStaffPerformanceWorkspace;
      error?: string;
    };

    setBusyId(null);

    if (!response.ok || !body.ok || !body.performance) {
      setError(
        body.error ?? "Staff performance operation could not be completed.",
      );
      return false;
    }

    setWorkspace(body.performance);
    return true;
  }

  async function createReview() {
    if (!staffId || !periodStart || !periodEnd) {
      setError("Choose staff and a complete review period.");
      return;
    }
    if (periodEnd < periodStart) {
      setError("Review period end cannot precede the start.");
      return;
    }

    const ok = await submit(
      {
        mode: "create_review",
        staffId,
        reviewType,
        periodStart,
        periodEnd,
      },
      "create-review",
    );

    if (ok) {
      setPeriodStart("");
      setPeriodEnd("");
      setShowCreate(false);
    }
  }

  async function submitReflection(review: KhposOpsStaffPerformanceReview) {
    const reflection = reflections[review.id]?.trim() ?? "";
    const strengths = selfStrengths[review.id]?.trim() ?? "";
    const support = supportNeeded[review.id]?.trim() ?? "";

    if (!reflection || !strengths) {
      setError("Reflection and strengths are required.");
      return;
    }

    const ok = await submit(
      {
        mode: "self_reflection",
        reviewId: review.id,
        reflection,
        strengths,
        supportNeeded: support || null,
      },
      `reflection-${review.id}`,
    );

    if (ok) {
      setReflections((current) => ({ ...current, [review.id]: "" }));
      setSelfStrengths((current) => ({ ...current, [review.id]: "" }));
      setSupportNeeded((current) => ({ ...current, [review.id]: "" }));
    }
  }

  async function addEvidence(review: KhposOpsStaffPerformanceReview) {
    const type = evidenceType[review.id] ?? "observation";
    const title = evidenceTitle[review.id]?.trim() ?? "";
    const note = evidenceNote[review.id]?.trim() ?? "";
    const reference = evidenceReference[review.id]?.trim() ?? "";
    const measurementId = evidenceKpiMeasurement[review.id] ?? "";

    if (!title || !note) {
      setError("Evidence title and note are required.");
      return;
    }
    if (type === "kpi" && !measurementId) {
      setError("Choose an exact governed KPI measurement for KPI evidence.");
      return;
    }

    const ok = await submit(
      {
        mode: "add_evidence",
        reviewId: review.id,
        evidenceType: type,
        title,
        note,
        reference: reference || null,
        kpiMeasurementId: type === "kpi" ? measurementId : null,
      },
      `evidence-${review.id}`,
    );

    if (ok) {
      setEvidenceTitle((current) => ({ ...current, [review.id]: "" }));
      setEvidenceNote((current) => ({ ...current, [review.id]: "" }));
      setEvidenceReference((current) => ({ ...current, [review.id]: "" }));
      setEvidenceKpiMeasurement((current) => ({
        ...current,
        [review.id]: "",
      }));
    }
  }

  async function submitLeaderReview(review: KhposOpsStaffPerformanceReview) {
    const state = leaderState[review.id] ?? "on_track";
    const summary = leaderSummary[review.id]?.trim() ?? "";
    const strengths = leaderStrengths[review.id]?.trim() ?? "";
    const growth = growthAreas[review.id]?.trim() ?? "";

    if (!summary || !strengths || !growth) {
      setError("Leader summary, strengths and growth areas are required.");
      return;
    }

    const ok = await submit(
      {
        mode: "leader_review",
        reviewId: review.id,
        performanceState: state,
        summary,
        strengths,
        growthAreas: growth,
      },
      `leader-review-${review.id}`,
    );

    if (ok) {
      setLeaderSummary((current) => ({ ...current, [review.id]: "" }));
      setLeaderStrengths((current) => ({ ...current, [review.id]: "" }));
      setGrowthAreas((current) => ({ ...current, [review.id]: "" }));
    }
  }

  async function createDevelopment(review: KhposOpsStaffPerformanceReview) {
    const staff = workspace?.staffOptions.find(
      (option) => option.id === review.staffId,
    );
    const ownerUserId = staff?.userId ?? "";
    const type = developmentType[review.id] ?? "coaching";
    const title = developmentTitle[review.id]?.trim() ?? "";
    const description = developmentDescription[review.id]?.trim() ?? "";
    const dueDate = developmentDue[review.id] ?? "";

    if (!ownerUserId) {
      setError("The reviewed staff account is not linked.");
      return;
    }
    if (!title || !description || !dueDate) {
      setError("Development title, description and due date are required.");
      return;
    }

    const ok = await submit(
      {
        mode: "create_development",
        reviewId: review.id,
        actionType: type,
        title,
        description,
        ownerUserId,
        dueDate,
      },
      `create-development-${review.id}`,
    );

    if (ok) {
      setDevelopmentTitle((current) => ({ ...current, [review.id]: "" }));
      setDevelopmentDescription((current) => ({
        ...current,
        [review.id]: "",
      }));
      setDevelopmentDue((current) => ({ ...current, [review.id]: "" }));
    }
  }

  async function developmentAction(
    action: KhposOpsDevelopmentAction,
    operation: "start" | "submit_evidence" | "verify" | "reopen" | "cancel",
  ) {
    const note = developmentNotes[action.id]?.trim() ?? "";
    const evidence = developmentEvidence[action.id]?.trim() ?? "";

    if (operation === "submit_evidence" && (!note || !evidence)) {
      setError("Completion note and evidence reference are required.");
      return;
    }
    if (
      (operation === "reopen" || operation === "cancel") &&
      !note
    ) {
      setError("Add the required reason before taking this action.");
      return;
    }

    const ok = await submit(
      {
        mode: "development_action",
        actionId: action.id,
        action: operation,
        note: note || null,
        evidenceReference: evidence || null,
      },
      `${operation}-${action.id}`,
    );

    if (ok) {
      setDevelopmentNotes((current) => ({ ...current, [action.id]: "" }));
      setDevelopmentEvidence((current) => ({ ...current, [action.id]: "" }));
    }
  }

  async function reviewAction(
    review: KhposOpsStaffPerformanceReview,
    action: "complete" | "cancel",
  ) {
    const note = reviewNotes[review.id]?.trim() ?? "";
    if (action === "cancel" && !note) {
      setError("Explain why this review is being cancelled.");
      return;
    }

    const ok = await submit(
      {
        mode: "review_action",
        reviewId: review.id,
        action,
        note: note || null,
      },
      `${action}-${review.id}`,
    );

    if (ok) {
      setReviewNotes((current) => ({ ...current, [review.id]: "" }));
    }
  }

  if (!workspace && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-mint-300" />
          <p className="mt-4 text-sm font-semibold text-slate-300">
            Loading staff performance…
          </p>
        </div>
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <CircleAlert className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">
            Staff performance is unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <Link
            href={`/khpos/${organisationId}`}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950"
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
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex items-center justify-between gap-4">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-bold text-mint-200">
              Operations · O9
            </span>
            <Link
              href={`/khpos/${organisationId}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black"
            >
              <ArrowLeft className="size-4" />
              Command Centre
            </Link>
          </div>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                Staff Performance & Development
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
                Reflect → Evidence → Leader Review → Development → Verification.
                O9 does not produce a one-number staff rating and does not turn
                one absence, complaint, issue or exam result into a verdict.
              </p>
            </div>

            {reviewableStaff.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCreate((value) => !value)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-mint-300 px-5 py-3 text-sm font-black text-slate-950"
              >
                <Plus className="size-4" />
                Open review
              </button>
            )}
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Open reviews", workspace.summary.openReviews],
              ["My reflections due", workspace.summary.selfReflectionsDue],
              ["Leader reviews due", workspace.summary.leaderReviewsDue],
              [
                "Development overdue",
                workspace.summary.overdueDevelopmentActions,
              ],
              ["Improvement required", workspace.summary.improvementRequired],
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

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 sm:py-10">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-[28px] border border-brand-200 bg-brand-50 p-5 text-brand-950">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-700" />
            <div>
              <p className="text-sm font-black">Performance principle</p>
              <p className="mt-1 text-sm leading-6 text-brand-900/80">
                {workspace.principle}
              </p>
            </div>
          </div>
        </section>

        {workspace.staffOptions.length === 0 ? (
          <section className="rounded-[30px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <UsersRound className="mx-auto size-10 text-brand-700" />
            <h2 className="mt-4 text-2xl font-black">
              No active deployed staff are available for review yet.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              O9 begins after O7 has certified real staff into active operating
              roles. It will not create reviews for placeholder seats or
              inferred staff.
            </p>
            <Link
              href={`/khpos/${organisationId}/people`}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white"
            >
              <UserRoundCheck className="size-4" />
              Open People & Staff
            </Link>
          </section>
        ) : (
          <>
            {showCreate && reviewableStaff.length > 0 && (
              <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                  Evidence-based review
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Open staff performance review
                </h2>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  <label className="text-sm font-bold">
                    Staff
                    <select
                      value={staffId}
                      onChange={(event) => setStaffId(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                    >
                      {reviewableStaff.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.displayName} · {staff.roleTitle}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-bold">
                    Review type
                    <select
                      value={reviewType}
                      onChange={(event) =>
                        setReviewType(
                          event.target.value as KhposOpsStaffReviewType,
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal capitalize outline-none focus:border-brand-400"
                    >
                      {[
                        "probation",
                        "monthly_check_in",
                        "term_review",
                        "annual_review",
                        "support_review",
                      ].map((value) => (
                        <option key={value} value={value}>
                          {readable(value)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-bold">
                    Period start
                    <input
                      type="date"
                      value={periodStart}
                      onChange={(event) => setPeriodStart(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                    />
                  </label>

                  <label className="text-sm font-bold">
                    Period end
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={(event) => setPeriodEnd(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                    />
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === "create-review"}
                    onClick={() => void createReview()}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
                  >
                    {busyId === "create-review" && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    Open review
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-black text-slate-700"
                  >
                    Close form
                  </button>
                </div>
              </section>
            )}

            {workspace.reviews.length === 0 ? (
              <section className="rounded-[30px] border border-slate-200 bg-white p-8 text-center shadow-sm">
                <BookOpenCheck className="mx-auto size-10 text-brand-700" />
                <h2 className="mt-4 text-2xl font-black">
                  No staff performance reviews yet.
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Normal work, issues and scorecards remain in their own
                  operational engines. O9 begins when a structured performance
                  conversation is actually due.
                </p>
              </section>
            ) : (
              <section className="space-y-5">
                {workspace.reviews.map((review) => {
                  const staff = workspace.staffOptions.find(
                    (option) => option.id === review.staffId,
                  );
                  const roleKpis = staff?.roleKpis ?? [];
                  const governedMeasurements = roleKpis.filter(
                    (kpi) => kpi.latestMeasurement,
                  );
                  const selectedEvidenceType =
                    evidenceType[review.id] ?? "observation";

                  return (
                    <article
                      key={review.id}
                      className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7"
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-white">
                              {review.reference}
                            </span>
                            <span
                              className={`rounded-full border px-3 py-1 text-[11px] font-black capitalize ${reviewStatusClasses(
                                review.status,
                              )}`}
                            >
                              {readable(review.status)}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-[11px] font-black capitalize ${performanceStateClasses(
                                review.performanceState,
                              )}`}
                            >
                              {readable(review.performanceState)}
                            </span>
                          </div>

                          <h2 className="mt-3 text-2xl font-black">
                            {review.staffName}
                          </h2>
                          <p className="mt-1 text-sm font-bold text-brand-700">
                            {review.roleTitle}
                            {review.campusName
                              ? ` · ${review.campusName}`
                              : ""}
                            {review.unitName ? ` · ${review.unitName}` : ""}
                          </p>
                          <p className="mt-3 text-sm text-slate-600">
                            {readable(review.reviewType)} ·{" "}
                            {formatDate(review.periodStart)} →{" "}
                            {formatDate(review.periodEnd)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4 lg:min-w-64">
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                            Evidence state
                          </p>
                          <p className="mt-2 text-sm font-black">
                            {review.evidence.length} review evidence item
                            {review.evidence.length === 1 ? "" : "s"}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {governedMeasurements.length} governed O6 role KPI
                            measurement
                            {governedMeasurements.length === 1 ? "" : "s"}{" "}
                            currently available
                          </p>
                        </div>
                      </div>

                      {(review.selfReflection ||
                        review.selfStrengths ||
                        review.selfSupportNeeded) && (
                        <section className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-700">
                            Staff reflection
                          </p>
                          {review.selfReflection && (
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                              {review.selfReflection}
                            </p>
                          )}
                          {review.selfStrengths && (
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                              <strong>Strengths:</strong>{" "}
                              {review.selfStrengths}
                            </p>
                          )}
                          {review.selfSupportNeeded && (
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                              <strong>Support requested:</strong>{" "}
                              {review.selfSupportNeeded}
                            </p>
                          )}
                        </section>
                      )}

                      {review.isSelf &&
                        ["open", "self_submitted"].includes(review.status) && (
                          <details
                            className="mt-5 rounded-2xl border border-slate-200"
                            open={review.status === "open"}
                          >
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-black">
                              <span>My reflection</span>
                              <ChevronDown className="size-4 text-slate-500" />
                            </summary>
                            <div className="grid gap-3 border-t border-slate-100 p-4">
                              <textarea
                                value={reflections[review.id] ?? ""}
                                onChange={(event) =>
                                  setReflections((current) => ({
                                    ...current,
                                    [review.id]: event.target.value,
                                  }))
                                }
                                className="min-h-28 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                                placeholder="What happened during this review period? What outcomes did you own, and what did you learn?"
                              />
                              <textarea
                                value={selfStrengths[review.id] ?? ""}
                                onChange={(event) =>
                                  setSelfStrengths((current) => ({
                                    ...current,
                                    [review.id]: event.target.value,
                                  }))
                                }
                                className="min-h-20 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                                placeholder="What are your strongest contributions in this period?"
                              />
                              <textarea
                                value={supportNeeded[review.id] ?? ""}
                                onChange={(event) =>
                                  setSupportNeeded((current) => ({
                                    ...current,
                                    [review.id]: event.target.value,
                                  }))
                                }
                                className="min-h-20 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                                placeholder="What support, coaching, resource or clarity would help you improve?"
                              />
                              <button
                                type="button"
                                disabled={
                                  busyId === `reflection-${review.id}`
                                }
                                onClick={() => void submitReflection(review)}
                                className="w-fit rounded-full bg-brand-800 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                              >
                                Submit reflection
                              </button>
                            </div>
                          </details>
                        )}

                      {review.status !== "completed" &&
                        review.status !== "cancelled" &&
                        (review.isSelf || review.canReview) && (
                          <details className="mt-5 rounded-2xl border border-slate-200">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-black">
                              <span>Add review evidence</span>
                              <ChevronDown className="size-4 text-slate-500" />
                            </summary>
                            <div className="border-t border-slate-100 p-4">
                              <div className="grid gap-3 lg:grid-cols-2">
                                <select
                                  value={selectedEvidenceType}
                                  onChange={(event) =>
                                    setEvidenceType((current) => ({
                                      ...current,
                                      [review.id]: event.target
                                        .value as KhposOpsPerformanceEvidence["evidenceType"],
                                    }))
                                  }
                                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                                >
                                  {[
                                    "role_outcome",
                                    "observation",
                                    "kpi",
                                    "work_execution",
                                    "issue_pattern",
                                    "feedback",
                                    "development",
                                    "other",
                                  ].map((value) => (
                                    <option key={value} value={value}>
                                      {readable(value)}
                                    </option>
                                  ))}
                                </select>

                                <input
                                  value={evidenceTitle[review.id] ?? ""}
                                  onChange={(event) =>
                                    setEvidenceTitle((current) => ({
                                      ...current,
                                      [review.id]: event.target.value,
                                    }))
                                  }
                                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                                  placeholder="Evidence title"
                                />

                                {selectedEvidenceType === "kpi" ? (
                                  <select
                                    value={
                                      evidenceKpiMeasurement[review.id] ?? ""
                                    }
                                    onChange={(event) =>
                                      setEvidenceKpiMeasurement((current) => ({
                                        ...current,
                                        [review.id]: event.target.value,
                                      }))
                                    }
                                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400 lg:col-span-2"
                                  >
                                    <option value="">
                                      {governedMeasurements.length
                                        ? "Choose exact governed O6 measurement"
                                        : "No governed role KPI measurement exists yet"}
                                    </option>
                                    {governedMeasurements.map((kpi) => (
                                      <option
                                        key={kpi.latestMeasurement!.id}
                                        value={kpi.latestMeasurement!.id}
                                      >
                                        {kpi.code} · {kpi.name} ·{" "}
                                        {formatDate(
                                          kpi.latestMeasurement!.periodEnd,
                                        )} ·{" "}
                                        {readable(
                                          kpi.latestMeasurement!
                                            .performanceStatus,
                                        )}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    value={
                                      evidenceReference[review.id] ?? ""
                                    }
                                    onChange={(event) =>
                                      setEvidenceReference((current) => ({
                                        ...current,
                                        [review.id]: event.target.value,
                                      }))
                                    }
                                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400 lg:col-span-2"
                                    placeholder="Evidence reference / link / record ID (optional)"
                                  />
                                )}

                                <textarea
                                  value={evidenceNote[review.id] ?? ""}
                                  onChange={(event) =>
                                    setEvidenceNote((current) => ({
                                      ...current,
                                      [review.id]: event.target.value,
                                    }))
                                  }
                                  className="min-h-24 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400 lg:col-span-2"
                                  placeholder="What does this evidence actually show? Avoid personality labels and unsupported conclusions."
                                />
                              </div>

                              <button
                                type="button"
                                disabled={
                                  busyId === `evidence-${review.id}`
                                }
                                onClick={() => void addEvidence(review)}
                                className="mt-3 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                              >
                                Add evidence
                              </button>
                            </div>
                          </details>
                        )}

                      <details
                        className="mt-5 rounded-2xl border border-slate-200"
                        open={review.evidence.length > 0}
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-black">
                          <span>
                            Evidence register · {review.evidence.length}
                          </span>
                          <ChevronDown className="size-4 text-slate-500" />
                        </summary>
                        <div className="space-y-3 border-t border-slate-100 p-4">
                          {review.evidence.length === 0 ? (
                            <p className="text-sm text-slate-500">
                              No evidence has been recorded yet. Leader judgment
                              remains blocked until evidence exists.
                            </p>
                          ) : (
                            review.evidence.map((evidence) => (
                              <div
                                key={evidence.id}
                                className="rounded-2xl bg-slate-50 p-4"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black capitalize text-slate-600">
                                    {readable(evidence.evidenceType)}
                                  </span>
                                  {evidence.kpiMeasurement && (
                                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-black text-brand-800">
                                      Exact O6 measurement
                                    </span>
                                  )}
                                </div>
                                <p className="mt-2 text-sm font-black">
                                  {evidence.title}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-slate-600">
                                  {evidence.note}
                                </p>
                                {evidence.kpiMeasurement && (
                                  <div className="mt-3 rounded-xl border border-brand-100 bg-white p-3 text-xs text-slate-600">
                                    <strong>
                                      {evidence.kpiMeasurement.kpiCode} ·{" "}
                                      {evidence.kpiMeasurement.kpiName}
                                    </strong>
                                    <p className="mt-1">
                                      {formatDate(
                                        evidence.kpiMeasurement.periodStart,
                                      )}{" "}
                                      →{" "}
                                      {formatDate(
                                        evidence.kpiMeasurement.periodEnd,
                                      )}{" "}
                                      · value {evidence.kpiMeasurement.value} ·{" "}
                                      {readable(
                                        evidence.kpiMeasurement
                                          .performanceStatus,
                                      )}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </details>

                      {review.canReview &&
                        review.status === "self_submitted" && (
                          <section className="mt-5 rounded-2xl border border-mint-200 bg-mint-50/60 p-4">
                            <p className="text-sm font-black text-mint-950">
                              Leader review
                            </p>
                            <p className="mt-1 text-xs leading-5 text-mint-900/80">
                              Use the evidence and dialogue. The state is
                              qualitative—not a score.
                            </p>

                            <div className="mt-3 grid gap-3 lg:grid-cols-2">
                              <select
                                value={leaderState[review.id] ?? "on_track"}
                                onChange={(event) =>
                                  setLeaderState((current) => ({
                                    ...current,
                                    [review.id]: event.target
                                      .value as Exclude<
                                      KhposOpsPerformanceState,
                                      "not_assessed"
                                    >,
                                  }))
                                }
                                className="rounded-xl border border-mint-200 bg-white px-3 py-2.5 text-sm outline-none"
                              >
                                <option value="on_track">On Track</option>
                                <option value="support_required">
                                  Support Required
                                </option>
                                <option value="improvement_required">
                                  Improvement Required
                                </option>
                              </select>

                              <div className="rounded-xl border border-mint-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600">
                                Evidence items available:{" "}
                                <strong>{review.evidence.length}</strong>
                              </div>

                              <textarea
                                value={leaderSummary[review.id] ?? ""}
                                onChange={(event) =>
                                  setLeaderSummary((current) => ({
                                    ...current,
                                    [review.id]: event.target.value,
                                  }))
                                }
                                className="min-h-24 rounded-xl border border-mint-200 bg-white px-3 py-2.5 text-sm outline-none lg:col-span-2"
                                placeholder="Leader summary grounded in the evidence and conversation"
                              />
                              <textarea
                                value={leaderStrengths[review.id] ?? ""}
                                onChange={(event) =>
                                  setLeaderStrengths((current) => ({
                                    ...current,
                                    [review.id]: event.target.value,
                                  }))
                                }
                                className="min-h-20 rounded-xl border border-mint-200 bg-white px-3 py-2.5 text-sm outline-none"
                                placeholder="Observed strengths"
                              />
                              <textarea
                                value={growthAreas[review.id] ?? ""}
                                onChange={(event) =>
                                  setGrowthAreas((current) => ({
                                    ...current,
                                    [review.id]: event.target.value,
                                  }))
                                }
                                className="min-h-20 rounded-xl border border-mint-200 bg-white px-3 py-2.5 text-sm outline-none"
                                placeholder="Growth areas / expected change"
                              />
                            </div>

                            <button
                              type="button"
                              disabled={
                                busyId === `leader-review-${review.id}`
                              }
                              onClick={() => void submitLeaderReview(review)}
                              className="mt-3 rounded-full bg-mint-800 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                            >
                              Record leader review
                            </button>
                          </section>
                        )}

                      {review.leaderSummary && (
                        <section className="mt-5 rounded-2xl border border-slate-200 p-4">
                          <div className="flex items-center gap-2">
                            <BadgeCheck className="size-4 text-brand-700" />
                            <p className="text-sm font-black">Leader outcome</p>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-700">
                            {review.leaderSummary}
                          </p>
                          {review.strengths && (
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                              <strong>Strengths:</strong> {review.strengths}
                            </p>
                          )}
                          {review.growthAreas && (
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                              <strong>Growth areas:</strong>{" "}
                              {review.growthAreas}
                            </p>
                          )}
                        </section>
                      )}

                      {review.status !== "cancelled" &&
                        (review.isSelf || review.canReview) && (
                          <details className="mt-5 rounded-2xl border border-slate-200">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-black">
                              <span>
                                Development commitments ·{" "}
                                {review.developmentActions.length}
                              </span>
                              <ChevronDown className="size-4 text-slate-500" />
                            </summary>
                            <div className="space-y-4 border-t border-slate-100 p-4">
                              {review.status !== "completed" && (
                                <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
                                  <p className="text-sm font-black text-violet-950">
                                    Add development commitment
                                  </p>
                                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                    <select
                                      value={
                                        developmentType[review.id] ??
                                        "coaching"
                                      }
                                      onChange={(event) =>
                                        setDevelopmentType((current) => ({
                                          ...current,
                                          [review.id]: event.target
                                            .value as KhposOpsDevelopmentActionType,
                                        }))
                                      }
                                      className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm outline-none"
                                    >
                                      {[
                                        "coaching",
                                        "training",
                                        "practice",
                                        "observation",
                                        "process_support",
                                        "resource_support",
                                        "other",
                                      ].map((value) => (
                                        <option key={value} value={value}>
                                          {readable(value)}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      type="date"
                                      value={developmentDue[review.id] ?? ""}
                                      onChange={(event) =>
                                        setDevelopmentDue((current) => ({
                                          ...current,
                                          [review.id]: event.target.value,
                                        }))
                                      }
                                      className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm outline-none"
                                    />
                                    <input
                                      value={developmentTitle[review.id] ?? ""}
                                      onChange={(event) =>
                                        setDevelopmentTitle((current) => ({
                                          ...current,
                                          [review.id]: event.target.value,
                                        }))
                                      }
                                      className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm outline-none lg:col-span-2"
                                      placeholder="Specific development commitment"
                                    />
                                    <textarea
                                      value={
                                        developmentDescription[review.id] ?? ""
                                      }
                                      onChange={(event) =>
                                        setDevelopmentDescription(
                                          (current) => ({
                                            ...current,
                                            [review.id]: event.target.value,
                                          }),
                                        )
                                      }
                                      className="min-h-20 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm outline-none lg:col-span-2"
                                      placeholder="What support/practice happens, and what evidence will show improvement?"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    disabled={
                                      busyId ===
                                      `create-development-${review.id}`
                                    }
                                    onClick={() =>
                                      void createDevelopment(review)
                                    }
                                    className="mt-3 rounded-full bg-violet-800 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                                  >
                                    Add commitment
                                  </button>
                                </div>
                              )}

                              {review.developmentActions.length === 0 ? (
                                <p className="text-sm text-slate-500">
                                  No development commitment has been recorded.
                                  An On Track review may legitimately require no
                                  formal development action.
                                </p>
                              ) : (
                                review.developmentActions.map((action) => (
                                  <div
                                    key={action.id}
                                    className="rounded-2xl border border-slate-200 p-4"
                                  >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black capitalize text-slate-600">
                                            {readable(action.actionType)}
                                          </span>
                                          <span
                                            className={`rounded-full px-2.5 py-1 text-[10px] font-black capitalize ${actionStatusClasses(
                                              action.status,
                                            )}`}
                                          >
                                            {readable(action.status)}
                                          </span>
                                        </div>
                                        <p className="mt-2 text-sm font-black">
                                          {action.title}
                                        </p>
                                        <p className="mt-1 text-sm leading-6 text-slate-600">
                                          {action.description}
                                        </p>
                                        <p className="mt-2 text-xs font-semibold text-slate-500">
                                          Owner: {action.ownerName} · Due{" "}
                                          {formatDate(action.dueDate)}
                                        </p>
                                      </div>
                                    </div>

                                    {(action.completionNote ||
                                      action.evidenceReference) && (
                                      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                                        {action.completionNote && (
                                          <p>
                                            <strong>Completion:</strong>{" "}
                                            {action.completionNote}
                                          </p>
                                        )}
                                        {action.evidenceReference && (
                                          <p>
                                            <strong>Evidence:</strong>{" "}
                                            {action.evidenceReference}
                                          </p>
                                        )}
                                      </div>
                                    )}

                                    {((action.isOwner &&
                                      ["open", "in_progress"].includes(
                                        action.status,
                                      )) ||
                                      (action.canVerify &&
                                        [
                                          "evidence_submitted",
                                          "verified",
                                          "open",
                                          "in_progress",
                                        ].includes(action.status))) && (
                                      <div className="mt-3 grid gap-2 lg:grid-cols-2">
                                        <input
                                          value={
                                            developmentNotes[action.id] ?? ""
                                          }
                                          onChange={(event) =>
                                            setDevelopmentNotes((current) => ({
                                              ...current,
                                              [action.id]: event.target.value,
                                            }))
                                          }
                                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-400"
                                          placeholder="Completion / verification / reopen reason"
                                        />
                                        <input
                                          value={
                                            developmentEvidence[action.id] ?? ""
                                          }
                                          onChange={(event) =>
                                            setDevelopmentEvidence(
                                              (current) => ({
                                                ...current,
                                                [action.id]:
                                                  event.target.value,
                                              }),
                                            )
                                          }
                                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-400"
                                          placeholder="Evidence reference"
                                        />
                                      </div>
                                    )}

                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {action.isOwner &&
                                        action.status === "open" && (
                                          <button
                                            type="button"
                                            disabled={
                                              busyId === `start-${action.id}`
                                            }
                                            onClick={() =>
                                              void developmentAction(
                                                action,
                                                "start",
                                              )
                                            }
                                            className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[11px] font-black text-brand-800 disabled:opacity-50"
                                          >
                                            Start
                                          </button>
                                        )}

                                      {action.isOwner &&
                                        ["open", "in_progress"].includes(
                                          action.status,
                                        ) && (
                                          <button
                                            type="button"
                                            disabled={
                                              busyId ===
                                              `submit_evidence-${action.id}`
                                            }
                                            onClick={() =>
                                              void developmentAction(
                                                action,
                                                "submit_evidence",
                                              )
                                            }
                                            className="rounded-full bg-brand-800 px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-50"
                                          >
                                            Submit evidence
                                          </button>
                                        )}

                                      {action.canVerify &&
                                        action.status ===
                                          "evidence_submitted" && (
                                          <button
                                            type="button"
                                            disabled={
                                              busyId ===
                                              `verify-${action.id}`
                                            }
                                            onClick={() =>
                                              void developmentAction(
                                                action,
                                                "verify",
                                              )
                                            }
                                            className="rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-50"
                                          >
                                            Verify improvement
                                          </button>
                                        )}

                                      {action.canVerify &&
                                        ["evidence_submitted", "verified"].includes(
                                          action.status,
                                        ) && (
                                          <button
                                            type="button"
                                            disabled={
                                              busyId ===
                                              `reopen-${action.id}`
                                            }
                                            onClick={() =>
                                              void developmentAction(
                                                action,
                                                "reopen",
                                              )
                                            }
                                            className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-900 disabled:opacity-50"
                                          >
                                            Reopen
                                          </button>
                                        )}

                                      {action.canVerify &&
                                        !["verified", "cancelled"].includes(
                                          action.status,
                                        ) && (
                                          <button
                                            type="button"
                                            disabled={
                                              busyId ===
                                              `cancel-${action.id}`
                                            }
                                            onClick={() =>
                                              void developmentAction(
                                                action,
                                                "cancel",
                                              )
                                            }
                                            className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-black text-slate-700 disabled:opacity-50"
                                          >
                                            Cancel
                                          </button>
                                        )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </details>
                        )}

                      {review.canReview &&
                        ["leader_reviewed", "open", "self_submitted"].includes(
                          review.status,
                        ) && (
                          <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                            <textarea
                              value={reviewNotes[review.id] ?? ""}
                              onChange={(event) =>
                                setReviewNotes((current) => ({
                                  ...current,
                                  [review.id]: event.target.value,
                                }))
                              }
                              className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                              placeholder="Closure/cancellation note when needed"
                            />
                            <div className="mt-3 flex flex-wrap gap-2">
                              {review.status === "leader_reviewed" && (
                                <button
                                  type="button"
                                  disabled={
                                    busyId === `complete-${review.id}`
                                  }
                                  onClick={() =>
                                    void reviewAction(review, "complete")
                                  }
                                  className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                                >
                                  Complete review
                                </button>
                              )}
                              {review.status !== "completed" && (
                                <button
                                  type="button"
                                  disabled={
                                    busyId === `cancel-${review.id}`
                                  }
                                  onClick={() =>
                                    void reviewAction(review, "cancel")
                                  }
                                  className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-xs font-black text-red-800 disabled:opacity-50"
                                >
                                  Cancel review
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                      {review.history.length > 0 && (
                        <details className="mt-4 border-t border-slate-100 pt-4">
                          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black text-slate-700">
                            <Clock3 className="size-4" />
                            Review history
                            <ChevronDown className="size-4" />
                          </summary>
                          <div className="mt-4 space-y-3">
                            {review.history.map((event, index) => (
                              <div
                                key={`${event.createdAt}-${index}`}
                                className="rounded-2xl bg-slate-50 p-4"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs font-black capitalize text-slate-800">
                                    {readable(event.eventType)}
                                  </p>
                                  <p className="text-[11px] font-semibold text-slate-500">
                                    {formatDateTime(event.createdAt)}
                                  </p>
                                </div>
                                {event.note && (
                                  <p className="mt-2 text-sm leading-6 text-slate-600">
                                    {event.note}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white sm:p-7">
            <Sparkles className="size-6 text-mint-300" />
            <h2 className="mt-3 text-xl font-black">
              Capability gap ≠ conduct problem
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              If someone does not yet know how, O9 should train, coach,
              practise and re-observe. Repeated refusal or serious misconduct
              belongs in the later corrective/disciplinary process with due
              process—not disguised as coaching.
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <FileCheck2 className="size-6 text-brand-700" />
            <h2 className="mt-3 text-xl font-black">
              No KPI is better than a fake KPI
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              O6 role KPIs appear here only when they have been formally
              governed and measured. If none exist yet, reviews proceed using
              other specific evidence rather than inventing a score to fill the
              screen.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
