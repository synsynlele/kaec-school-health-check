"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleAlert,
  Compass,
  GraduationCap,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsWorldReadyDomain,
  KhposOpsWorldReadyRecord,
  KhposOpsWorldReadyWorkspace,
} from "@/lib/khpos/ops/worldready";

const DOMAIN_LABELS: Record<string, string> = {
  self_understanding: "Self Understanding",
  independent_learning: "Independent Learning",
  problem_solving_building: "Problem Solving & Building",
  communication: "Communication",
  collaboration: "Collaboration",
  leadership_service: "Leadership & Service",
  financial_capability: "Financial Capability",
  digital_responsibility: "Digital Responsibility",
  portfolio_capstone: "Portfolio & Capstone",
  transition_planning: "Transition Planning",
};

function readable(value: string | null | undefined) {
  return (value ?? "—").replaceAll("_", " ");
}

function statusClass(status: string) {
  if (["ready", "demonstrated", "verified", "closed"].includes(status))
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["ready_with_actions", "emerging", "evidence_submitted"].includes(status))
    return "border-amber-200 bg-amber-50 text-amber-900";
  if (["not_ready", "not_evidenced", "returned"].includes(status))
    return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

export function WorldReadyWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] = useState<KhposOpsWorldReadyWorkspace | null>(null);
  const [error, setError] = useState(supabase ? "" : "KHP-OS sign-in is not configured.");
  const [busy, setBusy] = useState<string | null>(null);
  const [learnerId, setLearnerId] = useState("");
  const [termId, setTermId] = useState("");
  const [ownerAssignmentId, setOwnerAssignmentId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [refs, setRefs] = useState<Record<string, string>>({});
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
      const accessToken = data.session?.access_token;
      if (!active) return;
      if (!accessToken) {
        setError("Your session has ended. Sign in again to continue.");
        return;
      }
      const response = await fetch("/api/khpos/ops/worldready/" + organisationId, {
        headers: { Authorization: "Bearer " + accessToken },
        cache: "no-store",
      });
      const body = (await response.json()) as {
        ok?: boolean;
        worldReady?: KhposOpsWorldReadyWorkspace;
        error?: string;
      };
      if (!active) return;
      if (!response.ok || !body.ok || !body.worldReady) {
        setError(body.error ?? "WorldReady could not be loaded.");
        return;
      }
      const next = body.worldReady;
      setWorkspace(next);
      setLearnerId((current) => current || next.learners[0]?.id || "");
      setTermId(
        (current) =>
          current ||
          next.terms.find((term) => term.status === "active")?.id ||
          next.terms[0]?.id ||
          "",
      );
      setOwnerAssignmentId(
        (current) =>
          current ||
          next.assignments.find((assignment) => assignment.isMine)?.id ||
          next.assignments[0]?.id ||
          "",
      );
      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  async function submit(payload: Record<string, unknown>, key: string) {
    const accessToken = await token();
    if (!accessToken) {
      setError("Your session has ended. Sign in again to continue.");
      return false;
    }
    setBusy(key);
    setError("");
    const response = await fetch("/api/khpos/ops/worldready/" + organisationId, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as {
      ok?: boolean;
      worldReady?: KhposOpsWorldReadyWorkspace;
      error?: string;
    };
    setBusy(null);
    if (!response.ok || !body.ok || !body.worldReady) {
      setError(body.error ?? "WorldReady operation could not be completed.");
      return false;
    }
    setWorkspace(body.worldReady);
    return true;
  }

  if (!workspace && !error) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-7 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <CircleAlert className="size-8 text-amber-600" />
        <h1 className="mt-4 text-2xl font-black">WorldReady unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">{error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <Link
          href={"/khpos/" + organisationId}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500"
        >
          <ArrowLeft className="size-3.5" />
          Command Centre
        </Link>
        <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-brand-600">
          Operations · O21
        </p>
        <h1 className="mt-1 text-3xl font-black text-slate-950">WorldReady Transition</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
          Verify what each SS3 learner can already demonstrate, define the next-step pathway,
          and keep remaining transition gaps owned. WorldReady is not an exam score and does not replace WAEC/NECO preparation.
        </p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Open records", workspace.summary.openRecords],
          ["Ready", workspace.summary.ready],
          ["Ready with actions", workspace.summary.readyWithActions],
          ["Not ready", workspace.summary.notReady],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              {String(label)}
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950">{String(value)}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-brand-100 bg-brand-50 p-5">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-700" />
          <div>
            <p className="text-sm font-black text-brand-950">WorldReady principle</p>
            <p className="mt-1 text-sm leading-6 text-brand-900">{workspace.principle}</p>
          </div>
        </div>
      </section>

      {workspace.canRecord && workspace.learners.length > 0 ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">
            Open SS3 transition profile
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <select
              value={learnerId}
              onChange={(event) => setLearnerId(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              {workspace.learners.map((learner) => (
                <option key={learner.id} value={learner.id}>
                  {learner.displayName} · {learner.classLabel}
                </option>
              ))}
            </select>
            <select
              value={termId}
              onChange={(event) => setTermId(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              {workspace.terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.sessionLabel} · {term.termName}
                </option>
              ))}
            </select>
            <select
              value={ownerAssignmentId}
              onChange={(event) => setOwnerAssignmentId(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              {workspace.assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.roleTitle}{assignment.isMine ? " · Me" : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() =>
              void submit(
                { mode: "create_record", learnerId, termId, ownerAssignmentId },
                "create-record",
              )
            }
            disabled={busy === "create-record"}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
          >
            {busy === "create-record" ? <Loader2 className="size-4 animate-spin" /> : <GraduationCap className="size-4" />}
            Open WorldReady record
          </button>
        </section>
      ) : null}

      {workspace.records.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <Compass className="mx-auto size-8 text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-500">
            No WorldReady records are visible yet.
          </p>
        </div>
      ) : (
        <section className="space-y-5">
          {workspace.records.map((record) => (
            <WorldReadyRecordCard
              key={record.id}
              record={record}
              workspace={workspace}
                notes={notes}
              refs={refs}
              selects={selects}
              dates={dates}
              setNote={(key, value) => setNotes((current) => ({ ...current, [key]: value }))}
              setRef={(key, value) => setRefs((current) => ({ ...current, [key]: value }))}
              setSelect={(key, value) => setSelects((current) => ({ ...current, [key]: value }))}
              setDate={(key, value) => setDates((current) => ({ ...current, [key]: value }))}
              submit={submit}
            />
          ))}
        </section>
      )}
    </main>
  );
}

function WorldReadyRecordCard({
  record,
  workspace,
  notes,
  refs,
  selects,
  dates,
  setNote,
  setRef,
  setSelect,
  setDate,
  submit,
}: {
  record: KhposOpsWorldReadyRecord;
  workspace: KhposOpsWorldReadyWorkspace;
  notes: Record<string, string>;
  refs: Record<string, string>;
  selects: Record<string, string>;
  dates: Record<string, string>;
  setNote: (key: string, value: string) => void;
  setRef: (key: string, value: string) => void;
  setSelect: (key: string, value: string) => void;
  setDate: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const pathKey = "path-" + record.id;
  const pathSummaryKey = "path-summary-" + record.id;
  const reviewSummaryKey = "review-summary-" + record.id;
  const reviewNoteKey = "review-note-" + record.id;
  const outcomeKey = "outcome-" + record.id;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-black text-slate-500">{record.reference}</span>
            <span className={"rounded-full border px-2.5 py-1 text-[11px] font-black capitalize " + statusClass(record.status)}>
              {readable(record.status)}
            </span>
            {record.readinessOutcome ? (
              <span className={"rounded-full border px-2.5 py-1 text-[11px] font-black capitalize " + statusClass(record.readinessOutcome)}>
                {readable(record.readinessOutcome)}
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 text-xl font-black text-slate-950">
            {record.learnerName} · {record.classLabel}
          </h2>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Personal Project: {record.hasCompletedPersonalProject ? "Complete" : "Not yet complete"} ·
            Verified portfolio: {record.hasVerifiedPortfolio ? "Yes" : "No"}
          </p>
        </div>
      </div>

      {(record.isOwner || record.canManage) && ["draft", "ready_with_actions", "not_ready"].includes(record.status) ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Transition pathway</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <select
              value={selects[pathKey] ?? record.transitionPathway ?? "undecided"}
              onChange={(event) => setSelect(pathKey, event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="higher_education">Higher education</option>
              <option value="entrepreneurship">Entrepreneurship</option>
              <option value="employment">Employment</option>
              <option value="apprenticeship_vocational">Apprenticeship / vocational</option>
              <option value="service_gap_year">Service / gap year</option>
              <option value="undecided">Undecided / exploring</option>
            </select>
            <input
              value={refs[pathKey] ?? record.pathwayReference ?? ""}
              onChange={(event) => setRef(pathKey, event.target.value)}
              placeholder="Optional pathway reference"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <textarea
              value={notes[pathSummaryKey] ?? record.pathwaySummary ?? ""}
              onChange={(event) => setNote(pathSummaryKey, event.target.value)}
              placeholder="What is the learner's current next-step plan?"
              rows={2}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-2"
            />
          </div>
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "set_pathway",
                  recordId: record.id,
                  transitionPathway: selects[pathKey] ?? record.transitionPathway ?? "undecided",
                  pathwaySummary: notes[pathSummaryKey] ?? record.pathwaySummary ?? "",
                  pathwayReference: refs[pathKey] ?? record.pathwayReference,
                  portfolioReference: record.portfolioReference,
                  humanPotentialRecordReference: record.humanPotentialRecordReference,
                },
                "pathway-" + record.id,
              )
            }
            className="mt-2 rounded-xl bg-brand-700 px-3 py-2 text-xs font-black text-white"
          >
            Save pathway
          </button>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {record.domains.map((domain) => (
          <DomainCard
            key={domain.id}
            record={record}
            domain={domain}
            workspace={workspace}
            notes={notes}
            refs={refs}
            selects={selects}
            dates={dates}
            setNote={setNote}
            setRef={setRef}
            setSelect={setSelect}
            setDate={setDate}
            submit={submit}
          />
        ))}
      </div>

      {record.actions.length > 0 ? (
        <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Transition actions</p>
          {record.actions.map((action) => {
            const noteKey = "action-note-" + action.id;
            const refKey = "action-ref-" + action.id;
            return (
              <div key={action.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="text-sm font-black">{action.title}</p>
                    <p className="mt-1 text-xs text-slate-600">{action.expectedChange}</p>
                  </div>
                  <span className={"rounded-full border px-2.5 py-1 text-[11px] font-black capitalize " + statusClass(action.status)}>
                    {readable(action.status)}
                  </span>
                </div>
                {action.isOwner && ["open", "in_progress"].includes(action.status) ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <input
                      value={notes[noteKey] ?? ""}
                      onChange={(event) => setNote(noteKey, event.target.value)}
                      placeholder="Completion note"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                    <input
                      value={refs[refKey] ?? ""}
                      onChange={(event) => setRef(refKey, event.target.value)}
                      placeholder="Evidence reference"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void submit(
                          {
                            mode: "action_action",
                            actionId: action.id,
                            action: "submit_evidence",
                            note: notes[noteKey] ?? "",
                            evidenceReference: refs[refKey] ?? "",
                          },
                          "action-submit-" + action.id,
                        )
                      }
                      className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white"
                    >
                      Submit evidence
                    </button>
                  </div>
                ) : null}
                {action.canVerify && action.status === "evidence_submitted" ? (
                  <button
                    type="button"
                    onClick={() =>
                      void submit(
                        { mode: "action_action", actionId: action.id, action: "verify" },
                        "action-verify-" + action.id,
                      )
                    }
                    className="mt-3 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white"
                  >
                    Verify action
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {(record.isOwner || record.canManage) && ["draft", "ready_with_actions", "not_ready"].includes(record.status) ? (
          <button
            type="button"
            onClick={() =>
              void submit({ mode: "submit_review", recordId: record.id }, "submit-review-" + record.id)
            }
            className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white"
          >
            Submit final review
          </button>
        ) : null}

        {record.canManage && record.status === "in_review" ? (
          <div className="w-full rounded-2xl border border-brand-200 bg-brand-50 p-4">
            <p className="text-sm font-black text-brand-950">Final readiness decision</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <select
                value={selects[outcomeKey] ?? "ready_with_actions"}
                onChange={(event) => setSelect(outcomeKey, event.target.value)}
                className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm"
              >
                <option value="ready">Ready</option>
                <option value="ready_with_actions">Ready with actions</option>
                <option value="not_ready">Not ready</option>
              </select>
              <input
                value={notes[reviewSummaryKey] ?? ""}
                onChange={(event) => setNote(reviewSummaryKey, event.target.value)}
                placeholder="Readiness summary"
                className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm"
              />
              <input
                value={notes[reviewNoteKey] ?? ""}
                onChange={(event) => setNote(reviewNoteKey, event.target.value)}
                placeholder="Reasoned review note"
                className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "decide",
                    recordId: record.id,
                    outcome: selects[outcomeKey] ?? "ready_with_actions",
                    readinessSummary: notes[reviewSummaryKey] ?? "",
                    reviewNote: notes[reviewNoteKey] ?? "",
                  },
                  "decide-" + record.id,
                )
              }
              className="mt-2 rounded-xl bg-brand-700 px-4 py-2 text-xs font-black text-white"
            >
              Record decision
            </button>
          </div>
        ) : null}

        {record.canManage && ["ready", "ready_with_actions", "not_ready"].includes(record.status) ? (
          <>
            {["ready_with_actions", "not_ready"].includes(record.status) ? (
              <button
                type="button"
                onClick={() =>
                  void submit(
                    { mode: "record_action", recordId: record.id, action: "reopen", note: "Reopened for updated readiness evidence." },
                    "reopen-" + record.id,
                  )
                }
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-black text-slate-700"
              >
                Reopen
              </button>
            ) : null}
            <button
              type="button"
              onClick={() =>
                void submit(
                  { mode: "record_action", recordId: record.id, action: "close", note: "WorldReady transition record closed." },
                  "close-" + record.id,
                )
              }
              className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white"
            >
              Close record
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

function DomainCard({
  record,
  domain,
  workspace,
  notes,
  refs,
  selects,
  dates,
  setNote,
  setRef,
  setSelect,
  setDate,
  submit,
}: {
  record: KhposOpsWorldReadyRecord;
  domain: KhposOpsWorldReadyDomain;
  workspace: KhposOpsWorldReadyWorkspace;
  busy: string | null;
  notes: Record<string, string>;
  refs: Record<string, string>;
  selects: Record<string, string>;
  dates: Record<string, string>;
  setNote: (key: string, value: string) => void;
  setRef: (key: string, value: string) => void;
  setSelect: (key: string, value: string) => void;
  setDate: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const titleKey = "ev-title-" + domain.id;
  const noteKey = "ev-note-" + domain.id;
  const refKey = "ev-ref-" + domain.id;
  const reviewStateKey = "dom-state-" + domain.id;
  const reviewNoteKey = "dom-note-" + domain.id;
  const summaryKey = "dom-summary-" + domain.id;
  const actionTitleKey = "gap-title-" + domain.id;
  const actionChangeKey = "gap-change-" + domain.id;
  const actionOwnerKey = "gap-owner-" + domain.id;
  const actionDateKey = "gap-date-" + domain.id;

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">{DOMAIN_LABELS[domain.domainCode] ?? readable(domain.domainCode)}</p>
          {domain.evidenceSummary ? <p className="mt-1 text-xs leading-5 text-slate-600">{domain.evidenceSummary}</p> : null}
        </div>
        <span className={"rounded-full border px-2.5 py-1 text-[11px] font-black capitalize " + statusClass(domain.status)}>
          {readable(domain.status)}
        </span>
      </div>

      {domain.evidence.map((evidence) => (
        <div key={evidence.id} className="mt-2 rounded-xl bg-slate-50 p-3">
          <div className="flex flex-wrap justify-between gap-2">
            <p className="text-xs font-black">{evidence.title}</p>
            <span className={"rounded-full border px-2 py-0.5 text-[10px] font-black capitalize " + statusClass(evidence.status)}>
              {readable(evidence.status)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600">{evidence.evidenceNote}</p>
          {record.canManage && evidence.status === "submitted" ? (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  void submit(
                    { mode: "evidence_action", evidenceId: evidence.id, action: "verify", note: "Evidence independently verified." },
                    "verify-evidence-" + evidence.id,
                  )
                }
                className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-[11px] font-black text-white"
              >
                Verify
              </button>
              <button
                type="button"
                onClick={() =>
                  void submit(
                    { mode: "evidence_action", evidenceId: evidence.id, action: "return", note: "Evidence needs clarification." },
                    "return-evidence-" + evidence.id,
                  )
                }
                className="rounded-lg border border-amber-300 px-2.5 py-1.5 text-[11px] font-black text-amber-900"
              >
                Return
              </button>
            </div>
          ) : null}
        </div>
      ))}

      {workspace.canRecord && ["draft", "ready_with_actions", "not_ready"].includes(record.status) ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-black text-brand-700">Add evidence</summary>
          <div className="mt-2 space-y-2">
            <input value={refs[titleKey] ?? ""} onChange={(event) => setRef(titleKey, event.target.value)} placeholder="Evidence title" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" />
            <textarea value={notes[noteKey] ?? ""} onChange={(event) => setNote(noteKey, event.target.value)} placeholder="Specific evidence note" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" />
            <input value={refs[refKey] ?? ""} onChange={(event) => setRef(refKey, event.target.value)} placeholder="Evidence reference" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" />
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "add_evidence",
                    recordId: record.id,
                    domainCode: domain.domainCode,
                    evidenceType: "other",
                    title: refs[titleKey] ?? "",
                    evidenceNote: notes[noteKey] ?? "",
                    evidenceReference: refs[refKey] ?? "",
                  },
                  "add-evidence-" + domain.id,
                )
              }
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white"
            >
              Add evidence
            </button>
          </div>
        </details>
      ) : null}

      {record.canManage && ["draft", "ready_with_actions", "not_ready"].includes(record.status) ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-black text-violet-700">Review domain</summary>
          <div className="mt-2 space-y-2">
            <select value={selects[reviewStateKey] ?? domain.status} onChange={(event) => setSelect(reviewStateKey, event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs">
              <option value="not_evidenced">Not evidenced</option>
              <option value="emerging">Emerging</option>
              <option value="demonstrated">Demonstrated</option>
            </select>
            <input value={notes[reviewNoteKey] ?? ""} onChange={(event) => setNote(reviewNoteKey, event.target.value)} placeholder="Review note" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" />
            <textarea value={notes[summaryKey] ?? ""} onChange={(event) => setNote(summaryKey, event.target.value)} placeholder="Evidence summary" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" />
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "review_domain",
                    recordId: record.id,
                    domainCode: domain.domainCode,
                    status: selects[reviewStateKey] ?? domain.status,
                    reviewNote: notes[reviewNoteKey] ?? "",
                    evidenceSummary: notes[summaryKey] ?? "",
                  },
                  "review-domain-" + domain.id,
                )
              }
              className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-black text-white"
            >
              Save domain review
            </button>
          </div>
        </details>
      ) : null}

      {record.canManage && domain.status !== "demonstrated" && ["draft", "ready_with_actions", "not_ready"].includes(record.status) ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-black text-amber-800">Create transition action</summary>
          <div className="mt-2 space-y-2">
            <input value={refs[actionTitleKey] ?? ""} onChange={(event) => setRef(actionTitleKey, event.target.value)} placeholder="Action title" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" />
            <textarea value={notes[actionChangeKey] ?? ""} onChange={(event) => setNote(actionChangeKey, event.target.value)} placeholder="Expected change" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" />
            <select value={selects[actionOwnerKey] ?? ""} onChange={(event) => setSelect(actionOwnerKey, event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs">
              <option value="">Choose owner</option>
              {workspace.assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>{assignment.roleTitle}{assignment.isMine ? " · Me" : ""}</option>
              ))}
            </select>
            <input type="date" value={dates[actionDateKey] ?? ""} onChange={(event) => setDate(actionDateKey, event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" />
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "create_action",
                    recordId: record.id,
                    domainCode: domain.domainCode,
                    title: refs[actionTitleKey] ?? "",
                    expectedChange: notes[actionChangeKey] ?? "",
                    ownerAssignmentId: selects[actionOwnerKey] ?? "",
                    dueDate: dates[actionDateKey] ?? "",
                  },
                  "create-action-" + domain.id,
                )
              }
              className="rounded-lg bg-amber-800 px-3 py-2 text-xs font-black text-white"
            >
              Create action
            </button>
          </div>
        </details>
      ) : null}
    </div>
  );
}
