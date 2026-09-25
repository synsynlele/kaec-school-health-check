"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { CultureWorkspace } from "@/lib/khpos/ops/culture";

const categories = [
  ["classroom_behaviour", "Classroom behaviour"], ["attendance_concern", "Attendance concern"],
  ["peer_conflict", "Peer conflict"], ["student_voice", "Student voice"], ["recognition", "Recognition"],
];
const clean = (value: string) => value.replaceAll("_", " ");

export function StudentCultureWorkspace({ organisationId }: { organisationId: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [data, setData] = useState<CultureWorkspace | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (key: string, value: string) => setFields((old) => ({ ...old, [key]: value }));
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(async ({ data: session }) => {
      if (!session.session?.access_token) { if (active) setError("Sign in to continue."); return; }
      try {
        const response = await fetch(`/api/khpos/ops/culture/${organisationId}`, { headers: { Authorization: `Bearer ${session.session.access_token}` }, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Student Culture could not be loaded.");
        if (active) setData(result.culture);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Student Culture could not be loaded."); }
    });
    return () => { active = false; };
  }, [organisationId, supabase]);

  async function act(mode: string, input: Record<string, unknown>) {
    if (!supabase) return;
    setBusy(true); setError("");
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error("Sign in to continue.");
      const response = await fetch(`/api/khpos/ops/culture/${organisationId}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.session.access_token}` }, body: JSON.stringify({ mode, ...input }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Culture action failed.");
      setData(result.culture); setFields({});
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Culture action failed."); }
    finally { setBusy(false); }
  }
  const input = (key: string, label: string, type = "text") => <label className="block text-sm font-medium text-slate-700">{label}<input type={type} value={fields[key] || ""} onChange={(event) => set(key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900" /></label>;
  const select = (key: string, label: string, options: { value: string; label: string }[]) => <label className="block text-sm font-medium text-slate-700">{label}<select value={fields[key] || ""} onChange={(event) => set(key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900"><option value="">Choose…</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  const button = (label: string, action: () => void, disabled = false) => <button type="button" disabled={busy || disabled} onClick={action} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : label}</button>;
  const assignments = data?.assignments.map((a) => ({ value: a.id, label: a.title + (a.isMine ? " (me)" : "") })) || [];

  return <main className="mx-auto max-w-6xl space-y-6 p-5 text-slate-900"><div><h1 className="text-3xl font-bold">Student Culture</h1><p className="mt-2 text-slate-600">Record ordinary concerns, student voice and recognition. Assign a response and verify its outcome.</p><p className="mt-2 font-semibold text-rose-800">If a child may be unsafe, protect and report immediately through the safeguarding pathway. Do not write disclosure details here.</p></div>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-800">{error}</p>}
    {!data && !error && <p>Loading cases…</p>}
    {data && <section className="space-y-3 rounded-xl border border-slate-200 p-4"><h2 className="text-xl font-bold">Report or recognise</h2><div className="grid gap-3 md:grid-cols-3">
      {select("campus", "Campus", data.campuses.map((c) => ({ value: c.id, label: c.name })))}
      {select("category", "Category", categories.map(([value, label]) => ({ value, label })))}
      {select("learner", "Learner (required for behaviour and attendance)", data.learners.filter((l) => l.campusId === fields.campus).map((l) => ({ value: l.id, label: `${l.name} · ${l.classLabel}` })))}
      {input("summary", "What happened or what was raised?")}{input("evidence", "Evidence or source reference")}
      {select("owner", "Response owner", assignments.filter((a) => { const assignment = data.assignments.find((x) => x.id === a.value); return assignment?.campusId === fields.campus || assignment?.campusId === null; }))}
      {input("due", "Response due", "date")}
    </div>{button("Record case", () => void act("report", { campusId: fields.campus, learnerId: fields.learner || null, category: fields.category, summary: fields.summary, evidenceReference: fields.evidence, ownerAssignmentId: fields.owner, dueDate: fields.due }), !fields.campus || !fields.category || !fields.summary || !fields.evidence || !fields.owner || !fields.due || (!["student_voice", "recognition"].includes(fields.category) && !fields.learner))}</section>}
    {data?.cases.map((item) => <section key={item.id} className="space-y-3 rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold capitalize">{clean(item.category)} · {clean(item.status)}</h2><span className={item.status !== "verified" && item.status !== "referred_safeguarding" && item.dueDate < new Date().toISOString().slice(0, 10) ? "font-bold text-rose-700" : "text-slate-500"}>Due {item.dueDate}</span></div><p>{item.summary}</p><p className="text-sm text-slate-600">{data.learners.find((l) => l.id === item.learnerId)?.name || "Whole-campus concern"} · Evidence: {item.evidenceReference}</p>
      {item.canManage && item.status === "open" && button("Start response", () => void act("triage", { caseId: item.id }))}
      {item.canManage && ["open", "in_action"].includes(item.status) && <div className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-3"><h3 className="md:col-span-3 font-bold">Assign an action</h3>{input(`action-${item.id}`, "Action")}{input(`change-${item.id}`, "Expected change")}{select(`owner-${item.id}`, "Action owner", assignments.filter((a) => { const assignment = data.assignments.find((x) => x.id === a.value); return assignment?.campusId === item.campusId || assignment?.campusId === null; }))}{input(`date-${item.id}`, "Due date", "date")}{button("Assign", () => void act("create_action", { caseId: item.id, action: fields[`action-${item.id}`], expectedChange: fields[`change-${item.id}`], ownerAssignmentId: fields[`owner-${item.id}`], dueDate: fields[`date-${item.id}`] }), !fields[`action-${item.id}`] || !fields[`change-${item.id}`] || !fields[`owner-${item.id}`] || !fields[`date-${item.id}`])}</div>}
      {item.actions.map((action) => <div key={action.id} className="space-y-2 rounded-lg border border-slate-200 p-3"><p className="font-semibold">{action.action} · {clean(action.status)}</p><p className="text-sm text-slate-600">Target: {action.expectedChange} · Due {action.dueDate}</p>{action.isOwner && ["open", "returned"].includes(action.status) && <div className="grid gap-2 md:grid-cols-3">{input(`note-${action.id}`, "Completion note")}{input(`evidence-${action.id}`, "Completion evidence reference")}{button("Submit evidence", () => void act("submit_action", { actionId: action.id, note: fields[`note-${action.id}`], evidenceReference: fields[`evidence-${action.id}`] }), !fields[`note-${action.id}`] || !fields[`evidence-${action.id}`])}</div>}{item.canManage && action.status === "evidence_submitted" && <div className="space-y-2"><p className="text-sm">{action.completionNote} · {action.completionEvidence}</p>{input(`review-${action.id}`, "Evidence review note")}{button("Verify action", () => void act("verify_action", { actionId: action.id, note: fields[`review-${action.id}`] }), !fields[`review-${action.id}`])} {button("Return for more evidence", () => void act("return_action", { actionId: action.id, note: fields[`review-${action.id}`] }), !fields[`review-${action.id}`])}</div>}</div>)}
      {item.isOwner && ["open", "in_action"].includes(item.status) && <div className="space-y-2">{input(`outcome-${item.id}`, "Outcome summary")}{button("Submit for independent review", () => void act("submit_case", { caseId: item.id, note: fields[`outcome-${item.id}`] }), !fields[`outcome-${item.id}`])}</div>}
      {item.canManage && item.status === "awaiting_review" && <div className="space-y-2"><p>Outcome: {item.responseSummary}</p>{input(`verify-${item.id}`, "Review finding")}{button("Verify outcome", () => void act("verify_case", { caseId: item.id, note: fields[`verify-${item.id}`] }), !fields[`verify-${item.id}`])}</div>}
      {item.status === "verified" && <p className="text-sm text-emerald-800">Verified: {item.verificationNote}</p>}
      {item.canManage && item.status !== "referred_safeguarding" && <div className="space-y-2 border-t border-slate-200 pt-3"><p className="text-sm text-slate-600">If this becomes a safety concern, refer through the protected safeguarding pathway first. Enter its reference here only.</p>{input(`referral-${item.id}`, "Safeguarding referral reference")}{button("Mark referred", () => void act("refer_safeguarding", { caseId: item.id, referralReference: fields[`referral-${item.id}`] }), !fields[`referral-${item.id}`])}</div>}
    </section>)}
  </main>;
}
