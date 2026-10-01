"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposOpsLibrary, KhposOpsProcess } from "@/lib/khpos/ops/library";
import type { ProcessBaseline } from "@/lib/khpos/ops/baselines";

type Revision = {
  id: string;
  process_id: string;
  version: number;
  purpose: string;
  trigger: string;
  inputs: string[];
  steps: string[];
  sla: string | null;
  evidence: string[];
  expected_outcome: string;
  exception_conditions: string[];
  escalation: string[];
  kpis: string[];
  effective_date: string | null;
  status: string;
  author_id: string | null;
  review_note: string | null;
  draft_source?: "human" | "ai_starter" | "kaec_baseline";
  draft_model?: string | null;
};

function dateForSchool() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type ArrayField = "inputs" | "steps" | "evidence" | "exception_conditions" | "escalation" | "kpis";

const fields: { key: ArrayField; label: string; api: string }[] = [
  { key: "inputs", label: "Inputs / prerequisites", api: "inputs" },
  { key: "steps", label: "Execution steps", api: "steps" },
  { key: "evidence", label: "Required evidence", api: "evidence" },
  { key: "exception_conditions", label: "Exception conditions", api: "exceptionConditions" },
  { key: "escalation", label: "Escalation", api: "escalation" },
  { key: "kpis", label: "KPIs / success checks", api: "kpis" },
];

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

