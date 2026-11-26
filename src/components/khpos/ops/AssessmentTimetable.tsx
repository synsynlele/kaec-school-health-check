"use client";


import Link from "next/link";
import { LinkPending } from "@/components/navigation/LinkPending";
import { actionDestination } from "@/components/khpos/actionDestination";
import { ActionFeedback } from "./ActionFeedback";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { lagosLocalDay } from "@/lib/khpos/ops/attendance-guidance";
import { findExamCollisions } from "@/lib/khpos/ops/schedule-assist";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Assignment = { id: string; classLabel: string; subjectLabel: string; teacherDisplay: string };
type Entry = {
  cancelled_at: string | null; can_cancel: boolean;
  id: string; stream_id: string; can_edit: boolean; kind: string; title: string; starts_at: string; ends_at: string;
  checked_in_at: string | null; checked_out_at: string | null; marked_at: string | null;
  submitted_at: string | null; submitted_to: string | null; mine: boolean;
  invigilation_attendance?: { id: string; name: string; mine: boolean; published: boolean; in: string | null; out: string | null; note: string | null }[];
  invigilators?: string[]; my_invigilation?: boolean; can_manage_coverage?: boolean;
  class_label: string; subject_label: string; teacher: string;
};

function monday(day: string) {
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

const field = "block w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm text-slate-900";
const headings = ["Date", "Time (WAT)", "Class", "Subject", "Test or exam", "Type", "Invigilators"];
const dateLabel = new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", year: "numeric" });
const timeLabel = new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const button = "rounded-lg bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";

function stamp(value: string) {
  return new Date(value).toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });
}

