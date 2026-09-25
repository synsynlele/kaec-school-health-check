"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ParentCase, ParentWorkspace } from "@/lib/khpos/ops/parents";

const categories = ["academic", "culture", "fees", "admission", "general"];
const channels = ["in_person", "phone", "whatsapp", "email", "other"];
const label = (value: string) => value.replaceAll("_", " ");
const openStatuses = ["acknowledged", "in_action", "escalated"];

export function ParentPartnershipWorkspace({ organisationId }: { organisationId: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [data, setData] = useState<ParentWorkspace | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (key: string, value: string) => setFields((previous) => ({ ...previous, [key]: value }));

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(async ({ data: session }) => {
      if (!session.session?.access_token) { if (active) setError("Sign in to continue."); return; }
      try {
        const response = await fetch(`/api/khpos/ops/parents/${organisationId}`, { headers: { Authorization: `Bearer ${session.session.access_token}` }, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Parent Partnership could not be loaded.");
        if (active) setData(result.parents);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Parent Partnership could not be loaded."); }
    });
    return () => { active = false; };
  }, [organisationId, supabase]);

  async function act(mode: string, input: Record<string, unknown>) {
    if (!supabase) return;
    setBusy(true); setError("");
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error("Sign in to continue.");
      const response = await fetch(`/api/khpos/ops/parents/${organisationId}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.session.access_token}` }, body: JSON.stringify({ mode, ...input }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Parent case action failed.");
      setData(result.parents); setFields({});
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Parent case action failed."); }
    finally { setBusy(false); }
  }
  const input = (key: string, title: string, type = "text") => <label className="block text-sm font-medium text-slate-700">{title}<input type={type} value={fields[key] || ""} onChange={(event) => set(key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900" /></label>;
  const notes = (key: string, title: string) => <label className="block text-sm font-medium text-slate-700">{title}<textarea rows={2} value={fields[key] || ""} onChange={(event) => set(key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900" /></label>;
  const select = (key: string, title: string, options: { value: string; title: string }[]) => <label className="block text-sm font-medium text-slate-700">{title}<select value={fields[key] || ""} onChange={(event) => set(key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900"><option value="">Choose…</option>{options.map((option) => <option key={option.value} value={option.value}>{option.title}</option>)}</select></label>;
  const button = (title: string, action: () => void, disabled = false) => <button type="button" disabled={busy || disabled} onClick={action} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : title}</button>;
  const channelOptions = channels.map((value) => ({ value, title: label(value) }));
  const cases = data?.cases || [];
  const openCount = cases.filter((item) => item.status !== "closed").length;
  const overdueCount = cases.filter((item) => item.status !== "closed" && item.dueDate < new Date().toISOString().slice(0, 10)).length;

  function communication(item: ParentCase, mode: "acknowledge" | "communication" | "respond") {
    const prefix = `${mode}-${item.id}`;
    return <div className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-3">
      <div className="md:col-span-3 font-semibold">{mode === "acknowledge" ? "Record acknowledgement delivered" : mode === "respond" ? "Submit response delivered to parent" : "Log parent communication"}</div>
      {select(`${prefix}-channel`, "Delivery channel", channelOptions)}
      {input(`${prefix}-evidence`, "Delivery evidence or source reference")}
      {notes(`${prefix}-note`, "What was communicated?")}
      <div className="md:col-span-3">{button(mode === "acknowledge" ? "Acknowledge" : mode === "respond" ? "Submit response" : "Log communication", () => void act(mode, { caseId: item.id, channel: fields[`${prefix}-channel`], evidenceReference: fields[`${prefix}-evidence`], note: fields[`${prefix}-note`] }), !fields[`${prefix}-channel`] || !fields[`${prefix}-evidence`]?.trim() || !fields[`${prefix}-note`]?.trim())}</div>
    </div>;
  }
  function noteAction(item: ParentCase, mode: "action" | "escalate" | "return" | "close", title: string) {
    const key = `${mode}-${item.id}`;
    return <div className="space-y-2 rounded-lg bg-slate-50 p-3">{notes(key, title)}{button(mode === "action" ? "Log action" : mode === "escalate" ? "Escalate to School Guardian" : mode === "return" ? "Return for more work" : "Verify and close", () => void act(mode, { caseId: item.id, note: fields[key] }), !fields[key]?.trim())}</div>;
  }

  return <main className="mx-auto max-w-6xl space-y-6 p-5 text-slate-900">
    <header><h1 className="text-3xl font-bold">Parent Partnership</h1><p className="mt-2 text-slate-600">Receive concerns, assign a campus owner, record what parents actually received, and verify resolution.</p><p className="mt-2 font-semibold text-rose-800">If a child may be unsafe, use the <Link href={`/khpos/${organisationId}/safeguarding`} className="underline">protected safeguarding pathway</Link> immediately. Keep disclosure details out of this workspace.</p></header>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-800">{error}</p>}
    {!data && !error && <p>Loading parent cases…</p>}
    {data && <><div className="flex flex-wrap gap-3 text-sm font-semibold"><span className="rounded-lg bg-slate-100 px-3 py-2">{openCount} open</span><span className={`rounded-lg px-3 py-2 ${overdueCount ? "bg-rose-50 text-rose-800" : "bg-slate-100"}`}>{overdueCount} overdue</span></div>
      <section className="space-y-3 rounded-xl border border-slate-200 p-4"><h2 className="text-xl font-bold">Record a parent concern</h2><p className="text-sm text-slate-600">Use an existing school reference for the parent. Do not enter phone numbers or private safeguarding details.</p><div className="grid gap-3 md:grid-cols-3">
        {select("campus", "Campus", data.campuses.map((campus) => ({ value: campus.id, title: campus.name })))}
        {select("category", "Category", categories.map((value) => ({ value, title: label(value) })))}
        {select("channel", "How the concern arrived", channelOptions)}
        {input("parentReference", "Parent / guardian school reference")}
        {select("learner", "Learner (optional)", data.learners.filter((learner) => learner.campusId === fields.campus).map((learner) => ({ value: learner.id, title: `${learner.name} · ${learner.classLabel}` })))}
        {select("owner", "Campus leader responsible", data.assignments.filter((assignment) => assignment.campusId === fields.campus || assignment.campusId === null).map((assignment) => ({ value: assignment.id, title: `${assignment.title}${assignment.isMine ? " (me)" : ""}` })))}
        {input("due", "Response due", "date")}
        <div className="md:col-span-2">{notes("summary", "Concern summary")}</div>
      </div>{button("Record concern", () => void act("record", { campusId: fields.campus, category: fields.category, channel: fields.channel, parentReference: fields.parentReference, learnerId: fields.learner || null, ownerAssignmentId: fields.owner, dueDate: fields.due, summary: fields.summary }), !fields.campus || !fields.category || !fields.channel || !fields.parentReference?.trim() || !fields.owner || !fields.due || !fields.summary?.trim())}</section>
      {cases.length === 0 && <p className="rounded-xl border border-slate-200 p-4 text-slate-600">No parent concerns recorded for your campuses yet.</p>}
      {cases.map((item) => <section key={item.id} className="space-y-3 rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><h2 className="text-lg font-bold">{item.parentReference} · {label(item.category)}</h2><span className={`rounded-lg px-2 py-1 text-sm font-bold ${item.status !== "closed" && item.dueDate < new Date().toISOString().slice(0, 10) ? "bg-rose-50 text-rose-800" : "bg-slate-100"}`}>{label(item.status)} · Due {item.dueDate}</span></div>
        <p>{item.summary}</p><p className="text-sm text-slate-600">{data.campuses.find((campus) => campus.id === item.campusId)?.name} · {data.learners.find((learner) => learner.id === item.learnerId)?.name || "No learner linked"} · Owner: {data.assignments.find((assignment) => assignment.id === item.ownerAssignmentId)?.title || "Assigned leader"}</p>
        {item.escalationReason && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Escalated: {item.escalationReason}</p>}
        {item.responseSummary && <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-900">Response: {item.responseSummary} · Evidence: {item.responseEvidence}</p>}
        {item.closureNote && <p className="text-sm text-slate-600">Verified closure: {item.closureNote}</p>}
        {item.canManage && item.status === "new" && communication(item, "acknowledge")}
        {item.canManage && openStatuses.includes(item.status) && <div className="grid gap-3 lg:grid-cols-2">{noteAction(item, "action", "Action taken or assigned")}{communication(item, "communication")}{noteAction(item, "escalate", "Reason for escalation and next step")}</div>}
        {item.isOwner && openStatuses.includes(item.status) && communication(item, "respond")}
        {item.canManage && item.status === "responded" && <div className="grid gap-3 lg:grid-cols-2">{noteAction(item, "return", "What still needs to be resolved?")}{(!item.escalationReason || item.isGuardian) && noteAction(item, "close", "Independent verification and closure note")}</div>}
        <details className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold">Activity history ({item.events.length})</summary><ol className="mt-3 space-y-2 text-sm">{item.events.map((event) => <li key={event.id} className="border-t border-slate-100 pt-2"><strong className="capitalize">{label(event.type)}</strong> · {new Date(event.createdAt).toLocaleString()} {event.channel ? `· ${label(event.channel)}` : ""}<p>{event.note}</p>{event.evidenceReference && <p className="text-slate-600">Evidence: {event.evidenceReference}</p>}</li>)}</ol></details>
      </section>)}
    </>}
  </main>;
}
