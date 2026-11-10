"use client";


import { ActionFeedback } from "./ActionFeedback";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { lagosLocalDay } from "@/lib/khpos/ops/attendance-guidance";
import { findExamCollisions } from "@/lib/khpos/ops/schedule-assist";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Assignment = { id: string; classLabel: string; subjectLabel: string; teacherDisplay: string };
type Entry = {
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

const field = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const button = "rounded-lg bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";

function stamp(value: string) {
  return new Date(value).toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });
}

export function AssessmentTimetable({ school, today, assignments = [], todayInvigilation = false }: {
  school: string; today?: string; assignments?: Assignment[]; todayInvigilation?: boolean;
}) {
  const [week, setWeek] = useState(() => monday(today ?? lagosLocalDay(Date.now())));
  const [entries, setEntries] = useState<Entry[] | null>(null);
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
    const response = await fetch(`/api/khpos/ops/assessment-timetable/${school}?from=${from}`, {
      method: input ? "POST" : "GET",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: input ? JSON.stringify({ ...input, from }) : undefined,
      cache: "no-store",
      signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load the timetable.");
    return result.entries as Entry[];
  }, [school, from]);

  useEffect(() => {
    const controller = new AbortController();
    request(undefined, controller.signal).then(result => {
      if (!controller.signal.aborted) setEntries(result);
    }).catch(error => {
      if (!controller.signal.aborted) setError(error.message);
    });
    return () => controller.abort();
  }, [request]);

  async function save(input: object) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setEntries(await request(input));
      setNotice("Assessment timetable updated.");
      setEditing(null);
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
    const day = String(fields.get("day"));
    const start = String(fields.get("start"));
    const end = String(fields.get("end"));
    if ((!editing && monday(day) !== from) || end <= start) {
      setError(end <= start ? "Choose an end time after the start." : "Choose a date in the displayed week.");
      return;
    }
    void save({ mode: editing ? "edit" : "add", id: editing?.id, title: fields.get("title"), streamId: fields.get("streamId"), kind: fields.get("kind"),
      startsAt: `${day}T${start}:00+01:00`, endsAt: `${day}T${end}:00+01:00` });
  }

  const examConflicts = !todayInvigilation ? findExamCollisions(entries??[]) : [];
  const editStart = editing ? new Date(Date.parse(editing.starts_at) + 3600000).toISOString() : "";
  const editEnd = editing ? new Date(Date.parse(editing.ends_at) + 3600000).toISOString() : "";
  const visibleEntries = todayInvigilation ? entries?.filter(item =>
    lagosLocalDay(Date.parse(item.starts_at)) === localDay &&
    item.invigilation_attendance?.some(duty => duty.mine && (duty.published || duty.in)),
  ) : entries;
  if (todayInvigilation && !error && !visibleEntries?.length) return null;
  return <section className="space-y-4 rounded-2xl border bg-white p-4 text-slate-900">
    <h2 className="text-xl font-bold">{todayInvigilation ? "My invigilation today" : "Tests and exams timetable"}</h2>
    {examConflicts.length>0&&<section className="rounded-xl border border-amber-300 bg-amber-50 p-3">
      <h3 className="font-black text-amber-950">Review {examConflicts.length} scheduling conflict{examConflicts.length===1?"":"s"}</h3>
      <p className="mt-2 text-xs text-amber-900">KHP-OS detected overlapping class schedules or assigned invigilators in your authorised timetable. Confirm independently and edit the timetable if necessary.</p>
      <ul className="mt-2 space-y-2">{examConflicts.slice(0,8).map(item=><li key={item.id} className="text-sm text-amber-950">{item.firstTitle} / {item.secondTitle}: {item.reason}</li>)}</ul>
    </section>}

    {!todayInvigilation && <label className="block max-w-xs text-sm font-bold">Choose a date to view its week
      <input type="date" value={from} disabled={busy} className={field} onChange={event => {
        if (event.target.value) {
          const selectedWeek = monday(event.target.value);
          if (selectedWeek !== from) { setEntries(null); setError(""); setEditing(null); setWeek(selectedWeek); }
        }
      }} />
    </label>}
    {assignments.length > 0 && <details className="rounded-xl border p-3" open={editing ? true : undefined}>
      <summary className="cursor-pointer font-bold">{editing ? "Edit test, assessment or exam" : "Add a test, assessment or exam"}</summary>
      <form id="assessment-schedule-form" key={editing?.id ?? from} onSubmit={add} className="mt-3">
        <fieldset disabled={busy || entries === null} className="grid gap-3 sm:grid-cols-2">
          <label>Class, subject and teacher<select name="streamId" className={field} required defaultValue={editing?.stream_id ?? ""}>
            <option value="">Choose teaching assignment</option>
            {assignments.map(item => <option key={item.id} value={item.id}>{item.classLabel} · {item.subjectLabel} · {item.teacherDisplay}</option>)}
          </select></label>
          <label>Type<select name="kind" className={field} defaultValue={editing?.kind ?? "test"}><option value="test">Test</option><option value="assessment">Assessment</option><option value="exam">Exam</option></select></label>
          <label>Title<input name="title" className={field} defaultValue={editing?.title} required maxLength={120} /></label>
          <label>Date<input type="date" name="day" className={field} required defaultValue={editStart.slice(0, 10) || from} /></label>
          <label>Starts (WAT)<input type="time" name="start" className={field} defaultValue={editStart.slice(11, 16)} required /></label>
          <label>Ends (WAT)<input type="time" name="end" className={field} defaultValue={editEnd.slice(11, 16)} required /></label>
          <button className={button} type="submit">{editing ? "Save changes" : "Save to timetable"}</button>
          {editing && <button type="button" onClick={() => setEditing(null)}>Cancel edit</button>}
        </fieldset>
      </form>
    </details>}
      <ActionFeedback busy={busy} error={error} notice={notice} onDismiss={() => { setError(""); setNotice(""); }} />
    {!entries && !error && <p role="status" className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Fetching scheduled tests and exams.</p>}
    {entries?.length === 0 && <p>No tests or exams scheduled for this week.</p>}
    {visibleEntries?.map(item => {
      const canStart = now >= Date.parse(item.starts_at) - 1800000 && now <= Date.parse(item.ends_at) + 1800000;
      return <article key={item.id} className="space-y-2 rounded-xl border p-3 text-sm">
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
        {!todayInvigilation && item.can_edit && assignments.length > 0 && <button type="button" disabled={busy} className={button} onClick={() => {
          setEditing(item);
          document.getElementById("assessment-schedule-form")?.parentElement?.scrollIntoView({ block: "nearest" });
        }}>Edit schedule</button>}
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
      </article>;
    })}
  </section>;
}
