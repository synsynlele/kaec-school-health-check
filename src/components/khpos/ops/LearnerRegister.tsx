"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ActionFeedback } from "./ActionFeedback";
import { LoadingScreen } from "@/components/navigation/LoadingScreen";

type Phase = "morning" | "closing" | "release";
type Learner = {
  id: string;
  name: string;
  class: string;
  section: string | null;
  canMarkMorning: boolean;
  marks: Partial<Record<Phase, { mark: string; id: number; at: string; note: string | null }>>;
};
type Roster = {
  day: string;
  today: string;
  campuses: { id: string; name: string; closesAt: string | null; guardian: boolean; office: boolean; learners: Learner[]; teachers: { id: string; name: string }[]; assignments: { class: string; section: string; teacher: string; backup: string | null }[] }[];
};

const labels: Record<string, string> = {
  present: "Present", late: "Late", absent: "Absent", unaccounted: "Unaccounted for",
  released: "Released from school", left_early: "Left early",
};
const button = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50";
const field = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export function LearnerRegister({ organisationId, initialCampus, initialFilter }: { organisationId: string; initialCampus?: string; initialFilter?: string }) {
  const [roster, setRoster] = useState<Roster>();
  const [campusId, setCampus] = useState(initialCampus ?? "");
  const [className, setClass] = useState("");
  const [filter, setFilter] = useState(initialFilter === "absent" || initialFilter === "unaccounted" ? initialFilter : "all");
  const [phase, setPhase] = useState<"morning" | "closing">(initialCampus ? "closing" : "morning");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [release, setRelease] = useState<{ learner: Learner; mark: "released" | "left_early" }>();
  const call = useCallback(async (action: string, input: object = {}) => {
    const session = (await createBrowserSupabaseClient()?.auth.getSession())?.data.session;
    if (!session) throw new Error("Sign in to open the learner register.");
    const response = await fetch(`/api/khpos/ops/learner-register/${organisationId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action, input }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data.result;
  }, [organisationId]);

  const refresh = useCallback(async () => {
    setRoster(await call("roster", { date }));
  }, [call, date]);

  useEffect(() => {
    let active = true;
    call("roster", { date }).then(data => { if (active) setRoster(data); })
      .catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [call, date]);

  const readOnly = Boolean(roster && (roster.day !== roster.today || (date && date !== roster.day)));
  const campus = roster?.campuses.find(item => item.id === campusId) ?? roster?.campuses[0];
  const group = (learner: Learner) => [learner.class, learner.section].filter(Boolean).join(" · ");
  const classes = [...new Set(campus?.learners.map(group))];
  const selectedClass = classes.includes(className) ? className : (classes[0] ?? "");
  const selectedLearner = campus?.learners.find(learner => group(learner) === selectedClass);
  const assignment = campus?.assignments.find(item =>
    item.class === selectedLearner?.class.toLowerCase() &&
    item.section === (selectedLearner?.section ?? "").toLowerCase());
  const learners = campus?.learners.filter(learner => {
    if (filter === "absent") {
      return learner.marks.morning?.mark === "absent" && learner.marks.closing?.mark !== "present" && !learner.marks.release;
    }
    if (filter === "unaccounted") return learner.marks.closing?.mark === "unaccounted" && !learner.marks.release;
    return group(learner) === selectedClass;
  }) ?? [];

  async function save(action: string, input: object = {}) {
    if (!campus || busy || (readOnly && action !== "refresh")) return;
    setBusy(true);
    setError("");
    setNotice(action === "refresh" ? "Refreshing the register…" : "Saving the register…");
    try {
      if (action !== "refresh") {
        await call(action, { ...input, campus: campus.id, day: roster?.day });
        setRelease(undefined);
      }
      await refresh();
      setNotice(action === "refresh" ? "Register refreshed." : "Register updated.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save the register.");
    } finally {
      setBusy(false);
    }
  }

  function mark(learner: Learner, stage: Phase, status: string, note?: string) {
    return save("mark", { learner: learner.id, phase: stage, mark: status, note, previous: learner.marks[stage]?.id });
  }

  if (!roster && !error) return <LoadingScreen />;

  return <section className="mx-auto max-w-5xl space-y-5 px-4 py-6">
    <header>
      <h1 className="text-2xl font-semibold">Learner register</h1>
      <p className="text-sm text-slate-600">Take the morning roll, then confirm learners at closing and record their release.</p>
      {roster && <p className="mt-1 text-sm">{roster.day}</p>}
    </header>
    <ActionFeedback busy={busy} error={error} notice={notice} onDismiss={() => { setError(""); setNotice(""); }} />
    {!campus && roster && <p>No assigned learner roster is available.</p>}
    {campus && <>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">Date
          <input type="date" className={field} value={date || roster?.today || ""} max={roster?.today} disabled={busy || Boolean(release)} onChange={event => setDate(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">Campus
          <select className={field} disabled={busy || Boolean(release)} value={campus.id} onChange={event => setCampus(event.target.value)}>
            {roster?.campuses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Class
          <select className={field} disabled={busy || Boolean(release) || filter !== "all"} value={selectedClass} onChange={event => setClass(event.target.value)}>
            {classes.map(item => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Show
          <select className={field} disabled={busy || Boolean(release)} value={filter} onChange={event => setFilter(event.target.value)}>
            <option value="all">Selected class</option>
            <option value="absent">Learners marked absent</option>
            <option value="unaccounted">Unaccounted for at closing</option>
          </select>
        </label>
        <button type="button" className={button} disabled={busy} onClick={() => void save("refresh")}>Refresh</button>
      </div>
      {campus.guardian && !readOnly && <form key={campus.id} className="flex flex-wrap items-end gap-2" onSubmit={event => {
        event.preventDefault();
        void save("schedule", { closesAt: new FormData(event.currentTarget).get("closing") });
      }}>
        <label className="grid gap-1 text-sm">Date
          <input type="date" className={field} value={date || roster?.today || ""} max={roster?.today} disabled={busy || Boolean(release)} onChange={event => setDate(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">Campus closing time (Lagos)
          <input type="time" className={field} name="closing" defaultValue={campus.closesAt?.slice(0, 5)} required />
        </label>
        <button className={button} disabled={busy}>Save closing time</button>
      </form>}
      {campus.guardian && !readOnly && selectedLearner && <form
        key={[campus.id, selectedClass, assignment?.teacher, assignment?.backup].join(":")}
        className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
        onSubmit={event => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void save("assign", {
            class: selectedLearner.class, section: selectedLearner.section,
            teacher: data.get("teacher"), backup: data.get("backup"),
          });
        }}>
        <p className="basis-full font-medium">Register responsibility · {selectedClass}</p>
        <label className="grid gap-1 text-sm">Class teacher
          <select name="teacher" className={field} defaultValue={assignment?.teacher ?? ""} required>
            <option value="">Choose a teacher</option>
            {campus.teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Backup teacher
          <select name="backup" className={field} defaultValue={assignment?.backup ?? ""}>
            <option value="">No backup</option>
            {campus.teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
          </select>
        </label>
        <button className={button} disabled={busy || !campus.teachers.length}>Save assignment</button>
        {!campus.teachers.length && <p className="basis-full text-sm">Appoint a teacher to this campus in Staff & roles first.</p>}
      </form>}
      <div className="flex gap-2">
        <button className={button} aria-pressed={phase === "morning"} onClick={() => setPhase("morning")}>Morning roll</button>
        <button className={button} aria-pressed={phase === "closing"} onClick={() => setPhase("closing")}>Closing & release</button>
      </div>
      {release && <form className="space-y-2 rounded-lg border p-3" onSubmit={event => {
        event.preventDefault();
        void mark(release.learner, "release", release.mark, String(new FormData(event.currentTarget).get("note")));
      }}>
        <label className="grid gap-1 text-sm">
          {release.learner.name} · {release.mark === "left_early" ? "Record who approved the release and who collected the learner, if applicable." : "Record independent departure, authorised pickup, or school transport."}
          <input className={field} name="note" maxLength={300} required />
        </label>
        <button className={button} disabled={busy}>Confirm actual release</button>{" "}
        <button type="button" className={button} disabled={busy} onClick={() => setRelease(undefined)}>Cancel</button>
      </form>}
      <ul className="divide-y rounded-lg border">
        {learners.map(learner => {
          const { morning, closing, release: released } = learner.marks;
          return <li key={learner.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div>
              <p className="font-medium">{learner.name}</p>
              <p className="text-sm text-slate-600">{group(learner)} · {morning ? labels[morning.mark] : "Morning unmarked"}
                {released ? ` · ${labels[released.mark]}` : closing ? ` · ${closing.mark === "present" ? "Present at closing, release pending" : labels[closing.mark]}` : ""}
              </p>
              {released && <p className="text-sm text-slate-600">{new Date(released.at).toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" })} · {released.note}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {phase === "morning" && learner.canMarkMorning && ["present", "late", "absent"].map(status => <button key={status} className={button}
                disabled={busy || readOnly || Boolean(release)} aria-pressed={morning?.mark === status}
                onClick={() => void mark(learner, "morning", status)}>{labels[status]}</button>)}
              {phase === "closing" && !readOnly && !released && <>
                <button className={button} disabled={busy || Boolean(release)} onClick={() => void mark(learner, "closing", "present")}>Present at closing</button>
                <button className={button} disabled={busy || Boolean(release) || (closing?.mark !== "present" && (!morning || morning.mark === "absent"))} onClick={() => void mark(learner, "closing", "unaccounted")}>Unaccounted for</button>
                <button className={button} disabled={busy || Boolean(release) || closing?.mark !== "present"} onClick={() => setRelease({ learner, mark: "released" })}>Confirm release</button>
              </>}
              {!released && !readOnly && (campus.office || campus.guardian) && <button className={button} disabled={busy || Boolean(release)}
                onClick={() => setRelease({ learner, mark: "left_early" })}>Record early departure</button>}
            </div>
          </li>;
        })}
        {!learners.length && <li className="p-3 text-sm text-slate-600">No learners to show.</li>}
      </ul>
    </>}
  </section>;
}
