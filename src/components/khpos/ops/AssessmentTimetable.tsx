"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Assignment = { id: string; classLabel: string; subjectLabel: string; teacherDisplay: string };
type Entry = {
  id: string; kind: string; title: string; starts_at: string; ends_at: string;
  checked_in_at: string | null; checked_out_at: string | null; marked_at: string | null;
  submitted_at: string | null; submitted_to: string | null; mine: boolean;
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

export function AssessmentTimetable({ school, today, assignments }: { school: string; today: string; assignments: Assignment[] }) {
  const [from, setFrom] = useState(() => monday(today));
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [now, setNow] = useState(Date.now);
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
    try {
      setEntries(await request(input));
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
    if (monday(day) !== from || end <= start) {
      setError("Choose a date in the displayed week and an end time after the start.");
      return;
    }
    void save({ mode: "add", title: fields.get("title"), streamId: fields.get("streamId"), kind: fields.get("kind"),
      startsAt: `${day}T${start}:00+01:00`, endsAt: `${day}T${end}:00+01:00` });
  }

  return <section className="space-y-4 rounded-2xl border bg-white p-4 text-slate-900">
    <h2 className="text-xl font-bold">Tests and exams timetable</h2>
    <label className="block max-w-xs text-sm font-bold">Choose a date to view its week
      <input type="date" value={from} disabled={busy} className={field} onChange={event => {
        if (event.target.value) {
          const selectedWeek = monday(event.target.value);
          if (selectedWeek !== from) { setEntries(null); setError(""); setFrom(selectedWeek); }
        }
      }} />
    </label>
    {assignments.length > 0 && <details className="rounded-xl border p-3">
      <summary className="cursor-pointer font-bold">Add a test, assessment or exam</summary>
      <form onSubmit={add} className="mt-3">
        <fieldset disabled={busy || entries === null} className="grid gap-3 sm:grid-cols-2">
          <label>Class, subject and teacher<select name="streamId" className={field} required>
            <option value="">Choose teaching assignment</option>
            {assignments.map(item => <option key={item.id} value={item.id}>{item.classLabel} · {item.subjectLabel} · {item.teacherDisplay}</option>)}
          </select></label>
          <label>Type<select name="kind" className={field}><option value="test">Test</option><option value="assessment">Assessment</option><option value="exam">Exam</option></select></label>
          <label>Title<input name="title" className={field} required maxLength={120} /></label>
          <label>Date<input type="date" name="day" className={field} required defaultValue={from} key={from} /></label>
          <label>Starts (WAT)<input type="time" name="start" className={field} required /></label>
          <label>Ends (WAT)<input type="time" name="end" className={field} required /></label>
          <button className={button} type="submit">Save to timetable</button>
        </fieldset>
      </form>
    </details>}
    {error && <p role="alert" className="text-red-800">{error}</p>}
    {!entries && !error && <p role="status">Loading timetable…</p>}
    {entries?.length === 0 && <p>No tests or exams scheduled for this week.</p>}
    {entries?.map(item => {
      const canStart = now >= Date.parse(item.starts_at) - 1800000 && now <= Date.parse(item.ends_at) + 1800000;
      return <article key={item.id} className="space-y-2 rounded-xl border p-3 text-sm">
        <h3 className="font-bold">{item.title} · {item.class_label} · {item.subject_label}</h3>
        <p className="capitalize">{item.kind} · {item.teacher}</p>
        <p>{stamp(item.starts_at)} to {stamp(item.ends_at)} WAT</p>
        <p>Check-in {item.checked_in_at ? stamp(item.checked_in_at) : "pending"} · Check-out {item.checked_out_at ? stamp(item.checked_out_at) : "pending"}</p>
        {item.marked_at && <p>Marking finished {stamp(item.marked_at)}</p>}
        {item.submitted_at && <p>Submitted to {item.submitted_to} · {stamp(item.submitted_at)}</p>}
        {item.mine && !item.checked_in_at && canStart && <button disabled={busy} className={button} onClick={() => void save({ mode: "start", id: item.id })}>Check in</button>}
        {item.mine && item.checked_in_at && !item.checked_out_at && <button disabled={busy} className={button} onClick={() => void save({ mode: "finish", id: item.id })}>Check out</button>}
        {item.mine && item.checked_out_at && !item.marked_at && <button disabled={busy} className={button} onClick={() => void save({ mode: "mark", id: item.id })}>Marking finished</button>}
        {item.mine && item.marked_at && !item.submitted_at && <form onSubmit={event => {
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
