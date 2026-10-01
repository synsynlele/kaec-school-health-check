"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposOpsLibrary, KhposOpsPolicy } from "@/lib/khpos/ops/library";
import type { PolicyBaseline } from "@/lib/khpos/ops/baselines";

type Revision = {
  id: string; policy_id: string; version: number; status: string;
  purpose: string; scope: string; effective_date: string | null; review_date: string | null;
  author_id: string | null; review_note: string | null;
  draft_source?: "human" | "ai_starter" | "kaec_baseline";
  draft_model?: string | null;
  principles: string[]; policy_statements: string[]; roles_responsibilities: string[];
  rules: string[]; exceptions: string[]; escalation: string[]; records_evidence: string[];
};
type Field = "principles" | "policy_statements" | "roles_responsibilities" | "rules" | "exceptions" | "escalation" | "records_evidence";
function dateForSchool(yearOffset = 0) {
  const date = new Date();
  date.setFullYear(date.getFullYear() + yearOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const fields: { key: Field; label: string; api: string }[] = [
  { key: "principles", label: "Principles", api: "principles" },
  { key: "policy_statements", label: "Policy statements", api: "policyStatements" },
  { key: "roles_responsibilities", label: "Roles and responsibilities", api: "rolesResponsibilities" },
  { key: "rules", label: "Rules and requirements", api: "rules" },
  { key: "exceptions", label: "Exceptions", api: "exceptions" },
  { key: "escalation", label: "Escalation", api: "escalation" },
  { key: "records_evidence", label: "Records and evidence", api: "recordsEvidence" },
];

export function PolicyGovernance({ organisationId, policies, onPublished }: {
  organisationId: string; policies: KhposOpsPolicy[]; onPublished: (library: KhposOpsLibrary) => void;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [versions, setVersions] = useState<Revision[]>([]);
  const [baselines, setBaselines] = useState<Record<string, PolicyBaseline>>({});
  const [userId, setUserId] = useState("");
  const [selected, setSelected] = useState("");
  const [purpose, setPurpose] = useState("");
  const [scope, setScope] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [sections, setSections] = useState<Record<Field, string>>({
    principles: "", policy_statements: "", roles_responsibilities: "", rules: "",
    exceptions: "", escalation: "", records_evidence: "",
  });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [baselineLoaded, setBaselineLoaded] = useState(false);
  const policy = policies.find((item) => item.id === selected);
  const current = versions.find((item) => item.policy_id === selected && ["draft", "in_review"].includes(item.status));
  const policyOptions = useMemo(
    () =>
      policies
        .map((item) => {
          const revision = versions.find(
            (version) =>
              version.policy_id === item.id &&
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
                  : state === "MISSING" && item.priority === "C0"
                    ? 3
                    : state === "MISSING"
                      ? 4
                      : 5;
          return { item, state, rank };
        })
        .sort(
          (a, b) =>
            a.rank - b.rank ||
            a.item.priority.localeCompare(b.item.priority) ||
            a.item.code.localeCompare(b.item.code),
        ),
    [policies, versions, userId],
  );

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const response = await fetch(`/api/khpos/ops/library/${organisationId}/governance`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store",
      });
      const body = await response.json();
      if (alive) {
        if (response.ok) { setVersions(body.versions ?? []); setBaselines(body.baselines ?? {}); setUserId(data.session.user.id); }
        else setError(body.error ?? "Policy revisions could not be loaded.");
      }
    }).catch(() => { if (alive) setError("Policy revisions could not be loaded."); });
    return () => { alive = false; };
  }, [organisationId, supabase]);

  function choose(id: string) {
    setSelected(id); setError(""); setMessage("");
    const revision = versions.find((item) => item.policy_id === id && ["draft", "in_review"].includes(item.status));
    const active = policies.find((item) => item.id === id)?.activeVersion;
    const baseline = baselines[id];
    const source = revision ?? active;
    const useBaseline = !source && Boolean(baseline);
    setBaselineLoaded(useBaseline);
    setPurpose(source?.purpose ?? baseline?.purpose ?? "");
    setScope(source?.scope ?? baseline?.scope ?? "");
    setEffectiveDate(revision?.effective_date ?? active?.effectiveDate ?? (useBaseline ? dateForSchool() : ""));
    setReviewDate(revision?.review_date ?? active?.reviewDate ?? (useBaseline ? dateForSchool(1) : ""));
    setSections({
      principles: (source?.principles ?? baseline?.principles ?? []).join("\n"),
      policy_statements: (revision?.policy_statements ?? active?.policyStatements ?? baseline?.policyStatements ?? []).join("\n"),
      roles_responsibilities: (revision?.roles_responsibilities ?? active?.rolesResponsibilities ?? baseline?.rolesResponsibilities ?? []).join("\n"),
      rules: (source?.rules ?? baseline?.rules ?? []).join("\n"),
      exceptions: (source?.exceptions ?? baseline?.exceptions ?? []).join("\n"),
      escalation: (source?.escalation ?? baseline?.escalation ?? []).join("\n"),
      records_evidence: (revision?.records_evidence ?? active?.recordsEvidence ?? baseline?.recordsEvidence ?? []).join("\n"),
    });
  }

  async function act(action: "save" | "submit" | "return" | "approve") {
    if (!supabase || !policy || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Your session ended. Sign in again.");
      const input = action === "save" ? {
        ...(current ? { versionId: current.id } : {}), purpose, scope, effectiveDate, reviewDate,
        ...Object.fromEntries(fields.map(({ key, api }) => [api, sections[key].split("\n").map((s) => s.trim()).filter(Boolean)])),
      } : { versionId: current?.id, note };
      const response = await fetch(`/api/khpos/ops/library/${organisationId}/governance`, {
        method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ policyId: policy.id, action, input }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Policy action failed.");
      setVersions(body.versions ?? []);
      setBaselines(body.baselines ?? baselines);
      setBaselineLoaded(false);
      if (body.library) onPublished(body.library);
      setMessage(action === "approve" ? "Approved and published. Staff acknowledgement now applies to this version." :
        action === "submit" ? "Submitted for independent review." : action === "return" ? "Returned to the author with your note." : "Draft saved.");
      setNote("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Policy action failed."); }
    finally { setBusy(false); }
  }

  return <section className="rounded-3xl border border-brand-200 bg-white p-5 shadow-sm sm:p-7">
    <h3 className="text-xl font-black">Policy drafting and approval</h3>
    <p className="mt-2 text-sm text-slate-600">School leaders draft. A different leader reviews. Critical policies require the Custodian; other policies may be approved by the Guardian or Custodian. Approval takes effect immediately, so use today or an earlier effective date.</p>
    <label className="mt-5 block text-sm font-bold">Policy to work on
      <select className="mt-2 w-full rounded-xl border p-3" value={selected} onChange={(event) => choose(event.target.value)}>
        <option value="">Select a registered policy</option>
        {policyOptions.map(({ item, state }) => <option value={item.id} key={item.id}>[{state}] {item.code} · {item.name} ({item.priority})</option>)}
      </select>
    </label>
    {policy && <div className="mt-5 space-y-4">
      <p className="text-sm font-semibold">{current ? `Revision v${current.version}: ${current.status.replaceAll("_", " ")}` : "Start a new school revision"}</p>
      {baselineLoaded && <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-slate-700">
        <p className="font-bold text-brand-900">KAEC baseline loaded</p>
        <p className="mt-1">This registered policy did not yet have a school-owned version. Review and customise this baseline for your school before saving; it does not become policy until a different authorised leader approves it.</p>
      </div>}
      {current?.draft_source === "kaec_baseline" && <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-slate-700">
        <p className="font-bold text-brand-900">KAEC baseline draft</p>
        <p className="mt-1">KHP-OS prepared this starting point from the controlled KAEC baseline. The named author must review and customise it; a different authorised leader must still approve it.</p>
      </div>}
      {current?.draft_source === "ai_starter" && <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-slate-700">
        <p className="font-bold text-violet-900">AI-assisted starter draft</p>
        <p className="mt-1">Human editing and independent approval remain mandatory.</p>
      </div>}
      {current?.review_note && <p className="rounded-xl bg-amber-50 p-3 text-sm">Review note: {current.review_note}</p>}
      {(!current || (current.status === "draft" && current.author_id === userId)) && <div className="space-y-4">
        <label className="block text-sm font-bold">Purpose<textarea className="mt-1 w-full rounded-xl border p-3" rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></label>
        <label className="block text-sm font-bold">Scope<textarea className="mt-1 w-full rounded-xl border p-3" rows={3} value={scope} onChange={(e) => setScope(e.target.value)} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">Effective date<input type="date" className="mt-1 w-full rounded-xl border p-3" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} /></label>
          <label className="text-sm font-bold">Review date<input type="date" className="mt-1 w-full rounded-xl border p-3" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} /></label>
        </div>
        {fields.map(({ key, label }) => <label key={key} className="block text-sm font-bold">{label} <span className="font-normal text-slate-500">(one statement per line)</span>
          <textarea className="mt-1 w-full rounded-xl border p-3" rows={3} value={sections[key]} onChange={(e) => setSections({ ...sections, [key]: e.target.value })} />
        </label>)}
        <button type="button" disabled={busy} onClick={() => void act("save")} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Save draft</button>
        {current && <button type="button" disabled={busy} onClick={() => void act("submit")} className="ml-2 rounded-full bg-brand-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Submit for review</button>}
      </div>}
      {current?.status === "in_review" && current.author_id !== userId && <div className="space-y-3 rounded-xl border border-amber-200 p-4">
        <p className="text-sm">Review the full draft above or in the fields below before approving. The author cannot approve their own version.</p>
        <div className="space-y-2 text-sm"><p><b>Purpose:</b> {current.purpose}</p><p><b>Scope:</b> {current.scope}</p>
          {fields.map(({ key, label }) => <div key={key}><b>{label}:</b><ul className="list-disc pl-5">{current[key].map((line, index) => <li key={index}>{line}</li>)}</ul></div>)}
          <p><b>Effective:</b> {current.effective_date} · <b>Review:</b> {current.review_date}</p></div>
        <label className="block text-sm font-bold">Review note<textarea className="mt-1 w-full rounded-xl border p-3" value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <button type="button" disabled={busy || !note.trim()} onClick={() => void act("return")} className="rounded-full border px-5 py-3 text-sm font-bold disabled:opacity-50">Return with reason</button>
        <button type="button" disabled={busy} onClick={() => void act("approve")} className="ml-2 rounded-full bg-brand-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Approve and publish</button>
      </div>}
    </div>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-4 text-sm text-emerald-800">{message}</p>}
  </section>;
}
