"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ExtendedWorkspace as WorkspaceType } from "@/lib/khpos/ops/extended";

type Campus = { id: string; name: string; canManage?: boolean };
type Assignment = { id: string; title: string; campusId: string | null; isMine?: boolean };
type EventRecord = { id: string; title: string; purpose: string; templateCode: string; eventDate: string; campusId: string; ownerAssignmentId: string; budgetNgn: number | null; status: string; isOwner: boolean; canManage: boolean; isGuardian: boolean; history: Array<{ id: string; type: string; note: string; createdAt: string }> };
type JourneyRecord = { id: string; parentReference: string; stage: string; status: string; campusId: string; ownerAssignmentId: string; nextAction: string; dueDate: string; sourceChannel: string; isOwner: boolean; isGuardian: boolean; history: Array<{ id: string; type: string; note: string; createdAt: string }> };
type PulseCampus = { id: string; name: string; guardianAssigned: boolean; readinessRecorded: number; readinessExceptions: number; workOverdue: number; issuesOpen: number; issuesCritical: number; parentsOverdue: number; journeysOverdue: number; assetsDue: number; eventsAwaitingApproval: number };
type Snapshot = { campuses: Campus[]; assignments?: Assignment[]; events?: EventRecord[]; journeys?: JourneyRecord[]; operatingDate?: string };

function Field({ name, title, type = "text", required = true, children }: { name: string; title: string; type?: string; required?: boolean; children?: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-700">{title}{children ?? <input name={name} type={type} required={required} className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-950" />}</label>;
}
function SelectField({ name, title, options }: { name: string; title: string; options: Array<{ value: string; label: string }> }) {
  return <Field name={name} title={title}><select name={name} required defaultValue="" className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base"><option value="" disabled>Choose…</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>;
}
function TextArea({ name, title }: { name: string; title: string }) {
  return <Field name={name} title={title}><textarea name={name} required rows={2} className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" /></Field>;
}
function ActionForm({ label, fields, onSubmit, busy }: { label: string; fields: React.ReactNode; busy: boolean; onSubmit: (values: Record<string, string>) => Promise<boolean> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const saved = await onSubmit(Object.fromEntries(new FormData(form)) as Record<string, string>);
    if (saved && form.isConnected) form.reset();
  }
  return <details className="rounded-xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-sm font-bold text-brand-800">{label}</summary><form onSubmit={(event) => void submit(event)} className="mt-3 grid gap-3 sm:grid-cols-2">{fields}<button type="submit" disabled={busy} className="self-end rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : label}</button></form></details>;
}

