"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposOpsLibrary, KhposOpsPolicy } from "@/lib/khpos/ops/library";

type Revision = {
  id: string; policy_id: string; version: number; status: string;
  purpose: string; scope: string; effective_date: string | null; review_date: string | null;
  author_id: string | null; review_note: string | null;
  draft_source?: "human" | "ai_starter"; draft_model?: string | null;
  principles: string[]; policy_statements: string[]; roles_responsibilities: string[];
  rules: string[]; exceptions: string[]; escalation: string[]; records_evidence: string[];
};
type Field = "principles" | "policy_statements" | "roles_responsibilities" | "rules" | "exceptions" | "escalation" | "records_evidence";
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
  const policy = policies.find((item) => item.id === selected);
  const current = versions.find((item) => item.policy_id === selected && ["draft", "in_review"].includes(item.status));

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
        if (response.ok) { setVersions(body.versions ?? []); setUserId(data.session.user.id); }
        else setError(body.error ?? "Policy revisions could not be loaded.");
      }
    }).catch(() => { if (alive) setError("Policy revisions could not be loaded."); });
    return () => { alive = false; };
  }, [organisationId, supabase]);

  function choose(id: string) {
    setSelected(id); setError(""); setMessage("");
    const revision = versions.find((item) => item.policy_id === id && ["draft", "in_review"].includes(item.status));
    const active = policies.find((item) => item.id === id)?.activeVersion;
    const source = revision ?? active;
    setPurpose(source?.purpose ?? ""); setScope(source?.scope ?? "");
    setEffectiveDate(revision?.effective_date ?? active?.effectiveDate ?? "");
    setReviewDate(revision?.review_date ?? active?.reviewDate ?? "");
    setSections({
      principles: (source?.principles ?? []).join("\n"),
      policy_statements: (revision?.policy_statements ?? active?.policyStatements ?? []).join("\n"),
      roles_responsibilities: (revision?.roles_responsibilities ?? active?.rolesResponsibilities ?? []).join("\n"),
      rules: (source?.rules ?? []).join("\n"), exceptions: (source?.exceptions ?? []).join("\n"),
      escalation: (source?.escalation ?? []).join("\n"),
      records_evidence: (revision?.records_evidence ?? active?.recordsEvidence ?? []).join("\n"),
    });
  }

  async function prepareStarter() {
    if (!supabase || !policy || busy || current) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Your session ended. Sign in again.");
      const response = await fetch(`/api/khpos/ops/library/${organisationId}/starter-draft`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ kind: "policy", controlId: policy.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Starter draft could not be prepared.");
      const nextVersions = (body.versions ?? []) as Revision[];
      setVersions(nextVersions);
      if (body.library) onPublished(body.library);
      const revision = nextVersions.find((item) => item.policy_id === policy.id && item.status === "draft");
      if (revision) {
        setPurpose(revision.purpose ?? "");
        setScope(revision.scope ?? "");
        setEffectiveDate(revision.effective_date ?? "");
        setReviewDate(revision.review_date ?? "");
        setSections({
          principles: (revision.principles ?? []).join("\n"),
          policy_statements: (revision.policy_statements ?? []).join("\n"),
          roles_responsibilities: (revision.roles_responsibilities ?? []).join("\n"),
          rules: (revision.rules ?? []).join("\n"),
          exceptions: (revision.exceptions ?? []).join("\n"),
          escalation: (revision.escalation ?? []).join("\n"),
          records_evidence: (revision.records_evidence ?? []).join("\n"),
        });
      }
      setMessage("Starter draft prepared. Edit it carefully before submitting for independent review.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Starter draft could not be prepared.");
    } finally {
      setBusy(false);
    }
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
    <p className="mt-2 text-xs font-semibold text-brand-700">AI may prepare an editable starter draft. It cannot submit, review or approve a policy.</p>
    <label className="mt-5 block text-sm font-bold">Policy to work on
      <select className="mt-2 w-full rounded-xl border p-3" value={selected} onChange={(event) => choose(event.target.value)}>
        <option value="">Select a registered policy</option>
        {policies.map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name} ({item.priority})</option>)}
      </select>
    </label>
    {policy && <div className="mt-5 space-y-4">
      <p className="text-sm font-semibold">{current ? `Revision v${current.version}: ${current.status.replaceAll("_", " ")}` : "Start a new school revision"}</p>
      {current?.draft_source === "ai_starter" && <p className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-xs font-semibold text-brand-800">AI starter draft · human editing and independent review required{current.draft_model ? ` · ${current.draft_model}` : ""}</p>}
      {current?.review_note && <p className="rounded-xl bg-amber-50 p-3 text-sm">Review note: {current.review_note}</p>}
      {(!current || (current.status === "draft" && current.author_id === userId)) && <div className="space-y-4">
        {!current && <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-black text-slate-950">Start faster without surrendering judgement.</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">KHP-OS can prepare a substantive first draft from this policy register and its related processes. You remain the author and must edit it before review.</p>
          <button type="button" disabled={busy} onClick={() => void prepareStarter()} className="mt-3 rounded-full border border-brand-700 bg-white px-4 py-2.5 text-sm font-black text-brand-800 disabled:opacity-50">
            {busy ? "Preparing starter draft…" : "Prepare starter draft with AI"}
          </button>
        </div>}
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
