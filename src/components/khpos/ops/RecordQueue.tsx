"use client";

import { useEffect, useState } from "react";

/**
 * Workflow queues are a presentation rule, not a deletion or permission rule.
 * Keep all records returned by the scoped server API; show only unfinished work
 * by default, with a separate History view for completed/closed records.
 */
export type RecordQueueView = "active" | "history";

export function useRecordQueue<T extends { id: string }>(
  records: readonly T[],
  isHistory: (record: T) => boolean,
) {
  const [view, setView] = useState<RecordQueueView>("active");
  const activeItems = records.filter((record) => !isHistory(record));
  const historyItems = records.filter(isHistory);
  // A notification/deep link to an archived record must never become a dead link.
  const historicalIds = historyItems.map((record) => record.id).join("|");

  useEffect(() => {
    const revealLinkedRecord = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash) return;
      if (historicalIds.split("|").some((id) => id && (hash === id || hash.endsWith(`-${id}`)))) {
        setView("history");
      }
    };
    revealLinkedRecord();
    window.addEventListener("hashchange", revealLinkedRecord);
    return () => window.removeEventListener("hashchange", revealLinkedRecord);
  }, [historicalIds]);

  return {
    view,
    setView,
    visibleItems: view === "active" ? activeItems : historyItems,
    activeCount: activeItems.length,
    historyCount: historyItems.length,
  };
}

export function RecordQueueTabs({
  view,
  setView,
  activeCount,
  historyCount,
  activeLabel = "Needs attention",
}: {
  view: RecordQueueView;
  setView: (view: RecordQueueView) => void;
  activeCount: number;
  historyCount: number;
  activeLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Record view">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose record status">
        {([
          ["active", activeLabel, activeCount],
          ["history", "History", historyCount],
        ] as const).map(([mode, title, count]) => (
          <button key={mode} type="button" aria-pressed={view === mode}
            onClick={() => setView(mode)}
            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 ${view === mode ? "bg-slate-950 text-white" : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
            {title} <span className="ml-1 tabular-nums">({count})</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">Completed records stay accessible without cluttering your working queue.</p>
    </div>
  );
}
