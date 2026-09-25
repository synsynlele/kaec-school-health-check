"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { SafeguardingWorkspace as Workspace } from "@/lib/khpos/ops/safeguarding";

const categories = ["disclosure", "suspected_harm", "peer_harm", "staff_allegation", "injury", "missing_learner", "other"];
const stepTypes = ["protection", "referral", "family_contact", "follow_up", "support", "other"];
const readable = (value: string) => value.replaceAll("_", " ");

export function SafeguardingWorkspace({ organisationId }: { organisationId: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState("");
  const set = (key: string, value: string) => setFields((current) => ({ ...current, [key]: value }));
  async function accessToken() {
    const { data: session } = await supabase?.auth.getSession() || { data: { session: null } };
    if (!session.session?.access_token) throw new Error("Sign in to continue.");
    return session.session.access_token;
  }
  async function reload(token: string) {
    const response = await fetch(`/api/khpos/ops/safeguarding/${organisationId}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Safeguarding workspace could not be loaded.");
    return result.safeguarding as Workspace;
  }
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(async ({ data: session }) => {
      try {
        if (!session.session?.access_token) throw new Error("Sign in to continue.");
        const result = await reload(session.session.access_token);
        if (active) setData(result);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Safeguarding workspace could not be loaded."); }
    });
    return () => { active = false; };
  // Access is bound to this signed-in session; actions refresh separately.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, supabase]);

  async function act(mode: string, input: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const token = await accessToken();
      const response = await fetch(`/api/khpos/ops/safeguarding/${organisationId}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ mode, ...input }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Safeguarding action failed.");
      if (mode === "report") setReceipt(result.result.receiptId);
      setData(await reload(token)); setFields({});
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Safeguarding action failed."); }
    finally { setBusy(false); }
  }
  const field = (key: string, label: string, kind: "text" | "datetime-local" | "textarea" = "text") => <label className="block text-sm font-semibold text-slate-700">{label}{kind === "textarea" ? <textarea value={fields[key] || ""} onChange={(event) => set(key, event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900" /> : <input type={kind} value={fields[key] || ""} onChange={(event) => set(key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900" />}</label>;
  const select = (key: string, label: string, options: { value: string; label: string }[]) => <label className="block text-sm font-semibold text-slate-700">{label}<select value={fields[key] || ""} onChange={(event) => set(key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900"><option value="">Choose…</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  const button = (label: string, action: () => void, disabled = false) => <button type="button" disabled={busy || disabled} onClick={action} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : label}</button>;
  const chosen = data?.campuses.find((campus) => campus.id === fields.campus);
  const contact = data?.contacts.find((person) => person.campusId === chosen?.id);
  const eligible = (campusId: string) => data?.eligibleAssignments.filter((a) => a.campusId === campusId || a.campusId === null).map((a) => ({ value: a.id, label: `${a.name} · ${a.role}` })) || [];

  return <main className="mx-auto max-w-5xl space-y-6 p-5 text-slate-900"><div><h1 className="text-3xl font-bold">Safeguarding</h1><p className="mt-2 text-slate-600">Restricted records for designated safeguarding personnel. Staff can submit a concern and retain its receipt; only the lead and deputy can read case content.</p></div>
    <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-950"><strong>Immediate safety first.</strong> Protect the learner and contact the designated lead or deputy directly. If someone is in immediate danger, use the school’s emergency response. This form does not send an emergency alert. Listen, record facts, and leave investigation to the authorised safeguarding pathway.</div>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-800">{error}</p>}
    {receipt && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-950">Restricted report saved. Receipt: <strong className="break-all">{receipt}</strong>. Keep this reference and continue direct contact with the safeguarding lead or deputy.</p>}
    {!data && !error && <p>Loading protected workspace…</p>}
    {data?.campuses.filter((campus) => campus.canConfigure).map((campus) => <section key={campus.id} className="space-y-3 rounded-xl border border-slate-200 p-4"><h2 className="text-xl font-bold">Designated people · {campus.name}</h2><p className="text-sm text-slate-600">A School Guardian appoints two different active staff members. Digital intake starts only after both are assigned.</p><p className="text-sm">Current: {data.designations.find((d) => d.campusId === campus.id) ? "Lead and deputy appointed" : "Not configured"}</p><div className="grid gap-2 md:grid-cols-2">{select(`lead-${campus.id}`, "Safeguarding lead", eligible(campus.id))}{select(`deputy-${campus.id}`, "Deputy lead", eligible(campus.id))}</div>{button("Save designation", () => void act("designate", { campusId: campus.id, leadAssignmentId: fields[`lead-${campus.id}`], deputyAssignmentId: fields[`deputy-${campus.id}`] }), !fields[`lead-${campus.id}`] || !fields[`deputy-${campus.id}`] || fields[`lead-${campus.id}`] === fields[`deputy-${campus.id}`])}</section>)}
    {data && <section className="space-y-3 rounded-xl border border-slate-200 p-4"><h2 className="text-xl font-bold">Record a concern</h2>{select("campus", "Campus", data.campuses.map((c) => ({ value: c.id, label: c.name })))}{chosen && !chosen.configured && <p className="font-semibold text-rose-800">Digital intake is disabled for this campus. Contact the School Guardian and use the school’s direct safeguarding procedure.</p>}{contact && <p className="text-sm text-slate-700">Lead: {contact.leadName} ({contact.leadEmail}) · Deputy: {contact.deputyName} ({contact.deputyEmail}). Contact directly before recording.</p>}
      {chosen?.configured && <><div className="grid gap-3 md:grid-cols-2">{select("learner", "Learner, if known", data.learners.filter((l) => l.campusId === chosen.id).map((l) => ({ value: l.id, label: l.name })))}{select("category", "Concern type", categories.map((category) => ({ value: category, label: readable(category) })))}{select("urgency", "Urgency", [{ value: "urgent", label: "Urgent" }, { value: "standard", label: "Standard" }])}{select("implicated", "Is a designated person implicated?", [{ value: "none", label: "No" }, { value: "lead", label: "Lead" }, { value: "deputy", label: "Deputy" }, { value: "other", label: "Other person or unknown" }])}{select("contacted", "Person contacted directly", [{ value: "lead", label: "Lead" }, { value: "deputy", label: "Deputy" }])}</div>{field("facts", "Factual account, including the learner’s own words where relevant", "textarea")}{field("protection", "What was done immediately to protect the learner?", "textarea")}
      <label className="flex items-start gap-2 text-sm font-semibold"><input type="checkbox" checked={fields.confirmed === "yes"} onChange={(event) => set("confirmed", event.target.checked ? "yes" : "")} className="mt-1" />I have directly contacted the person selected above; submitting this record will not notify them.</label>{button("Save restricted report", () => void act("report", { campusId: chosen.id, learnerId: fields.learner || null, category: fields.category, urgency: fields.urgency, implicatedRole: fields.implicated, contactedPerson: fields.contacted, directContactConfirmed: fields.confirmed === "yes", reportedFacts: fields.facts, immediateProtection: fields.protection }), !fields.category || !fields.urgency || !fields.implicated || !fields.contacted || fields.contacted === fields.implicated || !fields.facts || !fields.protection || fields.confirmed !== "yes")}</>}
    </section>}
    {data?.cases.map((item) => <section key={item.id} className="space-y-3 rounded-xl border border-slate-300 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold capitalize">{readable(item.category)} · {readable(item.status)}</h2><span className="text-sm font-semibold text-rose-800">{item.urgency.toUpperCase()}</span></div><p className="text-sm text-slate-600">Case {item.id} · {new Date(item.reportedAt).toLocaleString()}</p><p className="whitespace-pre-wrap">{item.reportedFacts}</p><p><strong>Immediate protection:</strong> {item.immediateProtection}</p>
      {item.status === "submitted" && <div className="grid gap-2 md:grid-cols-2">{field(`protection-${item.id}`, "Protection and safety plan", "textarea")}{field(`referral-${item.id}`, "Referral decision and reason", "textarea")}{field(`review-${item.id}`, "Next review", "datetime-local")}{button("Record triage", () => void act("triage", { caseId: item.id, protection: fields[`protection-${item.id}`], referralDecision: fields[`referral-${item.id}`], reviewDueAt: fields[`review-${item.id}`] ? new Date(fields[`review-${item.id}`]).toISOString() : null }), !fields[`protection-${item.id}`] || !fields[`referral-${item.id}`] || !fields[`review-${item.id}`])}</div>}
      {item.triageProtection && <p><strong>Protection plan:</strong> {item.triageProtection}</p>}{item.referralDecision && <p><strong>Referral decision:</strong> {item.referralDecision}</p>}
      {item.steps.map((step) => <p key={step.id} className="rounded-lg bg-white p-2 text-sm"><strong className="capitalize">{readable(step.type)}:</strong> {step.actionTaken}{step.evidenceReference ? ` · ${step.evidenceReference}` : ""}</p>)}
      {["triaged", "monitoring"].includes(item.status) && <div className="grid gap-2 rounded-lg bg-white p-3 md:grid-cols-2">{select(`type-${item.id}`, "Response step", stepTypes.map((type) => ({ value: type, label: readable(type) })))}{field(`action-${item.id}`, "Action taken", "textarea")}{field(`evidence-${item.id}`, "Evidence or external reference")}{button("Record step", () => void act("record_step", { caseId: item.id, stepType: fields[`type-${item.id}`], actionTaken: fields[`action-${item.id}`], evidenceReference: fields[`evidence-${item.id}`] || null }), !fields[`type-${item.id}`] || !fields[`action-${item.id}`])}</div>}
      {item.status === "monitoring" && <div className="space-y-2">{field(`close-${item.id}`, "Independent closure review", "textarea")}{field(`external-${item.id}`, "External review reference if the other designated person is implicated")}{button("Close after follow-up", () => void act("close", { caseId: item.id, note: fields[`close-${item.id}`], externalReviewReference: fields[`external-${item.id}`] || null }), !fields[`close-${item.id}`] || !item.steps.some((step) => step.type === "follow_up"))}</div>}
      {item.status === "closed" && <p className="text-sm text-emerald-800">Closed: {item.closureNote}</p>}
    </section>)}
  </main>;
}