export function ExtendedWorkspace({ organisationId, type }: { organisationId: string; type: WorkspaceType }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/khpos/ops/extended/${organisationId}?type=${type}`;
  const load = useCallback(async () => {
    const { data: session } = await supabase?.auth.getSession() ?? { data: { session: null } };
    const token = session.session?.access_token;
    if (!token) { setError("Sign in to open this school workspace."); return; }
    const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const result = await res.json();
    if (!res.ok || !result.ok) { setError(result.error ?? "Could not load this workspace."); return; }
    setData(result.workspace as Snapshot); setError("");
  }, [endpoint, supabase]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function act(mode: string, input: Record<string, unknown>): Promise<boolean> {
    const { data: session } = await supabase?.auth.getSession() ?? { data: { session: null } };
    const token = session.session?.access_token;
    if (!token) { setError("Sign in again to continue."); return false; }
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ mode, input }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "The action could not be saved.");
      setData(result.workspace as Snapshot);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The action could not be saved."); return false; }
    finally { setBusy(false); }
  }
  const title = type === "events" ? "Events & Programmes" : type === "parent-journeys" ? "Parent Journey" : "Network Pulse";
  return <main className="min-h-screen bg-slate-50 text-slate-950"><header className="bg-slate-950 px-5 py-9 text-white"><div className="mx-auto max-w-6xl"><Link href={`/khpos/${organisationId}`} className="text-sm font-bold text-mint-300">← Command Centre</Link><h1 className="mt-5 text-3xl font-black sm:text-4xl">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{type === "events" ? "Plan, approve, deliver and review each school event with a named owner and evidence." : type === "parent-journeys" ? "Keep every family enquiry moving through visits, applications and onboarding with a named follow-up owner." : "One operating view across the campuses you are authorised to lead."}</p></div></header>
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-8">{error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}{!data && !error && <p>Loading school records…</p>}
      {data && type === "events" && <Events data={data} busy={busy} act={act} />}
      {data && type === "parent-journeys" && <Journeys data={data} busy={busy} act={act} />}
      {data && type === "network-pulse" && <Pulse data={data} organisationId={organisationId} />}
    </div></main>;
}

function Events({ data, busy, act }: { data: Snapshot; busy: boolean; act: (mode: string, input: Record<string, unknown>) => Promise<boolean> }) {
  const campusOptions = data.campuses.map((c) => ({ value: c.id, label: c.name }));
  const ownerOptions = (data.assignments ?? []).map((a) => ({ value: a.id, label: `${a.title} · ${data.campuses.find((c) => c.id === a.campusId)?.name ?? "School"}` }));
  return <><ActionForm label="Create event charter" busy={busy} onSubmit={(values) => act("create", values)} fields={<><SelectField name="campusId" title="Campus" options={campusOptions} /><SelectField name="ownerAssignmentId" title="Responsible owner" options={ownerOptions} /><SelectField name="templateCode" title="Event type" options={[{ value: "golden_pause", label: "The Golden Pause" }, { value: "sport_culture", label: "Sport & Culture" }, { value: "builder_summit", label: "Builder Summit" }, { value: "other", label: "Other" }]} /><Field name="eventDate" title="Event date" type="date" /><Field name="title" title="Event title" /><TextArea name="purpose" title="Purpose and intended outcome" /></>} />
    {(data.events ?? []).length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">No event charters yet. Start with an owner, campus, purpose and date.</p>}
    {(data.events ?? []).map((event) => <article key={event.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-xl font-black">{event.title}</h2><p className="mt-1 text-sm text-slate-600">{event.purpose}</p><p className="mt-2 text-xs font-semibold text-slate-500">{event.eventDate} · {data.campuses.find((c) => c.id === event.campusId)?.name} · {event.templateCode.replaceAll("_", " ")}</p></div><span className="h-fit rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-800">{event.status.replaceAll("_", " ")}</span></div>
      <div className="grid gap-2 md:grid-cols-2">{event.status === "draft" && event.isOwner && <><ActionForm label="Complete budget and safety plan" busy={busy} onSubmit={(values) => act("plan", { ...values, eventId: event.id })} fields={<><Field name="budgetNgn" title="Budget (₦)" type="number" /><TextArea name="fundingPlan" title="Funding plan" /><TextArea name="safetyPlan" title="Safety plan" /><TextArea name="consentPlan" title="Consent plan" /><TextArea name="logisticsPlan" title="Logistics plan" /><TextArea name="runOfShow" title="Run of show" /><TextArea name="note" title="Planning note" /></>} /><ActionForm label="Submit for Guardian approval" busy={busy} onSubmit={(values) => act("submit", { ...values, eventId: event.id })} fields={<TextArea name="note" title="Submission note" />} /></>}
      {event.status === "submitted" && event.isGuardian && !event.isOwner && (["approve", "return"] as const).map((mode) => <ActionForm key={mode} label={mode === "approve" ? "Approve event" : "Return for revision"} busy={busy} onSubmit={(values) => act(mode, { ...values, eventId: event.id })} fields={<TextArea name="note" title="Decision and reason" />} />)}
      {event.status === "approved" && event.isOwner && <ActionForm label="Confirm readiness and start" busy={busy} onSubmit={(values) => act("start", { ...values, eventId: event.id })} fields={<><TextArea name="note" title="Readiness note" /><Field name="evidenceReference" title="Safety, consent and logistics evidence reference" /></>} />}
      {event.status === "active" && event.isOwner && <ActionForm label="Record completion" busy={busy} onSubmit={(values) => act("complete", { ...values, eventId: event.id })} fields={<><TextArea name="note" title="Outcome summary" /><Field name="evidenceReference" title="Delivery evidence reference" /></>} />}
      {event.status === "completed" && event.isGuardian && !event.isOwner && <ActionForm label="Review outcome" busy={busy} onSubmit={(values) => act("review", { ...values, eventId: event.id })} fields={<TextArea name="note" title="Review and learning" />} />}
      {["draft", "submitted", "approved"].includes(event.status) && event.isGuardian && <ActionForm label="Cancel unstarted event" busy={busy} onSubmit={(values) => act("cancel", { ...values, eventId: event.id })} fields={<TextArea name="note" title="Reason for cancellation" />} />}</div>
      <details><summary className="cursor-pointer text-sm font-semibold text-slate-600">History ({event.history.length})</summary><ul className="mt-2 space-y-2 text-sm text-slate-600">{event.history.map((h) => <li key={h.id}>{h.type} · {h.note} · {new Date(h.createdAt).toLocaleString()}</li>)}</ul></details></article>)}
  </>;
}

function Journeys({ data, busy, act }: { data: Snapshot; busy: boolean; act: (mode: string, input: Record<string, unknown>) => Promise<boolean> }) {
  return <><ActionForm label="Record family enquiry" busy={busy} onSubmit={(values) => act("record", values)} fields={<><SelectField name="campusId" title="Campus" options={data.campuses.map((c) => ({ value: c.id, label: c.name }))} /><SelectField name="ownerAssignmentId" title="Follow-up leader" options={(data.assignments ?? []).map((a) => ({ value: a.id, label: `${a.title} · ${data.campuses.find((c) => c.id === a.campusId)?.name ?? "School"}` }))} /><Field name="parentReference" title="Family reference (minimum necessary)" /><SelectField name="sourceChannel" title="How they contacted the school" options={["in_person", "phone", "whatsapp", "email", "referral", "other"].map((v) => ({ value: v, label: v.replaceAll("_", " ") }))} /><Field name="dueDate" title="Follow-up date" type="date" /><TextArea name="nextAction" title="Next action" /></>} />
    {(data.journeys ?? []).length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">No family journeys recorded yet.</p>}
    {(data.journeys ?? []).map((j) => <article key={j.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-lg font-black">{j.parentReference}</h2><p className="mt-1 text-sm text-slate-600">Next: {j.nextAction} · Due {j.dueDate}</p><p className="text-xs text-slate-500">{data.campuses.find((c) => c.id === j.campusId)?.name} · {j.sourceChannel.replaceAll("_", " ")}</p></div><span className="h-fit rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-800">{j.stage} · {j.status}</span></div><div className="grid gap-2 md:grid-cols-2">
      {j.status === "open" && j.isOwner && <ActionForm label="Advance journey" busy={busy} onSubmit={(values) => act("advance", { ...values, journeyId: j.id })} fields={<><SelectField name="stage" title="Next stage" options={["visit", "application", "onboarding", "active", "exit"].map((v) => ({ value: v, label: v }))} /><Field name="dueDate" title="Next follow-up date" type="date" /><TextArea name="nextAction" title="Next action" /><TextArea name="note" title="What happened" /><Field name="evidenceReference" title="Evidence reference" /></>} />}
      {j.status === "open" && j.isGuardian && (["complete", "lost"] as const).map((mode) => <ActionForm key={mode} label={mode === "complete" ? "Verify completed journey" : "Close lost journey"} busy={busy} onSubmit={(values) => act(mode, { ...values, journeyId: j.id })} fields={<><TextArea name="note" title="Outcome and reason" /><Field name="evidenceReference" title="Evidence reference" /></>} />)}</div><details><summary className="cursor-pointer text-sm font-semibold text-slate-600">History ({j.history.length})</summary><ul className="mt-2 space-y-2 text-sm text-slate-600">{j.history.map((h) => <li key={h.id}>{h.type} · {h.note} · {new Date(h.createdAt).toLocaleString()}</li>)}</ul></details></article>)}
  </>;
}

function Pulse({ data, organisationId }: { data: Snapshot; organisationId: string }) {
  const campuses = data.campuses as PulseCampus[];
  return <><p className="text-sm font-semibold text-slate-600">Operating date: {data.operatingDate ?? "Today"} · Counts update as teams complete their work.</p><div className="grid gap-4 md:grid-cols-2">{campuses.map((c) => <article key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-black">{c.name}</h2><p className="mt-1 text-sm font-semibold text-slate-600">School Guardian: {c.guardianAssigned ? "Assigned" : "Unassigned"}</p><dl className="mt-4 grid grid-cols-2 gap-3 text-sm">{([ ["Readiness checks", c.readinessRecorded], ["Readiness exceptions", c.readinessExceptions], ["Work overdue", c.workOverdue], ["Open issues", c.issuesOpen], ["Critical issues", c.issuesCritical], ["Parent cases overdue", c.parentsOverdue], ["Journeys overdue", c.journeysOverdue], ["Assets due", c.assetsDue], ["Events awaiting approval", c.eventsAwaitingApproval] ] as const).map(([name,value]) => <div key={name} className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-600">{name}</dt><dd className="mt-1 text-xl font-black">{value}</dd></div>)}</dl><div className="mt-4 flex flex-wrap gap-3 text-sm font-bold text-brand-700"><Link href={`/khpos/${organisationId}/campus-readiness`}>Campus readiness →</Link><Link href={`/khpos/${organisationId}/issues`}>Issues →</Link><Link href={`/khpos/${organisationId}/events`}>Events →</Link></div></article>)}</div></>;
}
