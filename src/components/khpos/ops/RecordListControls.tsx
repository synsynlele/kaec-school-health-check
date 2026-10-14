"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

export type RecordSortOption<T> = {
  value: string;
  label: string;
  compare: (left: T, right: T) => number;
};

export function compareRecordText(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? "").localeCompare(right ?? "", undefined, { sensitivity: "base" });
}

/** Missing or malformed dates always go last, in either direction. */
export function compareRecordDate(
  left: string | null | undefined,
  right: string | null | undefined,
  direction: "asc" | "desc" = "asc",
) {
  const first = left ? Date.parse(left) : Number.NaN;
  const second = right ? Date.parse(right) : Number.NaN;
  if (!Number.isFinite(first)) return Number.isFinite(second) ? 1 : 0;
  if (!Number.isFinite(second)) return -1;
  return direction === "asc" ? first - second : second - first;
}

export function compareRecordPriority(left: string, right: string) {
  const order: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
  return (order[left] ?? 99) - (order[right] ?? 99);
}

/**
 * Search and order only the caller's already authorised, currently selected queue.
 * Never change the source records, queue counts, access rules or audit history.
 */
export function useRecordListControls<T extends { id: string }>(
  records: readonly T[],
  searchableText: (record: T) => string,
  sortOptions: readonly RecordSortOption<T>[],
  defaultSort: string,
) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(defaultSort);
  const needle = query.trim().toLocaleLowerCase();
  const filtered = records.filter((record) =>
    !needle || searchableText(record).toLocaleLowerCase().includes(needle),
  );
  const comparison = sortOptions.find((option) => option.value === sort)?.compare;
  const visibleItems = comparison ? [...filtered].sort(comparison) : filtered;
  const matchingIds = records.map((record) => record.id).join("|");

  // A notification link should still reveal a record when a search is in progress.
  useEffect(() => {
    const clearSearchForLinkedRecord = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (hash && matchingIds.split("|").some((id) => id && (hash === id || hash.endsWith(`-${id}`)))) {
        setQuery("");
      }
    };
    window.addEventListener("hashchange", clearSearchForLinkedRecord);
    return () => window.removeEventListener("hashchange", clearSearchForLinkedRecord);
  }, [matchingIds]);

  return {
    query, setQuery, sort, setSort, visibleItems,
    totalCount: records.length,
    resultCount: visibleItems.length,
    sortOptions: sortOptions.map(({ value, label }) => ({ value, label })),
  };
}

type Controls = {
  query: string;
  setQuery: (value: string) => void;
  sort: string;
  setSort: (value: string) => void;
  totalCount: number;
  resultCount: number;
  sortOptions: readonly { value: string; label: string }[];
};

export function RecordListControls({
  controls,
  placeholder = "Search records",
}: {
  controls: Controls;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700">
        Find a record
        <span className="relative mt-1 block">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            autoComplete="off"
            value={controls.query}
            onChange={(event) => controls.setQuery(event.target.value)}
            placeholder={placeholder}
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-10 text-sm text-slate-950 outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20"
          />
          {controls.query && <button type="button" aria-label="Clear record search" onClick={() => controls.setQuery("")}
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-600 hover:bg-slate-100">
            <X aria-hidden="true" className="size-4" />
          </button>}
        </span>
      </label>
      <label className="text-sm font-semibold text-slate-700 sm:w-56">
        Sort by
        <select value={controls.sort} onChange={(event) => controls.setSort(event.target.value)}
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20">
          {controls.sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <p role="status" aria-live="polite" className="shrink-0 text-xs font-medium text-slate-600 sm:pb-3">
        {controls.resultCount} of {controls.totalCount} records
      </p>
    </div>
  );
}
