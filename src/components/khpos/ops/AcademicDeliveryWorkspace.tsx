"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpenCheck,
  CircleAlert,
  Gauge,
  GraduationCap,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsAcademicDeliveryWorkspace,
  KhposOpsAcademicStream,
  KhposOpsAcademicTarget,
} from "@/lib/khpos/ops/academic-delivery";

function readable(value: string | null | undefined) {
  return (value ?? "—").replaceAll("_", " ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value + "T00:00:00"),
  );
}

function statusClass(status: string) {
  if (["verified", "recovered", "closed", "active"].includes(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (["approved", "delivered", "ready"].includes(status)) {
    return "border-brand-200 bg-brand-50 text-brand-800";
  }
  if (
    ["recovery_required", "partial", "missed", "rejected", "evidence_submitted"].includes(
      status,
    )
  ) {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  if (status === "cancelled") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }
  return "border-violet-200 bg-violet-50 text-violet-800";
}

export function AcademicDeliveryWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] =
    useState<KhposOpsAcademicDeliveryWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const [sessionLabel, setSessionLabel] = useState("");
  const [termCode, setTermCode] = useState("");
  const [termName, setTermName] = useState("");
  const [termStartDate, setTermStartDate] = useState("");
  const [termEndDate, setTermEndDate] = useState("");
  const [termCampusId, setTermCampusId] = useState("");

  const [streamTermId, setStreamTermId] = useState("");
  const [streamCampusId, setStreamCampusId] = useState("");
  const [streamUnitId, setStreamUnitId] = useState("");
  const [classLabel, setClassLabel] = useState("");
  const [sectionLabel, setSectionLabel] = useState("");
  const [subjectLabel, setSubjectLabel] = useState("");
  const [teacherAssignmentId, setTeacherAssignmentId] = useState("");
  const [schemeSource, setSchemeSource] = useState<
    "KSI" | "SIS" | "external" | "manual"
  >("KSI");
  const [schemeReference, setSchemeReference] = useState("");
  const [timetableReference, setTimetableReference] = useState("");
  const [expectedWeeks, setExpectedWeeks] = useState("12");

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [selects, setSelects] = useState<Record<string, string>>({});
  const [numbers, setNumbers] = useState<Record<string, string>>({});

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
        "/api/khpos/ops/academic-delivery/" + organisationId,
        {
          headers: { Authorization: "Bearer " + accessToken },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        academic?: KhposOpsAcademicDeliveryWorkspace;
        error?: string;
      };

      if (!active) return;
      if (!response.ok || !body.ok || !body.academic) {
        setError(body.error ?? "Academic Delivery could not be loaded.");
        return;
      }

      const next = body.academic;
      setWorkspace(next);
      setTermCampusId((current) => current || next.campuses[0]?.id || "");
      setStreamCampusId((current) => current || next.campuses[0]?.id || "");
      setStreamUnitId((current) => current || next.units[0]?.id || "");
      setTeacherAssignmentId(
        (current) => current || next.teacherAssignments[0]?.id || "",
      );
      setStreamTermId(
        (current) =>
          current ||
          next.terms.find((term) => !["closed", "cancelled"].includes(term.status))
            ?.id ||
          "",
      );
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
      "/api/khpos/ops/academic-delivery/" + organisationId,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const body = (await response.json()) as {
      ok?: boolean;
      academic?: KhposOpsAcademicDeliveryWorkspace;
      error?: string;
    };

    setBusyId(null);
    if (!response.ok || !body.ok || !body.academic) {
      setError(body.error ?? "Academic Delivery operation could not be completed.");
      return false;
    }

    setWorkspace(body.academic);
    return true;
  }

  async function createTerm() {
    if (
      !sessionLabel.trim() ||
      !termCode.trim() ||
      !termName.trim() ||
      !termStartDate ||
      !termEndDate
    ) {
      setError("Session, term code/name and start/end dates are required.");
      return;
    }

    const ok = await submit(
      {
        mode: "create_term",
        campusId: termCampusId || null,
        sessionLabel: sessionLabel.trim(),
        termCode: termCode.trim(),
        termName: termName.trim(),
        startDate: termStartDate,
        endDate: termEndDate,
      },
      "create-term",
    );

    if (ok) {
      setTermCode("");
      setTermName("");
      setTermStartDate("");
      setTermEndDate("");
    }
  }

  async function createStream() {
    if (
      !streamTermId ||
      !classLabel.trim() ||
      !subjectLabel.trim() ||
      !teacherAssignmentId ||
      !schemeReference.trim() ||
      !timetableReference.trim()
    ) {
      setError(
        "Term, class, subject, Teacher, scheme reference and timetable reference are required.",
      );
      return;
    }

    const weeks = Number(expectedWeeks);
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 24) {
      setError("Expected teaching weeks must be between 1 and 24.");
      return;
    }

    const ok = await submit(
      {
        mode: "create_stream",
        termId: streamTermId,
        campusId: streamCampusId || null,
        unitId: streamUnitId || null,
        classLabel: classLabel.trim(),
        sectionLabel: sectionLabel.trim() || null,
        subjectLabel: subjectLabel.trim(),
        subjectCode: null,
        teacherAssignmentId,
        schemeSource,
        schemeReference: schemeReference.trim(),
        schemeVersion: null,
        timetableReference: timetableReference.trim(),
        expectedWeeks: weeks,
      },
      "create-stream",
    );

    if (ok) {
      setClassLabel("");
      setSectionLabel("");
      setSubjectLabel("");
      setSchemeReference("");
      setTimetableReference("");
    }
  }

  if (!workspace && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50">
        <Loader2 className="size-8 animate-spin text-brand-700" />
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <CircleAlert className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Academic Delivery unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <Link
            href={"/khpos/" + organisationId}
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-bold text-mint-200">
              Operations · O12
            </span>
            <div className="flex flex-wrap gap-2">
              <Link
                href={"/khpos/" + organisationId + "/learning-intelligence"}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black"
              >
                <Gauge className="size-4" />
                KSI Learning Intelligence
              </Link>
              <Link
                href={"/khpos/" + organisationId}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black"
              >
                <ArrowLeft className="size-4" />
                Command Centre
              </Link>
            </div>
          </div>

          <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-5xl">
            Academic Planning & Delivery
          </h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-brand-100 sm:text-base">
            Planned is not Delivered. Delivered is not Verified. Missed or weak
            learning remains visible as academic debt until recovery evidence is
            independently verified.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {[
              ["Active terms", workspace.summary.activeTerms],
              ["Streams", workspace.summary.visibleStreams],
              ["Targets", workspace.summary.plannedTargets],
              ["Verified", workspace.summary.verifiedTargets],
              ["Open debt", workspace.summary.openDebt],
              ["Overdue debt", workspace.summary.overdueDebt],
              ["Obs. follow-up", workspace.summary.openObservationFollowUp],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-white/10 bg-white/10 p-4"
              >
                <p className="text-[11px] font-bold text-brand-100">{label}</p>
                <p className="mt-1 text-2xl font-black">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 lg:grid-cols-2">
          <InfoCard
            title="Execution principle"
            text={workspace.principle}
            tone="green"
          />
          <InfoCard
            title="Technology boundary"
            text={workspace.technologyBoundary}
            tone="brand"
          />
        </section>

        {workspace.canPlan && (
          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
                Academic term
              </p>
              <h2 className="mt-2 text-xl font-black">Open the term baseline</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <select
                  value={termCampusId}
                  onChange={(event) => setTermCampusId(event.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">Organisation-wide</option>
                  {workspace.campuses.map((campus) => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </select>
                <input
                  value={sessionLabel}
                  onChange={(event) => setSessionLabel(event.target.value)}
                  placeholder="Session e.g. 2026/2027"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
                <input
                  value={termCode}
                  onChange={(event) => setTermCode(event.target.value)}
                  placeholder="Term code e.g. TERM-1"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
                <input
                  value={termName}
                  onChange={(event) => setTermName(event.target.value)}
                  placeholder="Term name"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
                <input
                  type="date"
                  value={termStartDate}
                  onChange={(event) => setTermStartDate(event.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
                <input
                  type="date"
                  value={termEndDate}
                  onChange={(event) => setTermEndDate(event.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => void createTerm()}
                disabled={busyId === "create-term"}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                {busyId === "create-term" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <BookOpenCheck className="size-3.5" />
                )}
                Create draft term
              </button>
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">
                Curriculum delivery stream
              </p>
              <h2 className="mt-2 text-xl font-black">
                Reference the approved scheme & timetable
              </h2>
              {workspace.teacherAssignments.length === 0 ? (
                <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  No active Teacher role assignment exists yet. Activate real
                  Teachers in People & Staff before creating delivery streams.
                </p>
              ) : (
                <>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <select
                      value={streamTermId}
                      onChange={(event) => setStreamTermId(event.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    >
                      <option value="">Choose term</option>
                      {workspace.terms
                        .filter((term) => !["closed", "cancelled"].includes(term.status))
                        .map((term) => (
                          <option key={term.id} value={term.id}>
                            {term.sessionLabel} · {term.termName}
                          </option>
                        ))}
                    </select>
                    <select
                      value={teacherAssignmentId}
                      onChange={(event) =>
                        setTeacherAssignmentId(event.target.value)
                      }
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    >
                      {workspace.teacherAssignments.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.displayName}
                        </option>
                      ))}
                    </select>
                    <input
                      value={classLabel}
                      onChange={(event) => setClassLabel(event.target.value)}
                      placeholder="Class e.g. JSS 1"
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <input
                      value={sectionLabel}
                      onChange={(event) => setSectionLabel(event.target.value)}
                      placeholder="Section e.g. A"
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <input
                      value={subjectLabel}
                      onChange={(event) => setSubjectLabel(event.target.value)}
                      placeholder="Subject"
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <select
                      value={schemeSource}
                      onChange={(event) =>
                        setSchemeSource(
                          event.target.value as
                            | "KSI"
                            | "SIS"
                            | "external"
                            | "manual",
                        )
                      }
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    >
                      <option value="KSI">KSI</option>
                      <option value="SIS">SIS</option>
                      <option value="external">External approved source</option>
                      <option value="manual">Controlled manual source</option>
                    </select>
                    <input
                      value={schemeReference}
                      onChange={(event) => setSchemeReference(event.target.value)}
                      placeholder="Approved scheme reference"
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <input
                      value={timetableReference}
                      onChange={(event) =>
                        setTimetableReference(event.target.value)
                      }
                      placeholder="Approved timetable reference"
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={expectedWeeks}
                      onChange={(event) => setExpectedWeeks(event.target.value)}
                      placeholder="Weeks"
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void createStream()}
                    disabled={busyId === "create-stream"}
                    className="mt-4 rounded-full bg-violet-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                  >
                    Create delivery stream
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        <section>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
            Academic terms
          </p>
          <h2 className="mt-2 text-2xl font-black">Execution baseline</h2>
          {workspace.terms.length === 0 ? (
            <Empty text="No academic term has been created yet." />
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {workspace.terms.map((term) => (
                <article
                  key={term.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-black">
                        {term.sessionLabel} · {term.termName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(term.startDate)} → {formatDate(term.endDate)}
                      </p>
                    </div>
                    <Badge status={term.status} />
                  </div>
                  {workspace.canPlan && term.status === "draft" && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void submit(
                            {
                              mode: "term_action",
                              termId: term.id,
                              action: "activate",
                              note: "Approved academic execution baseline activated.",
                            },
                            "activate-term-" + term.id,
                          )
                        }
                        className="rounded-full bg-emerald-700 px-3 py-2 text-xs font-black text-white"
                      >
                        Activate
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void submit(
                            {
                              mode: "term_action",
                              termId: term.id,
                              action: "cancel",
                              note: "Draft term cancelled before activation.",
                            },
                            "cancel-term-" + term.id,
                          )
                        }
                        className="rounded-full border border-slate-200 px-3 py-2 text-xs font-black text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
            Curriculum execution
          </p>
          <h2 className="mt-2 text-2xl font-black">
            Streams, targets, verification & debt
          </h2>
          {workspace.streams.length === 0 ? (
            <Empty text="No academic delivery stream is visible yet." />
          ) : (
            <div className="mt-5 space-y-5">
              {workspace.streams.map((stream) => (
                <StreamCard
                  key={stream.id}
                  stream={stream}
                  workspace={workspace}
                  busyId={busyId}
                  notes={notes}
                  refs={refs}
                  dates={dates}
                  selects={selects}
                  numbers={numbers}
                  setNote={(key, value) =>
                    setNotes((current) => ({ ...current, [key]: value }))
                  }
                  setRef={(key, value) =>
                    setRefs((current) => ({ ...current, [key]: value }))
                  }
                  setDate={(key, value) =>
                    setDates((current) => ({ ...current, [key]: value }))
                  }
                  setSelect={(key, value) =>
                    setSelects((current) => ({ ...current, [key]: value }))
                  }
                  setNumber={(key, value) =>
                    setNumbers((current) => ({ ...current, [key]: value }))
                  }
                  submit={submit}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
            Teaching quality
          </p>
          <h2 className="mt-2 text-2xl font-black">Observation follow-up</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Observation records specific practice and improvement evidence. It
            is not a teacher ranking and does not create automatic discipline.
          </p>
          {workspace.observations.length === 0 ? (
            <Empty text="No teaching observation is visible yet." />
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {workspace.observations.map((observation) => {
                const noteKey = "obs-follow-note-" + observation.id;
                const refKey = "obs-follow-ref-" + observation.id;
                return (
                  <article
                    key={observation.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex gap-2">
                      <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black capitalize text-white">
                        {readable(observation.observationType)}
                      </span>
                      <Badge status={observation.followUpStatus} />
                    </div>
                    <p className="mt-3 text-sm font-black">Observed strengths</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {observation.strengths}
                    </p>
                    {observation.requiredAction && (
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        <strong>Follow-up:</strong> {observation.requiredAction} ·{" "}
                        {formatDate(observation.actionDueDate)}
                      </p>
                    )}

                    {observation.isObservedTeacher &&
                      observation.followUpStatus === "open" && (
                        <div className="mt-4 grid gap-2">
                          <textarea
                            value={notes[noteKey] ?? ""}
                            onChange={(event) =>
                              setNotes((current) => ({
                                ...current,
                                [noteKey]: event.target.value,
                              }))
                            }
                            placeholder="What did you change?"
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                          />
                          <input
                            value={refs[refKey] ?? ""}
                            onChange={(event) =>
                              setRefs((current) => ({
                                ...current,
                                [refKey]: event.target.value,
                              }))
                            }
                            placeholder="Evidence reference"
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                          />
                          <SmallButton
                            label="Submit follow-up"
                            onClick={() =>
                              void submit(
                                {
                                  mode: "observation_action",
                                  observationId: observation.id,
                                  action: "submit_followup",
                                  note: notes[noteKey] ?? "",
                                  reference: refs[refKey] ?? "",
                                },
                                "obs-submit-" + observation.id,
                              )
                            }
                          />
                        </div>
                      )}

                    {observation.canMonitor &&
                      observation.followUpStatus === "evidence_submitted" && (
                        <div className="mt-4 flex gap-2">
                          <SmallButton
                            label="Verify follow-up"
                            onClick={() =>
                              void submit(
                                {
                                  mode: "observation_action",
                                  observationId: observation.id,
                                  action: "verify_followup",
                                },
                                "obs-verify-" + observation.id,
                              )
                            }
                          />
                          <SmallButton
                            label="Reopen"
                            secondary
                            onClick={() =>
                              void submit(
                                {
                                  mode: "observation_action",
                                  observationId: observation.id,
                                  action: "reopen_followup",
                                  note:
                                    notes[noteKey] ??
                                    "Follow-up evidence needs additional correction.",
                                },
                                "obs-reopen-" + observation.id,
                              )
                            }
                          />
                        </div>
                      )}
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

function InfoCard({
  title,
  text,
  tone,
}: {
  title: string;
  text: string;
  tone: "green" | "brand";
}) {
  const green = tone === "green";
  return (
    <div
      className={
        "rounded-[28px] border p-5 " +
        (green
          ? "border-emerald-200 bg-emerald-50"
          : "border-brand-200 bg-brand-50")
      }
    >
      <div className="flex gap-3">
        {green ? (
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" />
        ) : (
          <GraduationCap className="mt-0.5 size-5 shrink-0 text-brand-700" />
        )}
        <div>
          <p
            className={
              "text-sm font-black " +
              (green ? "text-emerald-950" : "text-brand-950")
            }
          >
            {title}
          </p>
          <p
            className={
              "mt-1 text-sm leading-6 " +
              (green ? "text-emerald-900/80" : "text-brand-900/80")
            }
          >
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-[28px] border border-dashed border-slate-300 bg-white p-7 text-center text-sm font-semibold text-slate-500">
      {text}
    </div>
  );
}

function Badge({ status }: { status: string }) {
  return (
    <span
      className={
        "rounded-full border px-2.5 py-1 text-[10px] font-black capitalize " +
        statusClass(status)
      }
    >
      {readable(status)}
    </span>
  );
}

function SmallButton({
  label,
  onClick,
  secondary = false,
}: {
  label: string;
  onClick: () => void;
  secondary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        secondary
          ? "rounded-full border border-slate-300 bg-white px-3 py-2 text-[11px] font-black text-slate-700"
          : "rounded-full bg-slate-950 px-3 py-2 text-[11px] font-black text-white"
      }
    >
      {label}
    </button>
  );
}

function StreamCard({
  stream,
  workspace,
  busyId,
  notes,
  refs,
  dates,
  selects,
  numbers,
  setNote,
  setRef,
  setDate,
  setSelect,
  setNumber,
  submit,
}: {
  stream: KhposOpsAcademicStream;
  workspace: KhposOpsAcademicDeliveryWorkspace;
  busyId: string | null;
  notes: Record<string, string>;
  refs: Record<string, string>;
  dates: Record<string, string>;
  selects: Record<string, string>;
  numbers: Record<string, string>;
  setNote: (key: string, value: string) => void;
  setRef: (key: string, value: string) => void;
  setDate: (key: string, value: string) => void;
  setSelect: (key: string, value: string) => void;
  setNumber: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const weekKey = "week-" + stream.id;
  const targetKey = "target-" + stream.id;
  const targetRefKey = "target-ref-" + stream.id;
  const startKey = "target-start-" + stream.id;
  const endKey = "target-end-" + stream.id;
  const teacherKey = "teacher-" + stream.id;
  const timetableKey = "timetable-" + stream.id;
  const changeNoteKey = "change-note-" + stream.id;
  const obsStrengthKey = "obs-strength-" + stream.id;
  const obsActionKey = "obs-action-" + stream.id;
  const obsDueKey = "obs-due-" + stream.id;

  return (
    <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex gap-2">
            <Badge status={stream.status} />
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600">
              {stream.schemeSource}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-black">
            {stream.classLabel}
            {stream.sectionLabel ? " " + stream.sectionLabel : ""} ·{" "}
            {stream.subjectLabel}
          </h3>
          <p className="mt-1 text-sm font-bold text-brand-700">
            Teacher: {stream.teacherDisplay}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Scheme: {stream.schemeReference}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Timetable: {stream.timetableReference}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
          {stream.targets.length} target(s) · {stream.expectedWeeks} weeks
        </div>
      </div>

      {(stream.canPlan || stream.canMonitor) &&
        !["closed", "cancelled"].includes(stream.status) && (
          <details className="mt-4 rounded-2xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-black">
              Planning controls
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-black">Add weekly target</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    type="number"
                    min={1}
                    max={stream.expectedWeeks}
                    value={numbers[weekKey] ?? ""}
                    onChange={(event) => setNumber(weekKey, event.target.value)}
                    placeholder="Week"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                  />
                  <input
                    value={refs[targetRefKey] ?? ""}
                    onChange={(event) => setRef(targetRefKey, event.target.value)}
                    placeholder="Scheme target ref"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                  />
                  <input
                    value={notes[targetKey] ?? ""}
                    onChange={(event) => setNote(targetKey, event.target.value)}
                    placeholder="Target label"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:col-span-2"
                  />
                  <input
                    type="date"
                    value={dates[startKey] ?? ""}
                    onChange={(event) => setDate(startKey, event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                  />
                  <input
                    type="date"
                    value={dates[endKey] ?? ""}
                    onChange={(event) => setDate(endKey, event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                  />
                </div>
                <SmallButton
                  label="Add target"
                  onClick={() =>
                    void submit(
                      {
                        mode: "add_target",
                        streamId: stream.id,
                        weekNumber: Number(numbers[weekKey] ?? 0),
                        targetReference: refs[targetRefKey] ?? "",
                        targetLabel: notes[targetKey] ?? "",
                        plannedStartDate: dates[startKey] || null,
                        plannedEndDate: dates[endKey] || null,
                      },
                      "add-target-" + stream.id,
                    )
                  }
                />
              </div>

              {stream.canPlan && ["approved", "active"].includes(stream.status) && (
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-black">Change deployment</p>
                  <select
                    value={selects[teacherKey] ?? stream.teacherAssignmentId}
                    onChange={(event) => setSelect(teacherKey, event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                  >
                    {workspace.teacherAssignments.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.displayName}
                      </option>
                    ))}
                  </select>
                  <input
                    value={refs[timetableKey] ?? stream.timetableReference}
                    onChange={(event) =>
                      setRef(timetableKey, event.target.value)
                    }
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                  />
                  <textarea
                    value={notes[changeNoteKey] ?? ""}
                    onChange={(event) =>
                      setNote(changeNoteKey, event.target.value)
                    }
                    placeholder="Why is Teacher/timetable changing?"
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                  />
                  <SmallButton
                    label="Update deployment"
                    secondary
                    onClick={() =>
                      void submit(
                        {
                          mode: "update_stream_assignment",
                          streamId: stream.id,
                          teacherAssignmentId:
                            selects[teacherKey] ?? stream.teacherAssignmentId,
                          timetableReference:
                            refs[timetableKey] ?? stream.timetableReference,
                          note: notes[changeNoteKey] ?? "",
                        },
                        "update-stream-" + stream.id,
                      )
                    }
                  />
                </div>
              )}
            </div>

            {stream.canPlan && stream.status === "draft" && (
              <div className="mt-3 flex gap-2">
                <SmallButton
                  label="Approve stream"
                  onClick={() =>
                    void submit(
                      {
                        mode: "stream_action",
                        streamId: stream.id,
                        action: "approve",
                        note: "Scheme, timetable, Teacher and weekly target baseline checked.",
                      },
                      "approve-stream-" + stream.id,
                    )
                  }
                />
                <SmallButton
                  label="Cancel stream"
                  secondary
                  onClick={() =>
                    void submit(
                      {
                        mode: "stream_action",
                        streamId: stream.id,
                        action: "cancel",
                        note: "Draft stream cancelled before delivery.",
                      },
                      "cancel-stream-" + stream.id,
                    )
                  }
                />
              </div>
            )}
          </details>
        )}

      <div className="mt-4 space-y-3">
        {stream.targets.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
            No weekly target loaded.
          </p>
        ) : (
          stream.targets.map((target) => (
            <TargetCard
              key={target.id}
              target={target}
              stream={stream}
              workspace={workspace}
              notes={notes}
              refs={refs}
              dates={dates}
              selects={selects}
              setNote={setNote}
              setRef={setRef}
              setDate={setDate}
              setSelect={setSelect}
              submit={submit}
            />
          ))
        )}
      </div>

      {stream.canMonitor && !["closed", "cancelled"].includes(stream.status) && (
        <details className="mt-4 rounded-2xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-black">
            Record teaching observation
          </summary>
          <textarea
            value={notes[obsStrengthKey] ?? ""}
            onChange={(event) => setNote(obsStrengthKey, event.target.value)}
            placeholder="Specific strengths/evidence observed"
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />
          <textarea
            value={notes[obsActionKey] ?? ""}
            onChange={(event) => setNote(obsActionKey, event.target.value)}
            placeholder="Required follow-up action (optional)"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />
          <input
            type="date"
            value={dates[obsDueKey] ?? ""}
            onChange={(event) => setDate(obsDueKey, event.target.value)}
            className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />
          <div className="mt-2">
            <SmallButton
              label="Save development observation"
              onClick={() =>
                void submit(
                  {
                    mode: "create_observation",
                    streamId: stream.id,
                    targetId: null,
                    observationType: "development",
                    strengths: notes[obsStrengthKey] ?? "",
                    improvementArea: null,
                    requiredAction: notes[obsActionKey] || null,
                    actionDueDate: dates[obsDueKey] || null,
                  },
                  "observation-" + stream.id,
                )
              }
            />
          </div>
        </details>
      )}
    </article>
  );
}

function TargetCard({
  target,
  stream,
  workspace,
  notes,
  refs,
  dates,
  selects,
  setNote,
  setRef,
  setDate,
  setSelect,
  submit,
}: {
  target: KhposOpsAcademicTarget;
  stream: KhposOpsAcademicStream;
  workspace: KhposOpsAcademicDeliveryWorkspace;
  notes: Record<string, string>;
  refs: Record<string, string>;
  dates: Record<string, string>;
  selects: Record<string, string>;
  setNote: (key: string, value: string) => void;
  setRef: (key: string, value: string) => void;
  setDate: (key: string, value: string) => void;
  setSelect: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const noteKey = "target-note-" + target.id;
  const refKey = "target-ref-" + target.id;
  const verifyKey = "verify-note-" + target.id;
  const debtNoteKey = "debt-note-" + target.id;
  const debtDateKey = "debt-date-" + target.id;
  const debtRefKey = "debt-ref-" + target.id;
  const debtOwnerKey = "debt-owner-" + target.id;

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-black text-slate-500">
            Week {target.weekNumber}
          </p>
          <p className="mt-1 text-sm font-black">{target.targetLabel}</p>
          <p className="mt-1 text-xs text-slate-400">{target.targetReference}</p>
        </div>
        <div className="flex gap-2">
          <Badge status={target.state} />
          <Badge status={target.verificationState} />
        </div>
      </div>

      {stream.isTeacher &&
        ["planned", "ready", "in_progress"].includes(target.state) && (
          <div className="mt-3 rounded-xl bg-brand-50 p-3">
            <textarea
              value={notes[noteKey] ?? ""}
              onChange={(event) => setNote(noteKey, event.target.value)}
              placeholder="Preparation/delivery note or partial/missed cause"
              className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs"
            />
            <input
              value={refs[refKey] ?? ""}
              onChange={(event) => setRef(refKey, event.target.value)}
              placeholder="KSI lesson / delivery evidence reference"
              className="mt-2 w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {target.state === "planned" && (
                <SmallButton
                  label="Mark ready"
                  onClick={() =>
                    void submit(
                      {
                        mode: "target_action",
                        targetId: target.id,
                        action: "ready",
                        note: notes[noteKey] || null,
                        reference: refs[refKey] ?? "",
                      },
                      "ready-" + target.id,
                    )
                  }
                />
              )}
              {target.state === "ready" && (
                <SmallButton
                  label="Start"
                  onClick={() =>
                    void submit(
                      {
                        mode: "target_action",
                        targetId: target.id,
                        action: "start",
                      },
                      "start-" + target.id,
                    )
                  }
                />
              )}
              {["ready", "in_progress"].includes(target.state) && (
                <SmallButton
                  label="Delivered"
                  onClick={() =>
                    void submit(
                      {
                        mode: "target_action",
                        targetId: target.id,
                        action: "delivered",
                        note: notes[noteKey] ?? "",
                        reference: refs[refKey] ?? "",
                      },
                      "delivered-" + target.id,
                    )
                  }
                />
              )}
              <SmallButton
                label="Partial"
                secondary
                onClick={() =>
                  void submit(
                    {
                      mode: "target_action",
                      targetId: target.id,
                      action: "partial",
                      note: notes[noteKey] ?? "",
                      reference: refs[refKey] || null,
                      causeCategory: "other",
                      severity: "P3",
                    },
                    "partial-" + target.id,
                  )
                }
              />
              <SmallButton
                label="Missed"
                secondary
                onClick={() =>
                  void submit(
                    {
                      mode: "target_action",
                      targetId: target.id,
                      action: "missed",
                      note: notes[noteKey] ?? "",
                      reference: refs[refKey] || null,
                      causeCategory: "other",
                      severity: "P3",
                    },
                    "missed-" + target.id,
                  )
                }
              />
            </div>
          </div>
        )}

      {stream.canMonitor &&
        target.state === "delivered" &&
        target.verificationState === "unverified" && (
          <div className="mt-3 rounded-xl bg-violet-50 p-3">
            <textarea
              value={notes[verifyKey] ?? ""}
              onChange={(event) => setNote(verifyKey, event.target.value)}
              placeholder="Reasoned verification note"
              className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs"
            />
            <div className="mt-2 flex gap-2">
              <SmallButton
                label="Verify delivery"
                onClick={() =>
                  void submit(
                    {
                      mode: "verify_target",
                      targetId: target.id,
                      decision: "verify",
                      note: notes[verifyKey] ?? "",
                    },
                    "verify-" + target.id,
                  )
                }
              />
              <SmallButton
                label="Reject → debt"
                secondary
                onClick={() =>
                  void submit(
                    {
                      mode: "verify_target",
                      targetId: target.id,
                      decision: "reject",
                      note: notes[verifyKey] ?? "",
                      rejectionCauseCategory: "other",
                      severity: "P3",
                    },
                    "reject-" + target.id,
                  )
                }
              />
            </div>
          </div>
        )}

      {target.debt && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-black text-amber-950">
              Academic debt · {readable(target.debt.debtType)}
            </p>
            <Badge status={target.debt.status} />
          </div>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            {target.debt.causeNote}
          </p>

          {target.debt.status !== "closed" && (
            <>
              <textarea
                value={notes[debtNoteKey] ?? ""}
                onChange={(event) => setNote(debtNoteKey, event.target.value)}
                placeholder="Recovery plan / completion note"
                className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs"
              />
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input
                  type="date"
                  value={dates[debtDateKey] ?? target.debt.recoveryDueDate ?? ""}
                  onChange={(event) => setDate(debtDateKey, event.target.value)}
                  className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs"
                />
                <input
                  value={refs[debtRefKey] ?? ""}
                  onChange={(event) => setRef(debtRefKey, event.target.value)}
                  placeholder="Recovery evidence reference"
                  className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs"
                />
              </div>
            </>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            {(target.debt.isOwner || stream.canMonitor) &&
              ["open", "planned"].includes(target.debt.status) && (
                <SmallButton
                  label="Plan recovery"
                  onClick={() =>
                    void submit(
                      {
                        mode: "debt_action",
                        debtId: target.debt?.id,
                        action: "plan",
                        note: notes[debtNoteKey] ?? "",
                        dueDate: dates[debtDateKey] ?? target.debt?.recoveryDueDate,
                      },
                      "debt-plan-" + target.id,
                    )
                  }
                />
              )}
            {target.debt.isOwner && target.debt.status === "planned" && (
              <SmallButton
                label="Start"
                onClick={() =>
                  void submit(
                    {
                      mode: "debt_action",
                      debtId: target.debt?.id,
                      action: "start",
                    },
                    "debt-start-" + target.id,
                  )
                }
              />
            )}
            {target.debt.isOwner &&
              ["planned", "in_progress"].includes(target.debt.status) && (
                <SmallButton
                  label="Submit evidence"
                  onClick={() =>
                    void submit(
                      {
                        mode: "debt_action",
                        debtId: target.debt?.id,
                        action: "submit_evidence",
                        note: notes[debtNoteKey] ?? "",
                        evidenceReference: refs[debtRefKey] ?? "",
                      },
                      "debt-submit-" + target.id,
                    )
                  }
                />
              )}
            {stream.canMonitor &&
              target.debt.status === "evidence_submitted" && (
                <SmallButton
                  label="Verify recovery"
                  onClick={() =>
                    void submit(
                      {
                        mode: "debt_action",
                        debtId: target.debt?.id,
                        action: "verify",
                      },
                      "debt-verify-" + target.id,
                    )
                  }
                />
              )}
          </div>

          {stream.canMonitor && target.debt.status !== "closed" && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-black text-amber-950">
                Ownership / escalation
              </summary>
              <select
                value={
                  selects[debtOwnerKey] ?? target.debt.recoveryOwnerAssignmentId
                }
                onChange={(event) =>
                  setSelect(debtOwnerKey, event.target.value)
                }
                className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs"
              >
                {workspace.teacherAssignments.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.displayName}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex gap-2">
                <SmallButton
                  label="Reassign recovery"
                  secondary
                  onClick={() =>
                    void submit(
                      {
                        mode: "reassign_debt",
                        debtId: target.debt?.id,
                        recoveryOwnerAssignmentId:
                          selects[debtOwnerKey] ??
                          target.debt?.recoveryOwnerAssignmentId,
                        note:
                          notes[debtNoteKey] ??
                          "Recovery ownership changed by academic monitoring authority.",
                      },
                      "debt-reassign-" + target.id,
                    )
                  }
                />
                <SmallButton
                  label="Escalate P2"
                  secondary
                  onClick={() =>
                    void submit(
                      {
                        mode: "escalate_debt",
                        debtId: target.debt?.id,
                        severity: "P2",
                        reason:
                          notes[debtNoteKey] ??
                          "Academic debt requires leadership visibility.",
                      },
                      "debt-escalate-" + target.id,
                    )
                  }
                />
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
