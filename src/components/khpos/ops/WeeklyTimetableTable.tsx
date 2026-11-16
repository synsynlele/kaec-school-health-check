"use client";

import { useState } from "react";
import type { KhposPresencePeriod } from "@/lib/khpos/ops/presence";

const days = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const headings = ["Day", "Time", "Class / group", "Subject", "Teacher", "Room", "Campus"];

export function WeeklyTimetableTable({ periods, campuses }: {
  periods: KhposPresencePeriod[];
  campuses: { id: string; name: string }[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rows = periods.filter(period => period.termActive).map(period => ({
    id: period.id,
    cells: [
      days[period.weekday] ?? "",
      `${period.start.slice(0, 5)} – ${period.end.slice(0, 5)}`,
      [period.class, period.teachingGroupLabel].filter(Boolean).join(" / "),
      period.subject,
      period.teacher,
      period.room || "—",
      campuses.find(campus => campus.id === period.campusId)?.name || "—",
    ],
  }));

  async function download() {
    setBusy(true);
    setError("");
    try {
      const { downloadTimetablePdf } = await import("@/lib/khpos/ops/timetable-pdf");
      await downloadTimetablePdf(headings, rows.map(row => row.cells));
    } catch {
      setError("Could not create the timetable PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-4 space-y-3">
    <button type="button" disabled={busy || !rows.length} onClick={() => void download()}
      className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
      {busy ? "Preparing PDF…" : "Download timetable PDF"}
    </button>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {rows.length ? <div tabIndex={0} role="region" aria-label="Weekly timetable table" className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[760px] text-left text-sm">
        <caption className="sr-only">Recurring weekly lesson timetable, Lagos time</caption>
        <thead className="bg-brand-700 text-white"><tr>{headings.map(heading =>
          <th key={heading} scope="col" className="px-3 py-3">{heading}</th>,
        )}</tr></thead>
        <tbody className="divide-y divide-slate-200">{rows.map(row =>
          <tr key={row.id} className="odd:bg-white even:bg-slate-50">{row.cells.map((cell, index) =>
            <td key={headings[index]} className={index === 1 ? "whitespace-nowrap px-3 py-2 tabular-nums" : "px-3 py-2"}>{cell}</td>,
          )}</tr>,
        )}</tbody>
      </table>
    </div> : <p className="text-sm text-slate-600">No active lessons match your filters.</p>}
  </div>;
}
