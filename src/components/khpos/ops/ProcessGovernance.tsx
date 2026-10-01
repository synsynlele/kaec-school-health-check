"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposOpsLibrary, KhposOpsProcess } from "@/lib/khpos/ops/library";

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
};

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

  const process = processes.find((item) => item.id === selected);
  const current = versions.find(
    (item) => item.process_id === selected && ["draft", "in_review"].includes(item.status),
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

    setPurpose(revision?.purpose ?? active?.purpose ?? "");
    setTrigger(revision?.trigger ?? active?.trigger ?? "");
    setSla(revision?.sla ?? active?.sla ?? "");
    setExpectedOutcome(revision?.expected_outcome ?? active?.expectedOutcome ?? "");
    setEffectiveDate(revision?.effective_date ?? active?.effectiveDate ?? "");
    setSections({
      inputs: (revision?.inputs ?? active?.inputs ?? []).join("\n"),
      steps: (revision?.steps ?? active?.steps ?? []).join("\n"),
      evidence: (revision?.evidence ?? active?.evidence ?? []).join("\n"),
      exception_conditions: (revision?.exception_conditions ?? active?.exceptionConditions ?? []).join("\n"),
      escalation: (revision?.escalation ?? active?.escalation ?? []).join("\n"),
      kpis: (revision?.kpis ?? active?.kpis ?? []).join("\n"),
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
          {processes.map((item) => (
            <option value={item.id} key={item.id}>
              {item.code} · {item.title} ({item.criticality})
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