export function AssessmentTimetable({ school, today, assignments = [], todayInvigilation = false }: {
  school: string; today?: string; assignments?: Assignment[]; todayInvigilation?: boolean;
}) {
  const [selectedDay, setSelectedDay] = useState(() => today ?? lagosLocalDay(Date.now()));
  const week = monday(selectedDay);
  const [weeks, setWeeks] = useState(1);
  const [kindFilter, setKindFilter] = useState("all");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
  const [cancelSelection, setCancelSelection] = useState<string[]>([]);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [now, setNow] = useState(Date.now);
  const localDay = lagosLocalDay(now);
  const from = todayInvigilation ? localDay : week;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const request = useCallback(async (input?: object, signal?: AbortSignal) => {
    const token = (await createBrowserSupabaseClient()?.auth.getSession())?.data.session?.access_token;
    if (!token) throw new Error("Sign in to view the timetable.");
    const response = await fetch(`/api/khpos/ops/assessment-timetable/${school}?from=${from}&weeks=${todayInvigilation ? 1 : weeks}&includeCancelled=${!todayInvigilation}`, {
      method: input ? "POST" : "GET",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: input ? JSON.stringify({ ...input, from }) : undefined,
      cache: "no-store",
      signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load the timetable.");
    return result.entries as Entry[];
  }, [school, from, todayInvigilation, weeks]);

  useEffect(() => {
    const controller = new AbortController();
    request(undefined, controller.signal).then(result => {
      if (!controller.signal.aborted) setEntries(result);
    }).catch(error => {
      if (!controller.signal.aborted) setError(error.message);
    });
    return () => controller.abort();
  }, [request]);

  async function save(input: { mode: string } & Record<string, unknown>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await request(input);
      setEntries(weeks === 1 ? result : await request());
      setNotice(input.mode === "cancel" ? "Selected papers cancelled." : "Assessment timetable updated.");
      setCancelSelection([]);
      setEditing(null);
      setSelectedStreams([]);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save the timetable.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const day = editing ? String(fields.get("day")) : selectedDay;
    const kind = String(fields.get("kind"));
    const start = String(fields.get("start"));
    const end = String(fields.get("end"));
    if (end <= start) {
      setError("Choose an end time after the start.");
      return;
    }
    const schedule = { kind, startsAt: `${day}T${start}:00+01:00`, endsAt: `${day}T${end}:00+01:00` };
    if (editing) {
      void save({ mode: "edit", id: editing.id, ...schedule,
        streamId: fields.get("streamId"), title: String(fields.get("title") ?? "").trim() || editing.title });
      return;
    }
    const papers = assignments.filter(item => selectedStreams.includes(item.id)).map(item => ({
      streamId: item.id,
      title: (String(fields.get("title") ?? "").trim() || `${item.classLabel} ${item.subjectLabel} ${kind}`).slice(0, 120),
    }));
    if (!papers.length) { setError("Choose at least one class and subject."); return; }
    void save({ mode: "add_batch", ...schedule, papers });
  }

  const rangeEnd = new Date(Date.parse(from) + (weeks * 7 - 1) * 86400000).toISOString().slice(0, 10);
  const filteredEntries = (entries ?? []).filter(item => kindFilter === "all" || item.kind === kindFilter);
  const cancelledPapers = filteredEntries.filter(item => item.cancelled_at);
  const timetableRows = filteredEntries.filter(item => !item.cancelled_at).map(item => ({
    item,
    cells: [
      dateLabel.format(new Date(item.starts_at)),
      timeLabel.format(new Date(item.starts_at)) + "–" + timeLabel.format(new Date(item.ends_at)),
      item.class_label, item.subject_label, item.title,
      item.kind.slice(0, 1).toUpperCase() + item.kind.slice(1),
      item.invigilators?.join(", ") || "No published assignment",
    ],
  }));

  const cancellableOnDate = timetableRows.map(row => row.item).filter(item =>
    item.can_cancel && lagosLocalDay(Date.parse(item.starts_at)) === selectedDay);
  const selectedPaperIds = cancellableOnDate.filter(item => cancelSelection.includes(item.id)).map(item => item.id);
  const hasActions = timetableRows.some(({ item }) => item.can_cancel || item.can_manage_coverage || (item.can_edit && assignments.length > 0));

  function cancelPapers(ids: string[], day: string) {
    if (!ids.length || pending.current) return;
    const papers = ids.length === 1 ? "this paper" : `these ${ids.length} papers`;
    if (window.confirm(`Cancel ${papers}? Attendance and reports will stay in history.`)) {
      void save({ mode: "cancel", ids, day });
    }
  }

  function paperActions(item: Entry) {
    const canEdit = item.can_edit && assignments.length > 0;
    if (!item.can_cancel && !item.can_manage_coverage && !canEdit) return null;
    return <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {item.can_manage_coverage && <Link className="inline-flex min-h-10 items-center gap-1 font-semibold text-brand-700 underline"
        href={`/khpos/${school}/calendar?plan=exams&paper=${item.id}&day=${lagosLocalDay(Date.parse(item.starts_at))}#school-plan`}>
        Assign invigilators <LinkPending />
      </Link>}
      {canEdit && <button type="button" className="min-h-10 text-left font-semibold text-brand-700 underline disabled:opacity-50"
        disabled={busy} onClick={() => setEditing(item)}>Edit schedule</button>}
      {item.can_cancel && <button type="button" className="min-h-10 text-left font-semibold text-red-700 underline disabled:opacity-50"
        disabled={busy} onClick={() => cancelPapers([item.id], lagosLocalDay(Date.parse(item.starts_at)))}>Cancel paper</button>}
    </div>;
  }

  async function download() {
    if (pending.current || !timetableRows.length) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("Preparing the timetable PDF…");
    try {
      const { downloadTimetablePdf } = await import("@/lib/khpos/ops/timetable-pdf");
      await downloadTimetablePdf(headings, timetableRows.map(row => row.cells), {
        title: "KHP-OS  |  Test and exam timetable",
        subtitle: `${from} to ${rangeEnd}  |  Lagos time (WAT)  |  Published invigilators`,
        filename: `KHP-OS-exam-timetable-${from}.pdf`,
        widths: [105, 82, 80, 110, 145, 75, 189],
      });
      setNotice("Timetable PDF downloaded.");
    } catch {
      setNotice("");
      setError("The timetable PDF could not be downloaded. Try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const examConflicts = !todayInvigilation ? findExamCollisions((entries ?? []).filter(item => !item.cancelled_at)) : [];
  const editStart = editing ? new Date(Date.parse(editing.starts_at) + 3600000).toISOString() : "";
  const editEnd = editing ? new Date(Date.parse(editing.ends_at) + 3600000).toISOString() : "";
  const visibleEntries = todayInvigilation ? entries?.filter(item =>
    lagosLocalDay(Date.parse(item.starts_at)) === localDay &&
    item.invigilation_attendance?.some(duty => duty.mine && (duty.published || duty.in)),
  ) : timetableRows.map(row => row.item).filter(item => item.mine || item.invigilation_attendance?.length);
  if (todayInvigilation && !error && !visibleEntries?.length) return null;
  return <section className="min-w-0 space-y-4 rounded-2xl border bg-white p-3 text-slate-900 sm:p-4">
    <h2 className="text-xl font-bold">{todayInvigilation ? "My invigilation today" : "Tests and exams timetable"}</h2>
    {!todayInvigilation && <div className="rounded-xl bg-slate-50 p-3 text-sm">
      <ol className="list-decimal space-y-1 pl-5">
        <li>Choose the exam date, then select the class and subject assignments that share a time slot.</li>
        <li><Link className="inline-flex items-center gap-2 font-semibold text-brand-700 underline" href={`/khpos/${school}/calendar?plan=exams#school-plan`}>Open Calendar to assign and publish invigilators <LinkPending /></Link>, or use the link beside a scheduled paper.</li>
        <li>Return here to check names and download the timetable.</li>
      </ol>
    </div>}
    {examConflicts.length>0&&<section className="rounded-xl border border-amber-300 bg-amber-50 p-3">
      <h3 className="font-black text-amber-950">Review {examConflicts.length} scheduling conflict{examConflicts.length===1?"":"s"}</h3>
      <p className="mt-2 text-xs text-amber-900">KHP-OS detected overlapping class schedules or assigned invigilators in your authorised timetable. Confirm independently and edit the timetable if necessary.</p>
      <ul className="mt-2 space-y-2">{examConflicts.slice(0,8).map(item=><li key={item.id} className="text-sm text-amber-950">{item.firstTitle} / {item.secondTitle}: {item.reason}</li>)}</ul>
    </section>}

    {!todayInvigilation && <div className="flex flex-wrap items-end gap-3"><label className="block max-w-xs text-sm font-bold">Exam or test date
      <input type="date" value={selectedDay} disabled={busy} className={field} onChange={event => {
        if (event.target.value) {
          const selectedWeek = monday(event.target.value);
          if (selectedWeek !== from) { setEntries(null); setError(""); setEditing(null); }
          setCancelSelection([]);
          setSelectedDay(event.target.value);
        }
      }} />
    </label>
      <label className="text-sm font-bold">Weeks to show
        <select className={field} value={weeks} disabled={busy} onChange={event => {
          setEntries(null); setError(""); setEditing(null); setWeeks(Number(event.target.value));
        }}>{[1, 2, 3, 4, 5, 6].map(value => <option key={value} value={value}>{value}</option>)}</select>
      </label>
      <label className="text-sm font-bold">Show
        <select className={field} value={kindFilter} disabled={busy} onChange={event => { setKindFilter(event.target.value); setCancelSelection([]); }}>
          <option value="all">All tests and exams</option><option value="exam">Exams only</option>
          <option value="test">Tests only</option><option value="assessment">Other assessments</option>
        </select>
      </label>
      <button type="button" className={button} disabled={busy || !timetableRows.length} onClick={() => void download()}>Download timetable PDF</button>
    </div>}
    {!todayInvigilation && assignments.length > 0 && <details className="rounded-xl border p-3" open={editing ? true : undefined}>
      <summary className="cursor-pointer font-bold">{editing ? "Edit test, assessment or exam" : "Add a test, assessment or exam"}</summary>
      <form {...(editing ? actionDestination : {})} id="assessment-schedule-form" key={editing?.id ?? from} onSubmit={add} className="mt-3">
        <fieldset disabled={busy || entries === null} className="grid gap-3 sm:grid-cols-2">
          {!editing && <p className="sm:col-span-2 text-sm font-semibold">Scheduling for {dateLabel.format(new Date(selectedDay + "T12:00:00Z"))}</p>}
          {editing ? <label>Class, subject and teacher<select name="streamId" className={field} required defaultValue={editing?.stream_id ?? ""}>
            <option value="">Choose class and subject</option>
            {assignments.map(item => <option key={item.id} value={item.id}>{item.classLabel} · {item.subjectLabel} · {item.teacherDisplay}</option>)}
          </select></label> : <fieldset className="sm:col-span-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-bold">Classes and subjects</legend>
            <p className="mb-2 text-sm text-slate-600">Tick the papers that should start and finish together. Up to 30 per save.</p>
            <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
              {assignments.map(item => <label key={item.id} className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={selectedStreams.includes(item.id)} disabled={selectedStreams.length >= 30 && !selectedStreams.includes(item.id)}
                  onChange={event => setSelectedStreams(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />
                <span>{item.classLabel} · {item.subjectLabel} · {item.teacherDisplay}</span>
              </label>)}
            </div>
          </fieldset>}
          <label>Type<select name="kind" className={field} defaultValue={editing?.kind ?? "test"}><option value="test">Test</option><option value="assessment">Assessment</option><option value="exam">Exam</option></select></label>
          <label>{editing ? "Paper name" : "Shared paper name (optional)"}<input name="title" className={field} defaultValue={editing?.title} placeholder="e.g. Mathematics Paper 1" maxLength={120} /></label>
          {editing && <label>Reschedule date<input type="date" name="day" className={field} required defaultValue={editStart.slice(0, 10)} /></label>}
          <label>Start time (WAT)<input type="time" name="start" className={field} defaultValue={editStart.slice(11, 16)} required /></label>
          <label>End time (WAT)<input type="time" name="end" className={field} defaultValue={editEnd.slice(11, 16)} required /></label>
          <button className={button} type="submit">{editing ? "Save changes" : selectedStreams.length ? `Schedule ${selectedStreams.length} paper${selectedStreams.length === 1 ? "" : "s"}` : "Save to timetable"}</button>
          {editing && <button type="button" onClick={() => setEditing(null)}>Cancel edit</button>}
        </fieldset>
      </form>
    </details>}
      <ActionFeedback busy={busy} error={error} notice={notice} onDismiss={() => { setError(""); setNotice(""); }} />
    {!todayInvigilation && cancellableOnDate.length > 1 && <details className="rounded-xl border p-3">
      <summary className="cursor-pointer font-bold">Cancel papers on {dateLabel.format(new Date(selectedDay + "T12:00:00Z"))}</summary>
      <fieldset disabled={busy} className="mt-3 space-y-2">
        <legend className="sr-only">Papers to cancel</legend>
        <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
          {cancellableOnDate.map(item => <label key={item.id} className="flex items-start gap-2 break-words text-sm">
            <input type="checkbox" checked={cancelSelection.includes(item.id)}
              disabled={selectedPaperIds.length >= 50 && !cancelSelection.includes(item.id)}
              onChange={event => {
                const checked = event.target.checked;
                setCancelSelection(current => checked ? [...current, item.id] : current.filter(id => id !== item.id));
              }} />
            <span>{timeLabel.format(new Date(item.starts_at))} · {item.class_label} · {item.subject_label} · {item.title}</span>
          </label>)}
        </div>
        <button type="button" className={button} disabled={!selectedPaperIds.length}
          onClick={() => cancelPapers(selectedPaperIds, selectedDay)}>Cancel selected papers{selectedPaperIds.length ? ` (${selectedPaperIds.length})` : ""}</button>
      </fieldset>
    </details>}
    {!entries && !error && <p role="status" className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Fetching scheduled tests and exams.</p>}
    {!todayInvigilation && !!entries && (timetableRows.length ? <>
      <ul aria-label="Tests and exams timetable" className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:hidden">
        {timetableRows.map(({ item, cells }) => {
          const [date, time, className, subject, title, kind, invigilators] = cells;
          return <li key={item.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold text-brand-700">{date}</span>
              <span className="whitespace-nowrap tabular-nums text-slate-600">{time} WAT</span>
            </div>
            <h3 className="mt-2 break-words text-base font-bold leading-snug">{title}</h3>
            <p className="mt-1 break-words text-sm text-slate-700">{className} · {subject} · {kind}</p>
            <dl className="mt-3 border-t border-slate-100 pt-2 text-sm">
              <dt className="font-semibold">Invigilators</dt>
              <dd className="mt-1 break-words text-slate-700">{invigilators}</dd>
            </dl>
            {paperActions(item)}
          </li>;
        })}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border xl:block">
        <table className="w-full min-w-[860px] text-left text-sm">
          <caption className="sr-only">Tests and exams with published invigilator names</caption>
          <thead className="bg-slate-100"><tr>
            {headings.map(heading => <th key={heading} scope="col" className="px-3 py-2">{heading}</th>)}
            {hasActions && <th scope="col" className="px-3 py-2">Actions</th>}
          </tr></thead>
          <tbody className="divide-y">{timetableRows.map(({ item, cells }) => <tr key={item.id}>
            {cells.map((cell, index) => <td key={headings[index]} className={index < 2 ? "whitespace-nowrap px-3 py-2 align-top" : "break-words px-3 py-2 align-top"}>{cell}</td>)}
            {hasActions && <td className="min-w-36 px-3 py-2 align-top">{paperActions(item)}</td>}
          </tr>)}</tbody>
        </table>
      </div>
    </> : <p>No tests or exams match this timetable view.</p>)}
    {!todayInvigilation && cancelledPapers.length > 0 && <details className="rounded-xl border p-3">
      <summary className="cursor-pointer font-bold">Cancelled papers ({cancelledPapers.length})</summary>
      <ul className="mt-3 divide-y text-sm">
        {cancelledPapers.map(item => <li key={item.id} className="space-y-2 break-words py-3">
          <h3 className="font-bold">{item.title} · {item.class_label} · {item.subject_label}</h3>
          <p>{stamp(item.starts_at)} WAT{item.cancelled_at && ` · Cancelled ${stamp(item.cancelled_at)}`}</p>
          {item.checked_in_at && <p>Teacher check-in {stamp(item.checked_in_at)}{item.checked_out_at && ` · Check-out ${stamp(item.checked_out_at)}`}</p>}
          {item.marked_at && <p>Marking finished {stamp(item.marked_at)}</p>}
          {item.submitted_at && <p>Submitted {stamp(item.submitted_at)}{item.submitted_to && ` · ${item.submitted_to}`}</p>}
          {item.invigilation_attendance?.map(duty => <div key={duty.id} className="rounded-lg border p-2">
            <p className="font-semibold">{duty.name}</p>
            {duty.in && <p>Check-in {stamp(duty.in)}{duty.out && ` · Check-out ${stamp(duty.out)}`}</p>}
            {duty.note && <p className="whitespace-pre-wrap">Exam report · {duty.note}</p>}
          </div>)}
        </li>)}
      </ul>
    </details>}
    {visibleEntries?.map(item => {
      const canStart = now >= Date.parse(item.starts_at) - 1800000 && now <= Date.parse(item.ends_at) + 1800000;
      return <details key={item.id} open={todayInvigilation ? true : undefined} className="min-w-0 space-y-2 break-words rounded-xl border p-3 text-sm">
        <summary className="cursor-pointer font-bold">{item.title} · {item.class_label} · Attendance and marking</summary>
        <h3 className="font-bold">{item.title} · {item.class_label} · {item.subject_label}</h3>
        {!todayInvigilation && <p className="capitalize">{item.kind} · {item.teacher}</p>}
        <p>{stamp(item.starts_at)} to {stamp(item.ends_at)} WAT</p>
        {!todayInvigilation && !!item.invigilators?.length && <p><span className="font-bold">Invigilators</span> · {item.invigilators.join(", ")}{item.my_invigilation && " · You are assigned"}</p>}
        {!todayInvigilation && item.can_manage_coverage && item.invigilators?.length === 0 && <p className="font-bold text-amber-800">Invigilator needed</p>}
        {!todayInvigilation && <p>Assigned teacher check-in {item.checked_in_at ? stamp(item.checked_in_at) : "pending"} · Check-out {item.checked_out_at ? stamp(item.checked_out_at) : "pending"}</p>}
        {item.invigilation_attendance?.filter(duty => !todayInvigilation || duty.mine).map(duty => <section key={duty.id} className="space-y-2 rounded-lg border border-slate-200 p-3">
          <h4 className="font-bold">Invigilation attendance · {duty.name}</h4>
          <p>Check-in {duty.in ? stamp(duty.in) : "pending"} · Check-out {duty.out ? stamp(duty.out) : "pending"}</p>
          {duty.note && <p className="whitespace-pre-wrap break-words">Exam report · {duty.note}</p>}
          {duty.mine && duty.published && !duty.in && (canStart
            ? <button type="button" disabled={busy} className={button}
                onClick={() => void save({ mode: "invigilator_start", id: item.id })}>Check in as invigilator</button>
            : <p>Invigilator check-in opens 30 minutes before the assessment.</p>)}
          {todayInvigilation && duty.mine && duty.in && !duty.out && now < Date.parse(item.ends_at) && <p>Check-out opens at the scheduled end time.</p>}
          {duty.mine && duty.in && !duty.out && (!todayInvigilation || now >= Date.parse(item.ends_at)) && <form className="space-y-2" onSubmit={event => {
            event.preventDefault();
            void save({ mode: "invigilator_finish", id: item.id, note: new FormData(event.currentTarget).get("note") });
          }}>
            <label>Exam report or comment
              <textarea name="note" className={field} required maxLength={2000}
                placeholder="Summarise how it went, or enter No issues. Leave out learner names." />
            </label>
            <button type="submit" disabled={busy} className={button}>Submit report and check out</button>
          </form>}
        </section>)}
        {!todayInvigilation && item.marked_at && <p>Marking finished {stamp(item.marked_at)}</p>}
        {!todayInvigilation && item.submitted_at && <p>Submitted to {item.submitted_to} · {stamp(item.submitted_at)}</p>}
        {!todayInvigilation && item.mine && !item.checked_in_at && canStart && <button disabled={busy} className={button} onClick={() => void save({ mode: "start", id: item.id })}>Check in</button>}
        {!todayInvigilation && item.mine && item.checked_in_at && !item.checked_out_at && <button disabled={busy} className={button} onClick={() => void save({ mode: "finish", id: item.id })}>Check out</button>}
        {!todayInvigilation && item.mine && item.checked_out_at && !item.marked_at && <button disabled={busy} className={button} onClick={() => void save({ mode: "mark", id: item.id })}>Marking finished</button>}
        {!todayInvigilation && item.mine && item.marked_at && !item.submitted_at && <form onSubmit={event => {
          event.preventDefault();
          void save({ mode: "submit", id: item.id, recipient: new FormData(event.currentTarget).get("recipient") });
        }} className="space-y-2">
          <label>Submitted to<input name="recipient" className={field} required maxLength={120} /></label>
          <button type="submit" disabled={busy} className={button}>Record submission</button>
        </form>}
      </details>;
    })}
  </section>;
}
