"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CircleAlert,
  Clock3,
  FileCheck2,
  Flag,
  Loader2,
  Repeat2,
  School,
  Target,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposCalendarItem,
  KhposCalendarSnapshot,
} from "@/lib/khpos/ops/calendar";

const icons = {
  work: Clock3,
  decision: Target,
  event: School,
  policy_review: FileCheck2,
  recurring: Repeat2,
} as const;

function label(kind: KhposCalendarItem["kind"]) {
  return kind.replaceAll("_", " ");
}

function niceDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value + "T12:00:00"));
}

export function InstitutionalCalendarWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [calendar, setCalendar] = useState<KhposCalendarSnapshot | null>(null);
  const [kind, setKind] = useState<KhposCalendarItem["kind"] | "all">("all");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const token = data.session?.access_token;
      if (!token) {
        setError("Your session has ended. Sign in again to continue.");
        return;
      }
      const response = await fetch(
        `/api/khpos/ops/calendar/${organisationId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        calendar?: KhposCalendarSnapshot;
        error?: string;
      };
      if (!active) return;
      if (!response.ok || !body.ok || !body.calendar) {
        setError(body.error ?? "Institutional calendar could not be loaded.");
        return;
      }
      setCalendar(body.calendar);
      setError("");
    });
    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  if (!calendar && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <Loader2 className="size-9 animate-spin text-mint-300" />
      </main>
    );
  }

  if (!calendar) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <CircleAlert className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Calendar unavailable</h1>
          <p className="mt-3 text-sm text-slate-300">{error}</p>
        </div>
      </main>
    );
  }

  const visible =
    kind === "all"
      ? calendar.items
      : calendar.items.filter((item) => item.kind === kind);
  const grouped = new Map<string, KhposCalendarItem[]>();
  for (const item of visible) {
    const rows = grouped.get(item.date) ?? [];
    rows.push(item);
    grouped.set(item.date, rows);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-black text-mint-200">
              Operating rhythm
            </span>
            <Link
              href={`/khpos/${organisationId}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black"
            >
              <ArrowLeft className="size-4" />
              Command Centre
            </Link>
          </div>
          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Institutional Calendar
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100">
            One timeline assembled from real work deadlines, decisions, school
            events, controlled policy reviews and future recurring operations.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Total", calendar.summary.total],
              ["Overdue", calendar.summary.overdue],
              ["Work", calendar.summary.work],
              ["Decisions", calendar.summary.decisions],
              ["Events", calendar.summary.events],
              ["Scheduled", calendar.summary.scheduledOperations],
            ].map(([name, value]) => (
              <div
                key={String(name)}
                className="rounded-2xl border border-white/10 bg-white/10 p-4"
              >
                <p className="text-xs font-bold text-brand-100">{name}</p>
                <p className="mt-1 text-2xl font-black">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <section className="flex flex-wrap gap-2">
          {(["all", "work", "decision", "event", "policy_review", "recurring"] as const).map(
            (value) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className={`rounded-full border px-4 py-2 text-xs font-black capitalize ${
                  kind === value
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {value === "all" ? "All" : label(value)}
              </button>
            ),
          )}
        </section>

        {Array.from(grouped.entries()).map(([date, items]) => (
          <section
            key={date}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <CalendarDays className="size-5 text-brand-700" />
              <h2 className="text-lg font-black">{niceDate(date)}</h2>
            </div>
            <div className="mt-4 space-y-3">
              {items.map((item) => {
                const Icon = icons[item.kind];
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`flex items-start gap-4 rounded-2xl border p-4 transition hover:border-brand-300 ${
                      item.overdue
                        ? "border-red-200 bg-red-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-brand-700">
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                          {label(item.kind)}
                        </span>
                        {item.overdue && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase text-red-800">
                            overdue
                          </span>
                        )}
                        {item.priority === "critical" && (
                          <Flag className="size-3.5 text-red-700" />
                        )}
                      </span>
                      <span className="mt-1 block font-black">{item.title}</span>
                      <span className="mt-1 block text-sm leading-6 text-slate-600">
                        {item.detail}
                      </span>
                    </span>
                    {item.time && (
                      <span className="shrink-0 text-xs font-bold text-slate-500">
                        {item.time}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {!visible.length && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
            Nothing is scheduled in this view.
          </div>
        )}
      </div>
    </main>
  );
}
