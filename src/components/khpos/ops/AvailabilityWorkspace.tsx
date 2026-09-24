"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Loader2,
  ShieldCheck,
  UserCheck,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsAvailabilityCase,
  KhposOpsAvailabilityCaseType,
  KhposOpsAvailabilitySource,
  KhposOpsAvailabilityWorkspace,
  KhposOpsCoverageAssignment,
} from "@/lib/khpos/ops/availability";

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function formatDateTime(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function localInputValue(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIso(value: string) {
  return new Date(value).toISOString();
}

function caseStatusClasses(status: KhposOpsAvailabilityCase["status"]) {
  if (status === "closed") return "border-slate-200 bg-slate-100 text-slate-700";
  if (status === "returned") return "border-mint-200 bg-mint-50 text-mint-900";
  if (status === "approved" || status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (status === "pending_approval") {
    return "border-brand-200 bg-brand-50 text-brand-800";
  }
  if (status === "coverage_required") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-red-200 bg-red-50 text-red-800";
}

function coverageStatusClasses(status: KhposOpsCoverageAssignment["status"]) {
  if (status === "completed") return "bg-emerald-50 text-emerald-800";
  if (status === "accepted") return "bg-mint-50 text-mint-900";
  if (status === "assigned") return "bg-brand-50 text-brand-800";
  if (status === "declined") return "bg-red-50 text-red-800";
  return "bg-slate-100 text-slate-700";
}

export function AvailabilityWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] =
    useState<KhposOpsAvailabilityWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [staffId, setStaffId] = useState("");
  const [caseType, setCaseType] =
    useState<KhposOpsAvailabilityCaseType>("planned_leave");
  const [sourceType, setSourceType] =
    useState<KhposOpsAvailabilitySource>("self_report");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [reasonCategory, setReasonCategory] = useState("not_disclosed");
  const [reasonNote, setReasonNote] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [coverageRequired, setCoverageRequired] = useState(false);

  const [caseNotes, setCaseNotes] = useState<Record<string, string>>({});
  const [decisionCoverage, setDecisionCoverage] = useState<
    Record<string, boolean>
  >({});
  const [coverCandidate, setCoverCandidate] = useState<Record<string, string>>(
    {},
  );
  const [coverScope, setCoverScope] = useState<Record<string, string>>({});
  const [coverStart, setCoverStart] = useState<Record<string, string>>({});
  const [coverEnd, setCoverEnd] = useState<Record<string, string>>({});
  const [coverageNotes, setCoverageNotes] = useState<Record<string, string>>(
    {},
  );

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
        `/api/khpos/ops/availability/${organisationId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        availability?: KhposOpsAvailabilityWorkspace;
        error?: string;
      };

      if (!active) return;

      if (!response.ok || !body.ok || !body.availability) {
        setError(body.error ?? "Availability workspace could not be loaded.");
        return;
      }

      const next = body.availability;
      setWorkspace(next);
      const self =
        next.staffOptions.find((staff) => staff.isSelf) ??
        next.staffOptions[0];
      if (self) {
        setStaffId((current) => current || self.id);
        setSourceType(self.isSelf ? "self_report" : "leader_record");
      }
      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  const selectedStaff = workspace?.staffOptions.find(
    (staff) => staff.id === staffId,
  );

  const coverageOptionsFor = (availabilityCase: KhposOpsAvailabilityCase) =>
    (workspace?.coverageCandidates ?? []).filter(
      (candidate) => candidate.staffId !== availabilityCase.staffId,
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
      `/api/khpos/ops/availability/${organisationId}`,
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
      availability?: KhposOpsAvailabilityWorkspace;
      error?: string;
    };

    setBusyId(null);

    if (!response.ok || !body.ok || !body.availability) {
      setError(body.error ?? "Availability operation could not be completed.");
      return false;
    }

    setWorkspace(body.availability);
    return true;
  }

  async function createCase() {
    if (!staffId || !startAt || !endAt) {
      setError("Staff and the availability period are required.");
      return;
    }

    if (new Date(endAt) <= new Date(startAt)) {
      setError("End time must be after the start time.");
      return;
    }

    const actualSource = selectedStaff?.isSelf ? "self_report" : sourceType;

    const ok = await submit(
      {
        mode: "create_case",
        staffId,
        caseType,
        sourceType: actualSource,
        startAt: toIso(startAt),
        endAt: toIso(endAt),
        reasonCategory,
        reasonNote: reasonNote.trim() || null,
        sourceReference:
          actualSource === "third_party_exception"
            ? sourceReference.trim() || null
            : null,
        coverageRequired,
      },
      "create",
    );

    if (ok) {
      setCaseType("planned_leave");
      setStartAt("");
      setEndAt("");
      setReasonCategory("not_disclosed");
      setReasonNote("");
      setSourceReference("");
      setCoverageRequired(false);
      setShowCreate(false);
    }
  }

  async function caseAction(
    availabilityCase: KhposOpsAvailabilityCase,
    action:
      | "approve"
      | "decline"
      | "cancel"
      | "require_coverage"
      | "confirm_coverage"
      | "return"
      | "close",
  ) {
    const note = caseNotes[availabilityCase.id]?.trim() || "";
    if (action === "decline" && !note) {
      setError("Add a reason before declining planned leave.");
      return;
    }

    const ok = await submit(
      {
        mode: "case_action",
        caseId: availabilityCase.id,
        action,
        note: note || null,
        coverageRequired:
          action === "approve"
            ? (decisionCoverage[availabilityCase.id] ??
              availabilityCase.coverageRequired)
            : null,
      },
      `${action}-${availabilityCase.id}`,
    );

    if (ok) {
      setCaseNotes((current) => ({ ...current, [availabilityCase.id]: "" }));
    }
  }

  async function assignCoverage(availabilityCase: KhposOpsAvailabilityCase) {
    const candidateId = coverCandidate[availabilityCase.id] ?? "";
    const scope = coverScope[availabilityCase.id]?.trim() ?? "";
    const start =
      coverStart[availabilityCase.id] ??
      localInputValue(availabilityCase.startAt);
    const end =
      coverEnd[availabilityCase.id] ??
      localInputValue(availabilityCase.endAt);

    if (!candidateId || !scope || !start || !end) {
      setError(
        "Choose a covering staff member and define the period and coverage scope.",
      );
      return;
    }

    const candidate = coverageOptionsFor(availabilityCase).find(
      (item) => item.staffId === candidateId,
    );
    if (!candidate) {
      setError("Choose an eligible active staff member for coverage.");
      return;
    }

    const ok = await submit(
      {
        mode: "assign_coverage",
        caseId: availabilityCase.id,
        coverAssignmentId: candidate.assignmentId,
        startAt: toIso(start),
        endAt: toIso(end),
        scope,
      },
      `assign-${availabilityCase.id}`,
    );

    if (ok) {
      setCoverCandidate((current) => ({
        ...current,
        [availabilityCase.id]: "",
      }));
      setCoverScope((current) => ({ ...current, [availabilityCase.id]: "" }));
    }
  }

  async function coverageAction(
    coverage: KhposOpsCoverageAssignment,
    action: "accept" | "decline" | "complete" | "cancel",
  ) {
    const note = coverageNotes[coverage.id]?.trim() || "";
    if (
      (action === "decline" || action === "complete") &&
      !note
    ) {
      setError("Add the required note before taking this coverage action.");
      return;
    }
    if (action === "cancel" && coverage.status === "accepted" && !note) {
      setError("Explain why accepted coverage is being cancelled.");
      return;
    }

    const ok = await submit(
      {
        mode: "coverage_action",
        coverageId: coverage.id,
        action,
        note: note || null,
      },
      `${action}-${coverage.id}`,
    );

    if (ok) {
      setCoverageNotes((current) => ({ ...current, [coverage.id]: "" }));
    }
  }

  if (!workspace && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-mint-300" />
          <p className="mt-4 text-sm font-semibold text-slate-300">
            Loading staff availability…
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
            Availability workspace is unavailable
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
              Operations · O8
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
                Availability & Coverage
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
                KHP-OS does not replace the school attendance system. This is
                the exception layer: request or record unavailability, decide
                planned leave, make temporary ownership explicit and verify
                return.
              </p>
            </div>

            {workspace.staffOptions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCreate((value) => !value)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-mint-300 px-5 py-3 text-sm font-black text-slate-950"
              >
                <CalendarClock className="size-4" />
                Record availability
              </button>
            )}
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Pending approval", workspace.summary.pendingApproval],
              ["Coverage gaps", workspace.summary.coverageGaps],
              ["Unavailable now", workspace.summary.currentlyUnavailable],
              ["Return overdue", workspace.summary.overdueReturn],
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
              <p className="text-sm font-black">Transactional boundary</p>
              <p className="mt-1 text-sm leading-6 text-brand-900/80">
                {workspace.attendanceBoundary}
              </p>
            </div>
          </div>
        </section>

        {workspace.staffOptions.length === 0 ? (
          <section className="rounded-[30px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <UserRoundX className="mx-auto size-10 text-brand-700" />
            <h2 className="mt-4 text-2xl font-black">
              No active deployed staff exist yet.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              O8 starts only after O7 has certified a real staff member into an
              active operating role. This prevents availability records being
              created for invented or unready staff.
            </p>
            <Link
              href={`/khpos/${organisationId}/people`}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white"
            >
              <UsersRound className="size-4" />
              Open People & Staff
            </Link>
          </section>
        ) : (
          <>
            {showCreate && (
              <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                  Request / record exception
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Staff availability case
                </h2>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  <label className="text-sm font-bold">
                    Staff
                    <select
                      value={staffId}
                      onChange={(event) => {
                        const nextId = event.target.value;
                        setStaffId(nextId);
                        const next = workspace.staffOptions.find(
                          (staff) => staff.id === nextId,
                        );
                        setSourceType(
                          next?.isSelf ? "self_report" : "leader_record",
                        );
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                    >
                      {workspace.staffOptions.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.displayName} · {staff.roleTitle}
                          {staff.isSelf ? " · Me" : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-bold">
                    Exception type
                    <select
                      value={caseType}
                      onChange={(event) =>
                        setCaseType(
                          event.target.value as KhposOpsAvailabilityCaseType,
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal capitalize outline-none focus:border-brand-400"
                    >
                      {[
                        "planned_leave",
                        "unplanned_absence",
                        "late_arrival",
                        "early_departure",
                        "other_availability",
                      ].map((value) => (
                        <option key={value} value={value}>
                          {readable(value)}
                        </option>
                      ))}
                    </select>
                  </label>

                  {!selectedStaff?.isSelf && (
                    <label className="text-sm font-bold">
                      Source
                      <select
                        value={sourceType}
                        onChange={(event) =>
                          setSourceType(
                            event.target.value as KhposOpsAvailabilitySource,
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                      >
                        <option value="leader_record">Leader record</option>
                        <option value="third_party_exception">
                          Attendance-system exception
                        </option>
                      </select>
                    </label>
                  )}

                  <label className="text-sm font-bold">
                    Start
                    <input
                      type="datetime-local"
                      value={startAt}
                      onChange={(event) => setStartAt(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                    />
                  </label>

                  <label className="text-sm font-bold">
                    End / expected return
                    <input
                      type="datetime-local"
                      value={endAt}
                      onChange={(event) => setEndAt(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                    />
                  </label>

                  <label className="text-sm font-bold">
                    Reason category
                    <select
                      value={reasonCategory}
                      onChange={(event) =>
                        setReasonCategory(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal capitalize outline-none focus:border-brand-400"
                    >
                      {[
                        "not_disclosed",
                        "personal",
                        "family",
                        "emergency",
                        "transport",
                        "official_duty",
                        "other",
                      ].map((value) => (
                        <option key={value} value={value}>
                          {readable(value)}
                        </option>
                      ))}
                    </select>
                  </label>

                  {sourceType === "third_party_exception" &&
                    !selectedStaff?.isSelf && (
                      <label className="text-sm font-bold">
                        External source reference
                        <input
                          value={sourceReference}
                          onChange={(event) =>
                            setSourceReference(event.target.value)
                          }
                          maxLength={500}
                          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                          placeholder="Optional attendance-system reference"
                        />
                      </label>
                    )}

                  <label className="text-sm font-bold lg:col-span-2">
                    Minimum necessary note
                    <textarea
                      value={reasonNote}
                      onChange={(event) => setReasonNote(event.target.value)}
                      maxLength={2000}
                      className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                      placeholder="Do not enter diagnoses, certificates or unnecessary sensitive detail."
                    />
                  </label>
                </div>

                <label className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={coverageRequired}
                    onChange={(event) =>
                      setCoverageRequired(event.target.checked)
                    }
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-black">
                      Coverage is already known to be required
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      A reporting leader may change this during approval.
                    </span>
                  </span>
                </label>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === "create"}
                    onClick={() => void createCase()}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
                  >
                    {busyId === "create" && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    Save availability case
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-black text-slate-700"
                  >
                    Cancel form
                  </button>
                </div>
              </section>
            )}

            {workspace.cases.length === 0 ? (
              <section className="rounded-[30px] border border-slate-200 bg-white p-8 text-center shadow-sm">
                <CheckCircle2 className="mx-auto size-10 text-mint-700" />
                <h2 className="mt-4 text-2xl font-black">
                  No availability exceptions are open or recorded yet.
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Normal attendance stays in the designated attendance system.
                  KHP-OS only appears when an exception needs a decision,
                  coverage or follow-up.
                </p>
              </section>
            ) : (
              <section className="space-y-5">
                {workspace.cases.map((availabilityCase) => {
                  const acceptedCoverage =
                    availabilityCase.coverage.filter((coverage) =>
                      ["accepted", "completed"].includes(coverage.status),
                    ).length;
                  const note = caseNotes[availabilityCase.id] ?? "";
                  const decisionNeedsCoverage =
                    decisionCoverage[availabilityCase.id] ??
                    availabilityCase.coverageRequired;

                  return (
                    <article
                      key={availabilityCase.id}
                      className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7"
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-white">
                              {availabilityCase.reference}
                            </span>
                            <span
                              className={`rounded-full border px-3 py-1 text-[11px] font-black capitalize ${caseStatusClasses(
                                availabilityCase.status,
                              )}`}
                            >
                              {readable(availabilityCase.status)}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold capitalize text-slate-600">
                              {readable(availabilityCase.caseType)}
                            </span>
                          </div>

                          <h2 className="mt-3 text-2xl font-black">
                            {availabilityCase.staffName}
                          </h2>
                          <p className="mt-1 text-sm font-bold text-brand-700">
                            {availabilityCase.roleTitle}
                            {availabilityCase.campusName
                              ? ` · ${availabilityCase.campusName}`
                              : ""}
                            {availabilityCase.unitName
                              ? ` · ${availabilityCase.unitName}`
                              : ""}
                          </p>
                          <p className="mt-3 text-sm text-slate-600">
                            {formatDateTime(availabilityCase.startAt)} →{" "}
                            {formatDateTime(availabilityCase.endAt)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4 lg:min-w-64">
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                            Continuity state
                          </p>
                          <p className="mt-2 text-sm font-black">
                            {availabilityCase.coverageRequired
                              ? availabilityCase.coverageConfirmed
                                ? "Coverage confirmed"
                                : "Coverage unresolved"
                              : "Coverage not required"}
                          </p>
                          {availabilityCase.coverageRequired && (
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {acceptedCoverage} accepted/completed assignment
                              {acceptedCoverage === 1 ? "" : "s"}
                            </p>
                          )}
                        </div>
                      </div>

                      {availabilityCase.reasonCategory ? (
                        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                            Private case context
                          </p>
                          <p className="mt-1 text-sm font-black capitalize">
                            {readable(availabilityCase.reasonCategory)}
                          </p>
                          {availabilityCase.reasonNote && (
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {availabilityCase.reasonNote}
                            </p>
                          )}
                          {availabilityCase.decisionNote && (
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              <strong>Decision:</strong>{" "}
                              {availabilityCase.decisionNote}
                            </p>
                          )}
                        </div>
                      ) : availabilityCase.isCoverer ? (
                        <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm font-semibold text-brand-900">
                          The staff member&apos;s private reason is hidden. You
                          only see the timing and coverage scope needed to do the
                          work.
                        </div>
                      ) : null}

                      {(availabilityCase.isSelf ||
                        availabilityCase.canReview) && (
                        <div className="mt-5">
                          <textarea
                            value={note}
                            onChange={(event) =>
                              setCaseNotes((current) => ({
                                ...current,
                                [availabilityCase.id]: event.target.value,
                              }))
                            }
                            maxLength={2000}
                            className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                            placeholder="Decision / return / closure note when required"
                          />
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {availabilityCase.canReview &&
                          availabilityCase.status === "pending_approval" && (
                            <>
                              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={decisionNeedsCoverage}
                                  onChange={(event) =>
                                    setDecisionCoverage((current) => ({
                                      ...current,
                                      [availabilityCase.id]:
                                        event.target.checked,
                                    }))
                                  }
                                />
                                Require coverage
                              </label>
                              <button
                                type="button"
                                disabled={
                                  busyId ===
                                  `approve-${availabilityCase.id}`
                                }
                                onClick={() =>
                                  void caseAction(availabilityCase, "approve")
                                }
                                className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={
                                  busyId ===
                                  `decline-${availabilityCase.id}`
                                }
                                onClick={() =>
                                  void caseAction(availabilityCase, "decline")
                                }
                                className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-xs font-black text-red-800 disabled:opacity-50"
                              >
                                Decline
                              </button>
                            </>
                          )}

                        {availabilityCase.canReview &&
                          ["approved", "active"].includes(
                            availabilityCase.status,
                          ) &&
                          !availabilityCase.coverageRequired && (
                            <button
                              type="button"
                              disabled={
                                busyId ===
                                `require_coverage-${availabilityCase.id}`
                              }
                              onClick={() =>
                                void caseAction(
                                  availabilityCase,
                                  "require_coverage",
                                )
                              }
                              className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-black text-amber-900 disabled:opacity-50"
                            >
                              Require coverage
                            </button>
                          )}

                        {availabilityCase.canReview &&
                          availabilityCase.status === "coverage_required" &&
                          acceptedCoverage > 0 && (
                            <button
                              type="button"
                              disabled={
                                busyId ===
                                `confirm_coverage-${availabilityCase.id}`
                              }
                              onClick={() =>
                                void caseAction(
                                  availabilityCase,
                                  "confirm_coverage",
                                )
                              }
                              className="rounded-full bg-mint-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                            >
                              Confirm coverage plan
                            </button>
                          )}

                        {(availabilityCase.isSelf ||
                          availabilityCase.canReview) &&
                          ["approved", "active", "coverage_required"].includes(
                            availabilityCase.status,
                          ) && (
                            <button
                              type="button"
                              disabled={
                                busyId ===
                                `return-${availabilityCase.id}`
                              }
                              onClick={() =>
                                void caseAction(availabilityCase, "return")
                              }
                              className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                            >
                              Confirm return
                            </button>
                          )}

                        {availabilityCase.canReview &&
                          availabilityCase.status === "returned" && (
                            <button
                              type="button"
                              disabled={
                                busyId ===
                                `close-${availabilityCase.id}`
                              }
                              onClick={() =>
                                void caseAction(availabilityCase, "close")
                              }
                              className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                            >
                              Close case
                            </button>
                          )}

                        {(availabilityCase.isSelf ||
                          availabilityCase.canReview) &&
                          ["pending_approval", "coverage_required", "approved"].includes(
                            availabilityCase.status,
                          ) && (
                            <button
                              type="button"
                              disabled={
                                busyId ===
                                `cancel-${availabilityCase.id}`
                              }
                              onClick={() =>
                                void caseAction(availabilityCase, "cancel")
                              }
                              className="rounded-full border border-slate-300 px-4 py-2 text-xs font-black text-slate-700 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                      </div>

                      {availabilityCase.coverageRequired && (
                        <details
                          className="mt-6 rounded-2xl border border-slate-200"
                          open={
                            availabilityCase.status === "coverage_required" ||
                            availabilityCase.isCoverer
                          }
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-black">
                            <span>
                              Temporary coverage ·{" "}
                              {availabilityCase.coverage.length} assignment
                              {availabilityCase.coverage.length === 1 ? "" : "s"}
                            </span>
                            <ChevronDown className="size-4 text-slate-500" />
                          </summary>

                          <div className="space-y-4 border-t border-slate-100 p-4">
                            {availabilityCase.canReview &&
                              availabilityCase.status ===
                                "coverage_required" && (
                                <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
                                  <p className="text-sm font-black text-brand-950">
                                    Assign temporary coverage
                                  </p>
                                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                    <select
                                      value={
                                        coverCandidate[
                                          availabilityCase.id
                                        ] ?? ""
                                      }
                                      onChange={(event) =>
                                        setCoverCandidate((current) => ({
                                          ...current,
                                          [availabilityCase.id]:
                                            event.target.value,
                                        }))
                                      }
                                      className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs outline-none"
                                    >
                                      <option value="">
                                        Select active staff member
                                      </option>
                                      {coverageOptionsFor(
                                        availabilityCase,
                                      ).map((candidate) => (
                                        <option
                                          key={candidate.staffId}
                                          value={candidate.staffId}
                                        >
                                          {candidate.displayName} ·{" "}
                                          {candidate.roleTitle}
                                        </option>
                                      ))}
                                    </select>

                                    <input
                                      value={
                                        coverScope[availabilityCase.id] ?? ""
                                      }
                                      onChange={(event) =>
                                        setCoverScope((current) => ({
                                          ...current,
                                          [availabilityCase.id]:
                                            event.target.value,
                                        }))
                                      }
                                      maxLength={1500}
                                      className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs outline-none"
                                      placeholder="Exact duties / learners / responsibilities to cover"
                                    />

                                    <label className="text-xs font-bold text-brand-950">
                                      Coverage start
                                      <input
                                        type="datetime-local"
                                        value={
                                          coverStart[availabilityCase.id] ??
                                          localInputValue(
                                            availabilityCase.startAt,
                                          )
                                        }
                                        onChange={(event) =>
                                          setCoverStart((current) => ({
                                            ...current,
                                            [availabilityCase.id]:
                                              event.target.value,
                                          }))
                                        }
                                        className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-3 py-2 font-normal outline-none"
                                      />
                                    </label>

                                    <label className="text-xs font-bold text-brand-950">
                                      Coverage end
                                      <input
                                        type="datetime-local"
                                        value={
                                          coverEnd[availabilityCase.id] ??
                                          localInputValue(
                                            availabilityCase.endAt,
                                          )
                                        }
                                        onChange={(event) =>
                                          setCoverEnd((current) => ({
                                            ...current,
                                            [availabilityCase.id]:
                                              event.target.value,
                                          }))
                                        }
                                        className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-3 py-2 font-normal outline-none"
                                      />
                                    </label>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={
                                      busyId ===
                                      `assign-${availabilityCase.id}`
                                    }
                                    onClick={() =>
                                      void assignCoverage(availabilityCase)
                                    }
                                    className="mt-3 rounded-full bg-brand-800 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                                  >
                                    Assign coverage
                                  </button>
                                </div>
                              )}

                            {availabilityCase.coverage.length === 0 ? (
                              <p className="text-sm text-slate-500">
                                No temporary coverage has been assigned yet.
                              </p>
                            ) : (
                              availabilityCase.coverage.map((coverage) => {
                                const coverageNote =
                                  coverageNotes[coverage.id] ?? "";
                                return (
                                  <div
                                    key={coverage.id}
                                    className="rounded-2xl border border-slate-200 p-4"
                                  >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="text-sm font-black">
                                            {coverage.coverStaffName ??
                                              "Covering staff"}
                                          </p>
                                          <span
                                            className={`rounded-full px-2.5 py-1 text-[10px] font-black capitalize ${coverageStatusClasses(
                                              coverage.status,
                                            )}`}
                                          >
                                            {readable(coverage.status)}
                                          </span>
                                        </div>
                                        <p className="mt-1 text-xs font-semibold text-slate-500">
                                          {coverage.coverRoleTitle} ·{" "}
                                          {formatDateTime(coverage.startAt)} →{" "}
                                          {formatDateTime(coverage.endAt)}
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-slate-700">
                                          {coverage.coverageScope}
                                        </p>
                                        {coverage.responseNote && (
                                          <p className="mt-2 text-xs text-slate-500">
                                            <strong>Response:</strong>{" "}
                                            {coverage.responseNote}
                                          </p>
                                        )}
                                        {coverage.completionNote && (
                                          <p className="mt-1 text-xs text-slate-500">
                                            <strong>Handback:</strong>{" "}
                                            {coverage.completionNote}
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    {coverage.canAct &&
                                      ["assigned", "accepted"].includes(
                                        coverage.status,
                                      ) && (
                                        <input
                                          value={coverageNote}
                                          onChange={(event) =>
                                            setCoverageNotes((current) => ({
                                              ...current,
                                              [coverage.id]:
                                                event.target.value,
                                            }))
                                          }
                                          maxLength={1500}
                                          className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-400"
                                          placeholder="Response / handback note"
                                        />
                                      )}

                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {coverage.isCoverer &&
                                        coverage.status === "assigned" && (
                                          <>
                                            <button
                                              type="button"
                                              disabled={
                                                busyId ===
                                                `accept-${coverage.id}`
                                              }
                                              onClick={() =>
                                                void coverageAction(
                                                  coverage,
                                                  "accept",
                                                )
                                              }
                                              className="rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-50"
                                            >
                                              Accept coverage
                                            </button>
                                            <button
                                              type="button"
                                              disabled={
                                                busyId ===
                                                `decline-${coverage.id}`
                                              }
                                              onClick={() =>
                                                void coverageAction(
                                                  coverage,
                                                  "decline",
                                                )
                                              }
                                              className="rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-[11px] font-black text-red-800 disabled:opacity-50"
                                            >
                                              Decline
                                            </button>
                                          </>
                                        )}

                                      {(coverage.isCoverer ||
                                        availabilityCase.canReview) &&
                                        coverage.status === "accepted" && (
                                          <button
                                            type="button"
                                            disabled={
                                              busyId ===
                                              `complete-${coverage.id}`
                                            }
                                            onClick={() =>
                                              void coverageAction(
                                                coverage,
                                                "complete",
                                              )
                                            }
                                            className="rounded-full bg-slate-950 px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-50"
                                          >
                                            Complete / hand back
                                          </button>
                                        )}

                                      {availabilityCase.canReview &&
                                        ["assigned", "accepted"].includes(
                                          coverage.status,
                                        ) && (
                                          <button
                                            type="button"
                                            disabled={
                                              busyId ===
                                              `cancel-${coverage.id}`
                                            }
                                            onClick={() =>
                                              void coverageAction(
                                                coverage,
                                                "cancel",
                                              )
                                            }
                                            className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-black text-slate-700 disabled:opacity-50"
                                          >
                                            Cancel assignment
                                          </button>
                                        )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </details>
                      )}

                      {(availabilityCase.isSelf ||
                        availabilityCase.canReview) &&
                        availabilityCase.history.length > 0 && (
                          <details className="mt-4 border-t border-slate-100 pt-4">
                            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black text-slate-700">
                              <Clock3 className="size-4" />
                              Case history
                              <ChevronDown className="size-4" />
                            </summary>
                            <div className="mt-4 space-y-3">
                              {availabilityCase.history.map((event, index) => (
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

        <section className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white sm:p-7">
          <UserCheck className="size-6 text-mint-300" />
          <h2 className="mt-3 text-xl font-black">
            Repeated absence is not solved by repeated reminders
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-300">
            O8 handles the immediate continuity exception. If a pattern becomes
            repeated or materially affects performance, it should move into the
            staff performance process and, where necessary, the Issue Engine.
            Availability history is evidence; it is not itself a disciplinary
            verdict.
          </p>
        </section>
      </div>
    </main>
  );
}
