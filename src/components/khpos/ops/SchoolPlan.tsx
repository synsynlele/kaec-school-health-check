"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { lagosLocalDay } from "@/lib/khpos/ops/attendance-guidance";
import { planKinds, type PlanEntry, type PlanKind, type SchoolPlan as Plan } from "@/lib/khpos/ops/school-plan-types";
import { ActionFeedback } from "./ActionFeedback";

const field = "block w-full rounded-xl border border-slate-300 bg-white px-3 py-2";
const button = "rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold disabled:opacity-50";
const modes = { scheduled: "Run on the scheduled date", teaching: "Teaching days only", staff: "Staff working days" };

export function SchoolPlan({ school, todayOnly = false }: { school: string; todayOnly?: boolean }) {
  const [from, setFrom] = useState(() => lagosLocalDay(Date.now()).slice(0, 8) + "01");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [editing, setEditing] = useState<PlanEntry | "new" | null>(null);
  const [kind, setKind] = useState<PlanKind>("event");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useCallback(async (input?: object, signal?: AbortSignal) => {
    const token = (await createBrowserSupabaseClient()?.auth.getSession())?.data.session?.access_token;
    if (!token) throw new Error("Sign in to open the school plan.");
    const response = await fetch(`/api/khpos/ops/school-plan/${school}?${todayOnly ? "today=1" : "from=" + from}`, {
      method: input ? "POST" : "GET", cache: "no-store", signal,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: input ? JSON.stringify(input) : undefined,
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Could not load the school plan.");
    return body.plan as Plan;
  }, [school, from, todayOnly]);

  useEffect(() => {
    const controller = new AbortController();
    void request(undefined, controller.signal).then(result => {
      if (!controller.signal.aborted) setPlan(result);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [request]);

  async function mutate(input: object, message: string) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { setPlan(await request(input)); setEditing(null); setNotice(message); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save the school plan."); }
    finally { setBusy(false); }
  }

  function save(event: FormEvent<HTMLFormElement>, published: boolean) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const start = String(data.get("start") ?? "");
    const weekly = kind === "weekly_duty" || kind === "weekly_theme";
    const end = weekly && start ? new Date(Date.parse(start) + 6 * 86400000).toISOString().slice(0, 10)
      : kind === "daily_topic" ? start : String(data.get("end") ?? "");
    if (published && (kind === "closure" || kind === "no_lessons") &&
        !window.confirm("Publish these dates? Lessons and calendar-aware duties will pause where applicable. Review any work already assigned separately.")) return;
    void mutate({ action: "save", id: record?.id ?? null, kind, title: data.get("title"),
      campusId: data.get("campus") || null, staffId: data.get("staff") || null,
      assessmentId: data.get("assessment") || null, startDay: start || null, endDay: end || null, published },
      published ? "Calendar entry published." : "Draft saved.");
  }

  const record = editing && editing !== "new" ? editing : null;
  const hasStaff = kind === "weekly_duty" || kind === "invigilation";
  const hasEnd = !["weekly_duty", "weekly_theme", "daily_topic", "invigilation"].includes(kind);
  if (todayOnly && !plan?.entries.length) return null;
  return <section id={todayOnly ? undefined : "school-plan"} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
    <h2 className="text-xl font-black">{todayOnly ? "School plan for today" : "Academic calendar and staff duties"}</h2>
    <ActionFeedback busy={busy} error={error} notice={notice} onDismiss={() => { setError(""); setNotice(""); }} />
    {!todayOnly && <>
      <p className="text-sm text-slate-600">Publish breaks, themes, staff duties and invigilation for your school or campus.</p>
      <label className="block max-w-xs font-bold">Show 92 days from
        <input type="date" className={field} value={from} disabled={busy} onChange={event => {
          if (event.target.value) { setPlan(null); setEditing(null); setFrom(event.target.value); }
        }} />
      </label>
      {!plan && !error && <p role="status">Loading school plan…</p>}
      <p className="text-sm"><Link className="font-bold text-brand-700 underline" href={`/khpos/${school}/academic-delivery`}>Manage term dates in Teaching plans</Link></p>
      {plan?.terms.map(term => <p key={term.id} className="text-sm">{term.session} · {term.name} · {term.start} to {term.end}</p>)}
      {plan?.canManage && !editing && <button type="button" className={button} onClick={() => { setKind("event"); setEditing("new"); }}>Add calendar entry</button>}
    </>}
    {editing && plan?.canManage && <form key={record?.id ?? "new"} className="space-y-3 rounded-xl border p-4" onSubmit={event => {
      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      save(event, submitter?.value === "publish");
    }}>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        <label>Type<select className={field} value={kind} onChange={event => setKind(event.target.value as PlanKind)}>
          {Object.entries(planKinds).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select></label>
        <label>Title<input name="title" className={field} required maxLength={120} defaultValue={record?.title} /></label>
        {kind !== "invigilation" && <label>Campus<select name="campus" className={field} defaultValue={record?.campus_id ?? ""}>
          <option value="">Whole school</option>{plan.campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
        </select></label>}
        {kind === "invigilation" ? <label>Scheduled exam or test<select name="assessment" className={field} required defaultValue={record?.assessment_id ?? ""}>
          <option value="">Choose an assessment</option>{plan.assessments.map(assessment => <option key={assessment.id} value={assessment.id}>{assessment.name} · {new Date(assessment.start).toLocaleString("en-NG", {timeZone:"Africa/Lagos"})}</option>)}
        </select></label> : <label>{hasEnd ? "Start date" : kind === "daily_topic" ? "Date" : "Monday of the week"}
          <input type="date" name="start" className={field} required defaultValue={record?.start_day ?? from} />
        </label>}
        {hasEnd && <label>End date (inclusive)<input type="date" name="end" className={field} required defaultValue={record?.end_day ?? from} /></label>}
        {hasStaff && <label>Assigned staff member<select name="staff" className={field} required defaultValue={record?.staff_id ?? ""}>
          <option value="">Choose staff</option>{plan.staff.map(staff => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
        </select></label>}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={button} disabled={busy} value="publish">Publish entry</button>
        <button type="submit" className={button} disabled={busy} value="draft">Save as draft</button>
        <button type="button" className={button} disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
      </div>
    </form>}
    {plan?.entries.length === 0 && <p className="text-sm text-slate-600">No school plan entries in this date range.</p>}
    <ul className="divide-y divide-slate-200">
      {plan?.entries.map(entry => <li key={entry.id} className="space-y-1 py-3 text-sm">
        <p className="font-bold">{entry.title}{!entry.published && " · Draft"}</p>
        <p>{planKinds[entry.kind]} · {entry.start_day}{entry.end_day !== entry.start_day && ` to ${entry.end_day}`} · {entry.campus_name ?? "Whole school"}</p>
        {entry.staff_name && <p>Assigned to {entry.staff_name}{entry.assessment_title && ` · ${entry.assessment_title}`}</p>}
        {entry.assessment_start && <p>Exam starts {new Date(entry.assessment_start).toLocaleString("en-NG",{timeZone:"Africa/Lagos"})}</p>}
        {plan.canManage && <div className="flex gap-2">
          <button type="button" className={button} disabled={busy} onClick={() => {
            setKind(entry.kind); setEditing(entry);
            document.getElementById("school-plan")?.scrollIntoView({block:"start"});
          }}>Edit</button>
          {entry.published && <button type="button" className={button} disabled={busy} onClick={() => {
            if (window.confirm("Unpublish this entry?")) void mutate({action:"remove",id:entry.id},"Entry unpublished.");
          }}>Unpublish</button>}
        </div>}
      </li>)}
    </ul>
    {plan?.canManage && plan.rules.length > 0 && <details className="space-y-3">
      <summary className="font-bold">When recurring duties run</summary>
      <p className="text-sm">Choose how each rule responds to published closures and days without regular lessons. Already assigned work stays available for review.</p>
      {plan.rules.map(rule => <label key={rule.id} className="block text-sm">{rule.name}
        <select className={field} value={rule.mode} disabled={busy} onChange={event => {
          void mutate({action:"rule",id:rule.id,dayMode:event.target.value},"Duty scheduling updated.");
        }}>{Object.entries(modes).map(([mode,label]) => <option key={mode} value={mode}>{label}</option>)}</select>
      </label>)}
    </details>}
  </section>;
}
