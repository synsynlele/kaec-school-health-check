"use client";

import { useEffect, useState } from "react";
import { ActionFeedback } from "./ActionFeedback";

type DayRecord = { mark: string | null; closing: string | null; release: string | null };
type History = {
  total: number;
  rows: { id: string; name: string; attended: number; late: number; absent: number;
    left_early: number; unaccounted: number; days: Record<string, DayRecord> }[];
};

const field = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const button = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50";
const dayLabel = new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function addDays(day: string, offset: number) {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function monday(day: string) {
  const weekday = new Date(day + "T00:00:00Z").getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

function dayStatus(record?: DayRecord) {
  if (!record) return "—";
  const attendance = record.mark === "late" ? "Late" : record.mark === "present" ? "Present" : record.mark === "absent" ? "Absent" : "";
  const movement = record.release === "left_early" ? "Left early" : record.release === "released" ? "Released"
    : record.closing === "unaccounted" ? "Unaccounted for" : record.closing === "present" ? "Present at closing" : "";
  return [attendance, movement].filter(Boolean).join(" · ") || "—";
}

export function LearnerAttendanceHistory({ call, campus, classLabel, section, today, onOpenDay }: {
  call: (action: string, input: object) => Promise<History>;
  campus: string; classLabel: string; section: string | null; today: string; onOpenDay: (day: string) => void;
}) {
  const [mode, setMode] = useState<"week" | "totals">("week");
  const [week, setWeek] = useState(monday(today));
  const [range, setRange] = useState({ from: addDays(today, -29), to: today });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [size, setSize] = useState(20);
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState<{ key: string; data?: History; error?: string }>();
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const from = mode === "week" ? week : range.from;
  const to = mode === "week" ? (days[6] < today ? days[6] : today) : range.to;
  const valid = Boolean(from && to && from <= to && to <= today && to <= addDays(from, 92));
  const key = JSON.stringify({ campus, class: classLabel, section, from, to, search, sort, size, page });
  const current = loaded?.key === key ? loaded : undefined;
  const loading = valid && !current;
  const result = current?.data;
  const total = result?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));

  useEffect(() => {
    if (!valid) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void call("history", JSON.parse(key)).then(data => {
        if (active) setLoaded({ key, data });
      }).catch(error => {
        if (active) setLoaded({ key, error: error instanceof Error ? error.message : "Attendance history could not be loaded." });
      });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [call, key, valid]);

  return <section aria-label="Attendance history" className="space-y-4 rounded-xl border bg-white p-4">
    <div className="flex flex-wrap gap-2">
      <button className={button} aria-pressed={mode === "week"} onClick={() => { setMode("week"); setPage(1); }}>Week by week</button>
      <button className={button} aria-pressed={mode === "totals"} onClick={() => { setMode("totals"); setPage(1); }}>Totals by date range</button>
    </div>
    <div className="flex flex-wrap items-end gap-3">
      {mode === "week" ? <>
        <button className={button} onClick={() => { setWeek(addDays(week, -7)); setPage(1); }}>Previous week</button>
        <label className="grid gap-1 text-sm">Week of
          <input type="date" className={field} value={week} max={today} onChange={e => {
            if (e.target.value) { setWeek(monday(e.target.value)); setPage(1); }
          }} />
        </label>
        <button className={button} disabled={addDays(week, 7) > today} onClick={() => { setWeek(addDays(week, 7)); setPage(1); }}>Next week</button>
      </> : <>
        <label className="grid gap-1 text-sm">From<input type="date" className={field} value={range.from} max={today}
          onChange={e => { setRange({ ...range, from: e.target.value }); setPage(1); }} /></label>
        <label className="grid gap-1 text-sm">To<input type="date" className={field} value={range.to} max={today}
          onChange={e => { setRange({ ...range, to: e.target.value }); setPage(1); }} /></label>
      </>}
      <label className="grid flex-1 gap-1 text-sm">Search learners
        <input type="search" className={field} value={search} maxLength={120} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </label>
      <label className="grid gap-1 text-sm">Sort
        <select className={field} value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}>
          <option value="name">Name A–Z</option><option value="name_desc">Name Z–A</option>
          <option value="absent">Most absences</option><option value="late">Most late arrivals</option>
          <option value="attended">Most days attended</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">Rows per page
        <select className={field} value={size} onChange={e => { setSize(Number(e.target.value)); setPage(1); }}>
          {[10,20,50].map(count => <option key={count}>{count}</option>)}
        </select>
      </label>
    </div>
    <p className="text-xs text-slate-600">Days attended include late arrivals. A dash means no mark was recorded for that day.</p>
    {!valid && <p role="alert">Choose a date range of up to 93 days ending today or earlier.</p>}
    {current?.error && <p role="alert">{current.error}</p>}
    <ActionFeedback busy={loading} notice={loading ? "Loading attendance history…" : ""} error="" onDismiss={() => {}} />
    {result && <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th scope="col" className="sticky left-0 bg-slate-100 p-3">Learner</th>
              {mode === "week" && days.map(day => <th scope="col" className="p-3" key={day}>
                <button type="button" className="underline disabled:no-underline" disabled={day > today} onClick={() => onOpenDay(day)}>
                  {dayLabel.format(new Date(day + "T00:00:00Z"))}
                </button>
              </th>)}
              {["Attended", "Late", "Absent", "Left early", "Unaccounted"].map(label => <th scope="col" className="p-3" key={label}>{label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {result.rows.map(learner => <tr key={learner.id}>
              <th scope="row" className="sticky left-0 bg-white p-3">{learner.name}</th>
              {mode === "week" && days.map(day => <td className="p-3" key={day}>{dayStatus(learner.days[day])}</td>)}
              {[learner.attended,learner.late,learner.absent,learner.left_early,learner.unaccounted].map((value, index) =>
                <td className="p-3 tabular-nums" key={index}>{value}</td>)}
            </tr>)}
          </tbody>
        </table>
        {!result.rows.length && <p className="p-3 text-sm">No learners match this view.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>{total ? (page - 1) * size + 1 : 0}–{Math.min(total, page * size)} of {total} learners</span>
        <div className="flex gap-2">
          <button className={button} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <button className={button} disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
    </>}
  </section>;
}
