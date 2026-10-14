"use client";

import { useState } from "react";

export type RecordSortOrder = "original" | "name_asc" | "name_desc" | "date_asc" | "date_desc" | "priority";

function compareDate(a: string | null | undefined, b: string | null | undefined, direction: 1 | -1) {
  const first = Date.parse(a ?? "");
  const second = Date.parse(b ?? "");
  // Missing dates belong at the bottom in both directions.
  if (!Number.isFinite(first)) return Number.isFinite(second) ? 1 : 0;
  if (!Number.isFinite(second)) return -1;
  return (first - second) * direction;
}

/**
 * Search only fields deliberately exposed by the calling, school-scoped workspace.
 * Never fetch additional records or alter the underlying Active/Waiting/History queue.
 */
export function useRecordSearch<T>(
  items: readonly T[],
  searchFields: (item: T) => string,
  displayName: (item: T) => string,
  dateField?: (item: T) => string | null | undefined,
  priorityField?: (item: T) => number | null | undefined,
) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<RecordSortOrder>("original");
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const visibleItems = items.filter((item) => {
    if (!terms.length) return true;
    const text = searchFields(item).toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });

  if (sort !== "original") {
    visibleItems.sort((a, b) => {
      if (sort === "name_asc") return displayName(a).localeCompare(displayName(b));
      if (sort === "name_desc") return displayName(b).localeCompare(displayName(a));
      if (sort === "date_asc" && dateField) return compareDate(dateField(a), dateField(b), 1);
      if (sort === "date_desc" && dateField) return compareDate(dateField(a), dateField(b), -1);
      if (sort === "priority" && priorityField) {
        return (priorityField(a) ?? Number.MAX_SAFE_INTEGER) - (priorityField(b) ?? Number.MAX_SAFE_INTEGER);
      }
      return 0;
    });
  }
  return { query, setQuery, sort, setSort, visibleItems };
}

export function RecordQueueSearchControls({
  query,
  setQuery,
  sort,
  setSort,
  shown,
  total,
  placeholder = "Search these records",
  hasDate = true,
  hasPriority = false,
}: {
  query: string;
  setQuery: (value: string) => void;
  sort: RecordSortOrder;
  setSort: (value: RecordSortOrder) => void;
  shown: number;
  total: number;
  placeholder?: string;
  hasDate?: boolean;
  hasPriority?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" role="search" aria-label="Find and sort records">
      <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700">
        Search current view
        <input
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:text-sm"
        />
      </label>
      <label className="min-w-44 text-sm font-semibold text-slate-700">
        Sort records
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as RecordSortOrder)}
          className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:text-sm"
        >
          <option value="original">Default order</option>
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
          {hasDate && <option value="date_asc">Earliest date first</option>}
          {hasDate && <option value="date_desc">Latest date first</option>}
          {hasPriority && <option value="priority">Highest priority first</option>}
        </select>
      </label>
      {query.trim() && (
        <button type="button" onClick={() => setQuery("")} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Clear search
        </button>
      )}
      <p className="w-full text-xs text-slate-500" role="status" aria-live="polite">
        Showing {shown} of {total} in this view. Change Active, Waiting or History to search that queue.
      </p>
    </div>
  );
}
