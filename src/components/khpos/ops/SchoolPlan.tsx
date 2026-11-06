"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { lagosLocalDay } from "@/lib/khpos/ops/attendance-guidance";
import { planKinds, type PlanEntry, type PlanKind, type SchoolPlan as Plan } from "@/lib/khpos/ops/school-plan-types";
import { ActionFeedback } from "./ActionFeedback";

const field = "block w-full rounded-xl border border-slate-300 bg-white px-3 py-2";
const button = "rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold disabled:opacity-50";
const groups: { label: string; kinds: PlanKind[] }[] = [
  { label: "School calendar", kinds: ["event", "closure", "no_lessons"] },
  { label: "Weekly plans", kinds: ["weekly_theme", "daily_topic", "weekly_duty"] },
  { label: "Exams and invigilation", kinds: ["exam_period", "invigilation"] },
];
const pageSize = 5;
const dayMs = 86400000;

function mondayOf(day: string) {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

const modes = { scheduled: "Run on the scheduled date", teaching: "Teaching days only", staff: "Staff working days" };

export function SchoolPlan({ school, todayOnly = false }: { school: string; todayOnly?: boolean }) {
  const [from, setFrom] = useState(() => lagosLocalDay(Date.now()).slice(0, 8) + "01");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [editing, setEditing] = useState<PlanEntry | "new" | "document" | null>(null);
  const [kind, setKind] = useState<PlanKind>("event");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("soonest");
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [limit, setLimit] = useState(pageSize);
  const [showArchive, setShowArchive] = useState(false);
  const [includeExamPeriod, setIncludeExamPeriod] = useState(true);
  const [documentRows, setDocumentRows] = useState(1);
  const [todayLimit, setTodayLimit] = useState(10);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const request = useCallback(async (input?: object, signal?: AbortSignal, rangeStart = from) => {
    const token = (await createBrowserSupabaseClient()?.auth.getSession())?.data.session?.access_token;
    if (!token) throw new Error("Sign in to open the school plan.");
    const response = await fetch(`/api/khpos/ops/school-plan/${school}?${todayOnly ? "today=1" : "from=" + rangeStart}`, {
      method: input ? "POST" : "GET", cache: "no-store", signal,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: input ? JSON.stringify(input) : undefined,
    }).catch(error => {
      if (signal?.aborted) throw error;
      throw new Error("Could not reach the school planner. Check your connection and try again.");
    });
    const body = await response.json().catch(() => null);
    if (!body) throw new Error("The school planner did not respond. Try again.");
    if (!response.ok) throw new Error(body.error ?? "Could not load the school plan.");
    return body.plan as Plan;
  }, [school, from, todayOnly]);

  useEffect(() => {
    const controller = new AbortController();
    void request(undefined, controller.signal).then(result => {
      if (!controller.signal.aborted) { setPlan(result); setError(""); }
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [request, retry]);

  async function mutate(input: object, message: string, destination?: { kind: PlanKind; day: string }) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const outsideRange = destination && (destination.day < from || Date.parse(destination.day) - Date.parse(from) > 91 * dayMs);
      const rangeStart = outsideRange ? destination.day : from;
      setPlan(await request(input, undefined, rangeStart));
      if (outsideRange) setFrom(rangeStart);
      if (destination) {
        setSelectedGroup(groups.findIndex(group => group.kinds.includes(destination.kind)));
        setQuery("");
        setSort("soonest");
        setLimit(pageSize);
      }
      setEditing(null);
      setNotice(message);
    }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save the school plan."); }
    finally { setBusy(false); }
  }

  function save(event: FormEvent<HTMLFormElement>, published: boolean) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const start = String(data.get("start") ?? "");
    const weekly = kind === "weekly_duty" || kind === "weekly_theme";
    if (weekly && start && start !== mondayOf(start)) {
      setError("Choose a Monday for a weekly theme or staff duty.");
      return;
    }
    const assessment = plan?.assessments.find(item => item.id === data.get("assessment"));
    const entryDay = assessment ? lagosLocalDay(Date.parse(assessment.start)) : start;
    const end = weekly && start ? new Date(Date.parse(start) + 6 * dayMs).toISOString().slice(0, 10)
      : kind === "daily_topic" ? start : String(data.get("end") ?? "");
    if (published && (kind === "closure" || kind === "no_lessons") &&
        !window.confirm("Publish these dates? Lessons and calendar-aware duties will pause where applicable. Review any work already assigned separately.")) return;
    void mutate({ action: "save", id: record?.id ?? null, kind, title: data.get("title"),
      campusId: data.get("campus") || null, staffId: data.get("staff") || null,
      assessmentId: data.get("assessment") || null, startDay: start || null, endDay: end || null, published },
      published ? "Calendar entry published." : "Draft saved.", { kind, day: entryDay });
  }

  function saveDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const published = submitter?.value === "publish";
    const data = new FormData(event.currentTarget);
    const read = (name: string) => String(data.get(name) ?? "").trim();
    let start = read("documentStart");
    const campusId = read("documentCampus") || null;
    const weekly = selectedGroup === 1;
    if (weekly && start !== mondayOf(start)) {
      setError("Choose a Monday to start the weekly plan.");
      return;
    }
    const entries: { action: "save"; id: null; kind: PlanKind; title: string; campusId: string | null;
      startDay: string | null; endDay: string | null; staffId: string | null; assessmentId: string | null; published: boolean }[] = [];
    function add(entryKind: PlanKind, title: string, startDay: string | null, endDay: string | null, staffId: string | null = null, assessmentId: string | null = null) {
      entries.push({ action: "save", id: null, kind: entryKind, title, campusId, startDay, endDay, staffId, assessmentId, published });
    }
    if (weekly) {
      const dayAt = (offset: number) => new Date(Date.parse(start) + offset * dayMs).toISOString().slice(0, 10);
      if (read("theme")) add("weekly_theme", read("theme"), start, dayAt(6));
      for (let i = 0; i < 7; i++) {
        if (read(`topic-${i}`)) add("daily_topic", read(`topic-${i}`), dayAt(i), dayAt(i));
      }
      for (let i = 0; i < documentRows; i++) {
        if (read(`staff-${i}`)) add("weekly_duty", read(`duty-${i}`) || "Weekly staff duty", start, dayAt(6), read(`staff-${i}`));
        else if (read(`duty-${i}`)) { setError("Choose a teacher for each duty you enter."); return; }
      }
    } else {
      const end = read("documentEnd");
      if (includeExamPeriod && end < start) { setError("The exam period must end on or after its start date."); return; }
      if (includeExamPeriod) add("exam_period", read("documentTitle"), start, end);
      for (let i = 0; i < documentRows; i++) {
        const staff = read(`staff-${i}`);
        const assessment = plan?.assessments.find(item => item.id === read(`assessment-${i}`));
        if (!staff && !assessment) continue;
        if (!staff || !assessment) { setError("Choose both a scheduled test or exam and an invigilator for each assignment."); return; }
        const date = lagosLocalDay(Date.parse(assessment.start));
        if (includeExamPeriod && (date < start || date > end)) { setError("Choose an assessment within the exam period."); return; }
        if (!start || (!includeExamPeriod && date < start)) start = date;
        add("invigilation", assessment.name.slice(0, 120), null, null, staff, assessment.id);
      }
    }
    if (!entries.length) { setError(weekly ? "Enter a theme, daily topic or staff duty before saving." : "Add an exam period or choose an assessment and invigilator."); return; }
    void mutate({ action: "save_document", entries }, published ? "Plan published." : "Plan saved as draft.",
      { kind: weekly ? "weekly_theme" : "exam_period", day: start });
  }

  const record = editing && typeof editing !== "string" ? editing : null;
  const weeklyEntry = kind === "weekly_duty" || kind === "weekly_theme";
  const hasStaff = kind === "weekly_duty" || kind === "invigilation";
  const hasEnd = !["weekly_duty", "weekly_theme", "daily_topic", "invigilation"].includes(kind);
  const group = selectedGroup === null ? null : groups[selectedGroup];
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const entries = (plan?.entries ?? []).filter(entry => {
    const text = [entry.title, planKinds[entry.kind], entry.staff_name, entry.assessment_title,
      entry.campus_name ?? "Whole school", entry.start_day, entry.end_day, entry.published ? "Published" : "Draft"]
      .join(" ").toLowerCase();
    return Boolean(entry.archived_at) === showArchive && Boolean(group?.kinds.includes(entry.kind)) && words.every(word => text.includes(word));
  }).sort((a, b) => {
    const dateOrder = a.start_day.localeCompare(b.start_day);
    const titleOrder = a.title.localeCompare(b.title);
    if (sort === "name") return titleOrder || dateOrder;
    return (sort === "latest" ? -dateOrder : dateOrder) || titleOrder;
  });
  const groupedEntries = new Map<string, PlanEntry[]>();
  for (const entry of entries) {
    const key = entry.document_id ?? entry.id;
    const existing = groupedEntries.get(key);
    if (existing) existing.push(entry);
    else groupedEntries.set(key, [entry]);
  }
  const documents = Array.from(groupedEntries.values());

  function recordActions(entry: PlanEntry, wholeDocument = false, canDelete = !entry.published) {
    const label = wholeDocument ? "plan" : "entry";
    const target = { id: entry.id, ...(wholeDocument ? { documentId: entry.document_id } : {}) };
    return <>
      <button type="button" className={button} disabled={busy} onClick={() => {
        if (entry.archived_at) {
          void mutate({ action: "restore", ...target }, "Restored as draft.");
        } else if (window.confirm(`Archive this ${label}? Published items will stop appearing on Today and affecting the schedule.`)) {
          void mutate({ action: "archive", ...target }, "Archived.");
        }
      }}>{entry.archived_at ? "Restore as draft" : "Archive"}{wholeDocument ? " plan" : ""}</button>
      {canDelete && <button type="button" className={button} disabled={busy} onClick={() => {
        if (window.confirm(`Delete this ${label} from the planner? This cannot be undone here.`)) void mutate({ action: "delete", ...target }, "Deleted.");
      }}>Delete{wholeDocument ? " plan" : ""}</button>}
    </>;
  }

  function renderEntry(entry: PlanEntry) {
    return <li key={entry.id} className="space-y-1 py-3 text-sm">
          <p className="font-bold">{entry.title}{entry.archived_at ? " · Archived" : !entry.published && " · Draft"}</p>
          <p>{planKinds[entry.kind]} · {entry.start_day}{entry.end_day !== entry.start_day && ` to ${entry.end_day}`} · {entry.campus_name ?? "Whole school"}</p>
          {entry.staff_name && <p>Assigned to {entry.staff_name}{entry.assessment_title && ` · ${entry.assessment_title}`}</p>}
          {entry.assessment_start && <p>Exam starts {new Date(entry.assessment_start).toLocaleString("en-NG",{timeZone:"Africa/Lagos"})}</p>}
          {entry.can_edit && <div className="flex flex-wrap gap-2">
            {!entry.archived_at && <button type="button" className={button} disabled={busy} onClick={() => {
              setKind(entry.kind); setEditing(entry);
              document.getElementById("school-plan")?.scrollIntoView({block:"start"});
            }}>Edit</button>}
            {entry.published && <button type="button" className={button} disabled={busy} onClick={() => {
              if (window.confirm("Unpublish this entry?")) void mutate({action:"remove",id:entry.id},"Entry unpublished.");
            }}>Unpublish</button>}
            {recordActions(entry)}
          </div>}
        </li>;
  }

  const todayEntries = plan?.entries.filter(entry => entry.kind !== "invigilation") ?? [];
  if (todayOnly && !todayEntries.length) return null;
  return <section id={todayOnly ? undefined : "school-plan"} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
    <h2 className="text-xl font-black">{todayOnly ? "School plan for today" : "Academic calendar and staff duties"}</h2>
    <ActionFeedback busy={busy} error={error} notice={notice} onDismiss={() => { setError(""); setNotice(""); }} />
    {!todayOnly && <>
      <p className="text-sm text-slate-600">Publish breaks, themes, staff duties and invigilation for your school or campus.</p>
      <label className="block max-w-xs font-bold">Show 92 days from
        <input type="date" className={field} value={from} disabled={busy} onChange={event => {
          if (event.target.value) { setPlan(null); setEditing(null); setLimit(pageSize); setFrom(event.target.value); }
        }} />
      </label>
      {!plan && !error && <p role="status">Loading school plan…</p>}
      {!plan && error && <button type="button" className={button} onClick={() => { setError(""); setRetry(value => value + 1); }}>Retry loading planner</button>}
      <p className="text-sm"><Link className="font-bold text-brand-700 underline" href={`/khpos/${school}/academic-delivery`}>Manage term dates in Teaching plans</Link></p>
      {plan?.terms.map(term => <p key={term.id} className="text-sm">{term.session} · {term.name} · {term.start} to {term.end}</p>)}
      {plan && !plan.canManage && <p className="text-sm text-slate-600">Your access is view-only. A school custodian, campus guardian or academic inspector can add entries within their assigned scope.</p>}
      {plan?.canManage && !editing && group && <button type="button" className={button} onClick={() => {
        setKind(group.kinds[0]); setDocumentRows(1); setIncludeExamPeriod(true); setShowArchive(false); setEditing(selectedGroup === 0 ? "new" : "document");
      }}>{selectedGroup === 0 ? "Add calendar entry" : selectedGroup === 1 ? "New weekly plan" : "New exam plan"}</button>}
    </>}
    {editing === "document" && plan?.canManage && <form className="space-y-4 rounded-xl border p-4" onSubmit={saveDocument}>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-3 font-bold">{selectedGroup === 1 ? "Weekly plan" : "Exam plan"}</legend>
        {selectedGroup === 2 && <label className="sm:col-span-2"><input type="checkbox" checked={includeExamPeriod} onChange={event => setIncludeExamPeriod(event.target.checked)} /> Include an exam period</label>}
        {(selectedGroup === 1 || includeExamPeriod) && <label>{selectedGroup === 1 ? "Monday of the week" : "Exam period starts"}
          <input type="date" name="documentStart" required className={field} defaultValue={selectedGroup === 1 ? mondayOf(from) : from} />
        </label>}
        <label>Campus<select name="documentCampus" className={field}>
          {plan.canManageWholeSchool && <option value="">Whole school</option>}
          {plan.campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
        </select></label>
        {selectedGroup === 1 ? <>
          <label className="sm:col-span-2">Weekly theme<input name="theme" maxLength={120} className={field} /></label>
          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day, index) =>
            <label key={day}>{day} topic<input name={`topic-${index}`} maxLength={120} className={field} /></label>)}
        </> : <>
          {includeExamPeriod && <><label>Exam period title<input name="documentTitle" required maxLength={120} className={field} /></label>
          <label>Exam period ends<input type="date" name="documentEnd" required className={field} defaultValue={from} /></label></>}
          {!plan.assessments.length && <p className="text-sm sm:col-span-2">No assessments are scheduled in this calendar date range. Open Tests and exams to schedule one, or choose a calendar date range that includes it. <Link className="font-bold underline" href={`/khpos/${school}/teaching-presence?tab=exams`}>Open Tests and exams</Link></p>}
        </>}
        <>
          {Array.from({ length: documentRows }, (_, index) => <fieldset key={index} className="grid gap-2 rounded-xl border p-3 sm:col-span-2 sm:grid-cols-2">
            <legend className="px-1 text-sm font-bold">{selectedGroup === 1 ? "Staff duty" : "Invigilation"} {index + 1}</legend>
            {selectedGroup === 1 ? <label>Duty<input name={`duty-${index}`} maxLength={120} className={field} /></label>
              : <label>Scheduled test or exam<select name={`assessment-${index}`} className={field} disabled={!plan.assessments.length}>
                <option value="">{plan.assessments.length ? "Choose an assessment" : "No scheduled assessments in this date range"}</option>
                {plan.assessments.map(item => <option key={item.id} value={item.id}>{item.name} · {lagosLocalDay(Date.parse(item.start))}</option>)}
              </select></label>}
            <label>{selectedGroup === 1 ? "Teacher on duty" : "Invigilator"}<select name={`staff-${index}`} className={field} disabled={selectedGroup !== 1 && !plan.assessments.length}>
              <option value="">Choose staff</option>
              {plan.staff.map(staff => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
            </select></label>
          </fieldset>)}
          {documentRows < 50 && (selectedGroup === 1 || plan.assessments.length > 0) && <button type="button" className={button} onClick={() => setDocumentRows(count => count + 1)}>
            {selectedGroup === 1 ? "Add another duty" : "Add another invigilator"}
          </button>}
        </>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={button} value="publish" disabled={busy}>Publish plan</button>
        <button type="submit" className={button} value="draft" disabled={busy}>Save plan as draft</button>
        <button type="button" className={button} disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
      </div>
    </form>}
    {editing && editing !== "document" && plan?.canManage && <form key={record?.id ?? "new"} className="space-y-3 rounded-xl border p-4" onSubmit={event => {
      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      save(event, submitter?.value === "publish");
    }}>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        <label>Type<select className={field} value={kind} onChange={event => setKind(event.target.value as PlanKind)}>
          {Object.entries(planKinds).filter(([key]) => group?.kinds.includes(key as PlanKind)).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select></label>
        <label>Title<input name="title" className={field} required maxLength={120} defaultValue={record?.title} /></label>
        {kind !== "invigilation" && <label>Campus<select name="campus" className={field} defaultValue={record?.campus_id ?? (plan.canManageWholeSchool ? "" : plan.campuses[0]?.id)}>
          {plan.canManageWholeSchool && <option value="">Whole school</option>}{plan.campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
        </select></label>}
        {kind === "invigilation" ? <label>Scheduled exam or test<select name="assessment" className={field} required defaultValue={record?.assessment_id ?? ""}>
          <option value="">{plan.assessments.length ? "Choose an assessment" : "No scheduled tests or exams in this date range"}</option>{plan.assessments.map(assessment => <option key={assessment.id} value={assessment.id}>{assessment.name} · {new Date(assessment.start).toLocaleString("en-NG", {timeZone:"Africa/Lagos"})}</option>)}
        </select></label> : <label>{hasEnd ? "Start date" : kind === "daily_topic" ? "Date" : "Monday of the week"}
          <input key={weeklyEntry ? "week" : "day"} type="date" name="start" className={field} required defaultValue={record?.start_day ?? (weeklyEntry ? mondayOf(from) : from)} />
        </label>}
        {hasEnd && <label>End date (inclusive)<input type="date" name="end" className={field} required defaultValue={record?.end_day ?? from} /></label>}
        {hasStaff && <label>Assigned staff member<select name="staff" className={field} required defaultValue={record?.staff_id ?? ""}>
          <option value="">Choose staff</option>{plan.staff.map(staff => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
        </select></label>}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={button} disabled={busy || (kind === "invigilation" && !plan.assessments.length)} value="publish">Publish entry</button>
        <button type="submit" className={button} disabled={busy || (kind === "invigilation" && !plan.assessments.length)} value="draft">Save as draft</button>
        <button type="button" className={button} disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
      </div>
    </form>}
    {plan && !todayOnly && !group && <div className="grid gap-3 sm:grid-cols-2">
      {groups.map(({ label, kinds }, index) => {
        const count = plan.entries.filter(entry => kinds.includes(entry.kind) && !entry.archived_at).length;
        return <button key={label} type="button"
          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left hover:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-600"
          onClick={() => { setSelectedGroup(index); setShowArchive(false); setQuery(""); setLimit(pageSize); }}>
          <span><span className="block font-black">{label}</span><span className="text-sm text-slate-600">{count} {count === 1 ? "entry" : "entries"}</span></span>
          <span aria-hidden="true">→</span>
        </button>;
      })}
    </div>}
    {plan && !todayOnly && group && <section aria-label={group.label} className="space-y-4">
      <button type="button" className={button}
        onClick={() => { setSelectedGroup(null); setEditing(null); }}>← All planner groups</button>
      <h3 className="text-lg font-black">{group.label}</h3>
      {plan.canManage && <button type="button" className={button} onClick={() => { setShowArchive(!showArchive); setLimit(pageSize); }}>
        {showArchive ? "Show current records" : "Show archived records"}
      </button>}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <label className="text-sm font-bold">Search {todayOnly ? "today’s plan" : "this date range"}
          <input type="search" className={field} placeholder="Title, teacher, campus or date" value={query}
            onChange={event => { setQuery(event.target.value); setLimit(pageSize); }} />
        </label>
        <label className="text-sm font-bold">Sort by
          <select className={field} value={sort} onChange={event => { setSort(event.target.value); setLimit(pageSize); }}>
            <option value="soonest">Earliest date</option>
            <option value="latest">Latest date</option>
            <option value="name">Title A–Z</option>
          </select>
        </label>
      </div>
      {!entries.length && <p role="status" className="text-sm text-slate-600">
        {query.trim() ? "No entries match your search." : "No entries in this group for the selected dates."}
      </p>}
      <ul className="divide-y divide-slate-200">
        {documents.slice(0, limit).map(items => {
          const first = items[0];
          if (!first.document_id) return renderEntry(first);
          const heading = items.find(entry => entry.kind === "weekly_theme" || entry.kind === "exam_period") ?? first;
          const date = selectedGroup === 1 ? mondayOf(heading.start_day) : heading.start_day;
          return <li key={first.document_id} className="py-3">
            <details>
              <summary className="cursor-pointer font-bold">
                {selectedGroup === 1 ? `Week of ${date}` : heading.title} · {heading.campus_name ?? "Whole school"}
                <span className="ml-2 text-sm font-normal text-slate-600">{items.length} {items.length === 1 ? "entry" : "entries"}</span>
              </summary>
              {items.every(item => item.can_edit) && <div className="mt-2 flex flex-wrap gap-2">{recordActions(first, true, items.every(item => !item.published))}</div>}
              <ul className="mt-2 divide-y pl-4">{items.map(renderEntry)}</ul>
            </details>
          </li>;
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        {documents.length > limit && <button type="button" className={button}
          onClick={() => setLimit(limit + pageSize)}>Show {Math.min(pageSize, documents.length - limit)} more</button>}
        {limit > pageSize && <button type="button" className={button}
          onClick={() => setLimit(pageSize)}>Show fewer</button>}
      </div>
    </section>}
    {todayOnly && plan && <>
      <label className="block max-w-xs text-sm font-bold">Show active entries
        <select className={field} value={todayLimit} onChange={event => setTodayLimit(Number(event.target.value))}>
          {[10, 20, 50, 100, 250].map(count => <option key={count} value={count}>{count}</option>)}
        </select>
      </label>
      <ul className="divide-y divide-slate-200">
        {todayEntries.slice(0, todayLimit).map(entry => <li key={entry.id} className="py-3 text-sm">
          <p className="font-bold">{entry.title}</p>
          <p>{planKinds[entry.kind]} · {entry.campus_name ?? "Whole school"}</p>
          {entry.staff_name && <p>Assigned to {entry.staff_name}</p>}
          {entry.assessment_start && <p>Starts at {new Date(entry.assessment_start).toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit" })}</p>}
        </li>)}
      </ul>
      <p className="text-sm text-slate-600">Showing {Math.min(todayLimit, todayEntries.length)} of {todayEntries.length} active entries</p>
    </>}
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
