"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { lagosLocalDay } from "@/lib/khpos/ops/attendance-guidance";

type Teacher = { id: string; name: string; workdays: number[] | null; reportingTime: string | null;
  arrival: string | null; status: string; lateMinutes: number | null };
type Campus = { id: string; name: string; teachers: Teacher[];
  policy: { workdays: number[]; reporting_time: string; grace_minutes: number } | null };
const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const statuses: Record<string, string> = { off_duty: "Not expected on campus", missing: "Not signed in",
  late: "Late", present: "Present · confirmed by leadership", signed_in: "Signed in",
  expected: "Expected on campus", absent: "Absent · confirmed by leadership" };
const field = "rounded-lg border border-slate-300 px-2 py-1";
const button = "rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50";

function Workdays({ days }: { days: number[] }) {
  return <fieldset className="flex flex-wrap gap-3">
    <legend className="mb-1 text-sm font-semibold">Expected on-campus days</legend>
    {dayNames.map((name, index) => <label key={name} className="flex items-center gap-1">
      <input type="checkbox" name="workday" value={index+1} defaultChecked={days.includes(index+1)} />{name}
    </label>)}
  </fieldset>;
}

export function TeacherAttendanceSettings({ organisationId }: { organisationId: string }) {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [day, setDay] = useState("");
  const call = useCallback(async (action: string, input: object = {}) => {
    const session = (await createBrowserSupabaseClient()?.auth.getSession())?.data.session;
    if (!session) throw new Error("Sign in to review attendance.");
    const response = await fetch(`/api/khpos/ops/teacher-attendance/${organisationId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action, input }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data.result;
  }, [organisationId]);
  useEffect(() => {
    let active = true;
    call("list").then(data => {
      if (active) { setCampuses(data); setDay(lagosLocalDay(Date.now())); }
    }).catch(error => { if (active) setFeedback(error.message); });
    return () => { active = false; };
  }, [call]);

  const campus = campuses.find(item => item.id === campusId) ?? campuses[0];
  async function save(action: string, input: object) {
    if (!campus || busy) return;
    setBusy(true);
    setFeedback("");
    try {
      await call(action, { ...input, campus: campus.id, day });
      setCampuses(await call("list"));
      setDay(lagosLocalDay(Date.now()));
      setFeedback("Saved.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save attendance.");
    } finally {
      setBusy(false);
    }
  }

  if (!campus) return feedback ? <p role="status">{feedback}</p> : null;
  return <section id="teacher-attendance" className="scroll-mt-24 space-y-4 rounded-2xl border bg-white p-4 text-slate-900">
    <h2 className="text-lg font-bold">Teacher workdays & sign-in</h2>
    <p className="text-sm">Set the days teachers are expected on campus, including days without lessons.</p>
    <label className="flex flex-wrap items-center gap-2">Campus
      <select className={field} disabled={busy} value={campus.id} onChange={event => setCampusId(event.target.value)}>
        {campuses.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
      </select>
    </label>
    {feedback && <p role="status">{feedback}</p>}
    <form key={campus.id + JSON.stringify(campus.policy)} className="space-y-2" onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      void save("policy", { workdays: data.getAll("workday").map(Number), time: data.get("time"), grace: data.get("grace") });
    }}>
      <h3 className="font-semibold">Campus defaults</h3>
      <Workdays days={campus.policy?.workdays ?? [1,2,3,4,5]} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1">Reporting time (Lagos)
          <input type="time" className={field} name="time" defaultValue={campus.policy?.reporting_time.slice(0,5)} required />
        </label>
        <label className="grid gap-1">Grace minutes
          <input type="number" className={field} name="grace" min={0} max={120} defaultValue={campus.policy?.grace_minutes ?? 0} required />
        </label>
        <button className={button} disabled={busy}>Save campus defaults</button>
      </div>
    </form>
    {!campus.policy && <p>Save campus defaults to enable teacher attendance alerts.</p>}
    {campus.policy && campus.teachers.map(teacher => <details className="rounded-lg border p-3" key={teacher.id}>
      <summary className="cursor-pointer font-medium">{teacher.name} · {statuses[teacher.status]}
        {teacher.lateMinutes !== null && ` · ${teacher.lateMinutes} min`}
        {teacher.arrival && ` · ${new Date(teacher.arrival).toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" })}`}
      </summary>
      <form key={JSON.stringify([teacher.workdays, teacher.reportingTime])} className="mt-3 space-y-2" onSubmit={event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void save("override", { staff: teacher.id,
          workdays: data.has("custom") ? data.getAll("workday").map(Number) : null,
          time: data.get("time") });
      }}>
        <label className="flex items-center gap-2"><input type="checkbox" name="custom" defaultChecked={teacher.workdays !== null} />Use the workdays selected below for this teacher</label>
        <Workdays days={teacher.workdays ?? campus.policy?.workdays ?? []} />
        <label className="grid max-w-xs gap-1">Individual reporting time (optional)
          <input type="time" className={field} name="time" defaultValue={teacher.reportingTime?.slice(0,5)} />
        </label>
        <button className={button} disabled={busy}>Save teacher schedule</button>
      </form>
      {["missing", "absent", "present"].includes(teacher.status) && <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void save("review", { staff: teacher.id, outcome: data.get("outcome"), reason: data.get("reason") });
      }}>
        <label className="grid gap-1">Attendance review
          <select className={field} name="outcome"><option value="absent">Confirm absence</option><option value="present">Confirm attendance</option>{teacher.status !== "missing" && <option value="clear">Reopen review</option>}</select>
        </label>
        <label className="grid gap-1">Reason<input className={field} name="reason" maxLength={300} required /></label>
        <button className={button} disabled={busy}>Save review</button>
      </form>}
    </details>)}
  </section>;
}