export function ProcessGovernance({
  organisationId,
  processes,
  onPublished,
}: {
  organisationId: string;
  processes: KhposOpsProcess[];
  onPublished: (library: KhposOpsLibrary) => void;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [versions, setVersions] = useState<Revision[]>([]);
  const [baselines, setBaselines] = useState<Record<string, ProcessBaseline>>({});
  const [userId, setUserId] = useState("");
  const [selected, setSelected] = useState("");
  const [purpose, setPurpose] = useState("");
  const [trigger, setTrigger] = useState("");
  const [sla, setSla] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [sections, setSections] = useState<Record<ArrayField, string>>({
    inputs: "",
    steps: "",
    evidence: "",
    exception_conditions: "",
    escalation: "",
    kpis: "",
  });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [baselineLoaded, setBaselineLoaded] = useState(false);

  const process = processes.find((item) => item.id === selected);
  const current = versions.find(
    (item) => item.process_id === selected && ["draft", "in_review"].includes(item.status),
  );
  const processOptions = useMemo(
    () =>
      processes
        .map((item) => {
          const revision = versions.find(
            (version) =>
              version.process_id === item.id &&
              ["draft", "in_review"].includes(version.status),
          );
          const state =
            revision?.status === "in_review" && revision.author_id !== userId
              ? "REVIEW"
              : revision?.status === "draft" && revision.author_id === userId
                ? "YOUR DRAFT"
                : revision?.status === "in_review"
                  ? "IN REVIEW"
                  : !item.activeVersion
                    ? "MISSING"
                    : "ACTIVE";
          const rank =
            state === "REVIEW"
              ? 0
              : state === "YOUR DRAFT"
                ? 1
                : state === "IN REVIEW"
                  ? 2
                  : state === "MISSING" && item.criticality === "P0"
                    ? 3
                    : state === "MISSING"
                      ? 4
                      : 5;
          return { item, state, rank };
        })
        .sort(
          (a, b) =>
            a.rank - b.rank ||
            a.item.criticality.localeCompare(b.item.criticality) ||
            a.item.code.localeCompare(b.item.code),
        ),
    [processes, versions, userId],
  );

  useEffect(() => {
    if (!supabase) return;
    let alive = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const response = await fetch(
        `/api/khpos/ops/library/${organisationId}/process-governance`,
        {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          cache: "no-store",
        },
      );
      const body = await response.json();
      if (!alive) return;
      if (response.ok) {
        setVersions(body.versions ?? []);
        setBaselines(body.baselines ?? {});
        setUserId(data.session.user.id);
      } else {
        setError(body.error ?? "Process revisions could not be loaded.");
      }
    }).catch(() => {
      if (alive) setError("Process revisions could not be loaded.");
    });

    return () => {
      alive = false;
    };
  }, [organisationId, supabase]);

  function choose(id: string) {
    setSelected(id);
    setError("");
    setMessage("");

    const revision = versions.find(
      (item) => item.process_id === id && ["draft", "in_review"].includes(item.status),
    );
    const active = processes.find((item) => item.id === id)?.activeVersion;
    const baseline = baselines[id];
    const source = revision ?? active;
    const useBaseline = !source && Boolean(baseline);

    setBaselineLoaded(useBaseline);
    setPurpose(revision?.purpose ?? active?.purpose ?? baseline?.purpose ?? "");
    setTrigger(revision?.trigger ?? active?.trigger ?? baseline?.trigger ?? "");
    setSla(revision?.sla ?? active?.sla ?? baseline?.sla ?? "");
    setExpectedOutcome(
      revision?.expected_outcome ??
        active?.expectedOutcome ??
        baseline?.expectedOutcome ??
        "",
    );
    setEffectiveDate(
      revision?.effective_date ??
        active?.effectiveDate ??
        (useBaseline ? dateForSchool() : ""),
    );
    setSections({
      inputs: (revision?.inputs ?? active?.inputs ?? baseline?.inputs ?? []).join("\n"),
      steps: (revision?.steps ?? active?.steps ?? baseline?.steps ?? []).join("\n"),
      evidence: (revision?.evidence ?? active?.evidence ?? baseline?.evidence ?? []).join("\n"),
      exception_conditions: (
        revision?.exception_conditions ??
        active?.exceptionConditions ??
        baseline?.exceptionConditions ??
        []
      ).join("\n"),
      escalation: (revision?.escalation ?? active?.escalation ?? baseline?.escalation ?? []).join("\n"),
      kpis: (revision?.kpis ?? active?.kpis ?? baseline?.kpis ?? []).join("\n"),
    });
  }

  async function act(action: "save" | "submit" | "return" | "approve") {
    if (!supabase || !process || busy) return;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Your session ended. Sign in again.");

      const input = action === "save"
        ? {
            ...(current ? { versionId: current.id } : {}),
            purpose,
            trigger,
            sla,
            expectedOutcome,
            effectiveDate,
            ...Object.fromEntries(fields.map(({ key, api }) => [api, lines(sections[key])])),
          }
        : { versionId: current?.id, note };

      const response = await fetch(
        `/api/khpos/ops/library/${organisationId}/process-governance`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ processId: process.id, action, input }),
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Process action failed.");

      setVersions(body.versions ?? []);
      setBaselines(body.baselines ?? baselines);
      setBaselineLoaded(false);
      if (body.library) onPublished(body.library);
      setMessage(
        action === "approve"
          ? "Approved and published. This is now the school’s controlled process."
          : action === "submit"
            ? "Submitted for independent review."
            : action === "return"
              ? "Returned to the author with your note."
              : "Draft saved.",
      );
      setNote("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Process action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-brand-200 bg-white p-5 shadow-sm sm:p-7">
      <h3 className="text-xl font-black">Process drafting and approval</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Leaders turn registered processes into school-owned operating procedures. A different leader
        must review the draft. P0 processes require Custodian-level approval, and no process can be
        published until every governing policy listed for it is already active.
      </p>

      <label className="mt-5 block text-sm font-bold">
        Process to work on
        <select
          className="mt-2 w-full rounded-xl border p-3"
          value={selected}
          onChange={(event) => choose(event.target.value)}
        >
          <option value="">Select a registered process</option>
          {processOptions.map(({ item, state }) => (
            <option value={item.id} key={item.id}>
              [{state}] {item.code} · {item.title} ({item.criticality})
            </option>
          ))}
        </select>
      </label>

      {process && (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p><b>Owner:</b> {process.ownerLabel}</p>
            <p className="mt-1">
              <b>Governing policies:</b>{" "}
              {process.governingPolicyCodes.length
                ? process.governingPolicyCodes.join(", ")
                : "No policy dependency registered"}
            </p>
          </div>

          <p className="text-sm font-semibold">
            {current
              ? `Revision v${current.version}: ${current.status.replaceAll("_", " ")}`
              : "Start a new school revision"}
          </p>

          {baselineLoaded && (
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-slate-700">
              <p className="font-bold text-brand-900">KAEC baseline loaded</p>
              <p className="mt-1">
                This registered process did not yet have a school-owned procedure. Review and customise the baseline before saving. It remains a draft until a different authorised leader approves it, and governing policies must be active first.
              </p>
            </div>
          )}

          {current?.draft_source === "kaec_baseline" && (
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-slate-700">
              <p className="font-bold text-brand-900">KAEC baseline draft</p>
              <p className="mt-1">
                KHP-OS prepared this starting procedure from the controlled KAEC baseline. The named author must review and customise it; a different authorised leader must still approve it.
              </p>
            </div>
          )}

          {current?.draft_source === "ai_starter" && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-slate-700">
              <p className="font-bold text-violet-900">AI-assisted starter draft</p>
              <p className="mt-1">Human editing and independent approval remain mandatory.</p>
            </div>
          )}

          {current?.review_note && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm">
              Review note: {current.review_note}
            </p>
          )}

          {(!current || (current.status === "draft" && current.author_id === userId)) && (
            <div className="space-y-4">
              <label className="block text-sm font-bold">
                Purpose
                <textarea
                  className="mt-1 w-full rounded-xl border p-3"
                  rows={3}
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                />
              </label>

              <label className="block text-sm font-bold">
                Trigger — when this process starts
                <textarea
                  className="mt-1 w-full rounded-xl border p-3"
                  rows={2}
                  value={trigger}
                  onChange={(event) => setTrigger(event.target.value)}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  Service level / timing
                  <input
                    className="mt-1 w-full rounded-xl border p-3"
                    value={sla}
                    onChange={(event) => setSla(event.target.value)}
                    placeholder="e.g. Same day, within 48 hours"
                  />
                </label>
                <label className="text-sm font-bold">
                  Effective date
                  <input
                    type="date"
                    className="mt-1 w-full rounded-xl border p-3"
                    value={effectiveDate}
                    onChange={(event) => setEffectiveDate(event.target.value)}
                  />
                </label>
              </div>

              <label className="block text-sm font-bold">
                Expected outcome
                <textarea
                  className="mt-1 w-full rounded-xl border p-3"
                  rows={2}
                  value={expectedOutcome}
                  onChange={(event) => setExpectedOutcome(event.target.value)}
                />
              </label>

              {fields.map(({ key, label }) => (
                <label key={key} className="block text-sm font-bold">
                  {label}{" "}
                  <span className="font-normal text-slate-500">(one statement per line)</span>
                  <textarea
                    className="mt-1 w-full rounded-xl border p-3"
                    rows={key === "steps" ? 6 : 3}
                    value={sections[key]}
                    onChange={(event) =>
                      setSections((previous) => ({ ...previous, [key]: event.target.value }))
                    }
                  />
                </label>
              ))}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act("save")}
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  Save draft
                </button>
                {current && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act("submit")}
                    className="rounded-full bg-brand-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Submit for review
                  </button>
                )}
              </div>
            </div>
          )}

          {current?.status === "in_review" && current.author_id !== userId && (
            <div className="space-y-3 rounded-xl border border-amber-200 p-4">
              <p className="text-sm">
                Review the complete frozen draft below. The author cannot approve their own revision.
              </p>
              <div className="space-y-2 text-sm">
                <p><b>Purpose:</b> {current.purpose}</p>
                <p><b>Trigger:</b> {current.trigger}</p>
                <p><b>Expected outcome:</b> {current.expected_outcome}</p>
                <p><b>SLA:</b> {current.sla || "Not specified"}</p>
                {fields.map(({ key, label }) => (
                  <div key={key}>
                    <b>{label}:</b>
                    <ul className="list-disc pl-5">
                      {current[key].map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                  </div>
                ))}
                <p><b>Effective:</b> {current.effective_date}</p>
              </div>

              <label className="block text-sm font-bold">
                Review note
                <textarea
                  className="mt-1 w-full rounded-xl border p-3"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !note.trim()}
                  onClick={() => void act("return")}
                  className="rounded-full border px-5 py-3 text-sm font-bold disabled:opacity-50"
                >
                  Return with reason
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act("approve")}
                  className="rounded-full bg-brand-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  Approve and publish
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-4 text-sm text-emerald-800">{message}</p>}
    </section>
  );
}
