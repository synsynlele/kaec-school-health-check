"use client";

import { SchoolPlan } from "./SchoolPlan";

import { ActionFeedback } from "./ActionFeedback";

import { ReportsWorkspace } from "@/components/khpos/ReportsWorkspace";
import { AnnouncementsWorkspace } from "@/components/khpos/AnnouncementsWorkspace";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TodayAttendanceCard } from "@/components/khpos/ops/TodayAttendanceCard";
import { useRecordFocus } from "@/components/khpos/ops/useRecordFocus";
import { announceKhposActivityChanged } from "@/lib/khpos/ops/action-events";
import { needsOwnerWorkAction } from "@/lib/khpos/ops/attention-rules";
import { focusKhposRecord, khposRecordAnchor } from "@/lib/khpos/ops/record-links";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Loader2,
  Play,
  ShieldAlert,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ProcessDocument } from "@/components/khpos/ops/ProcessDocument";
import { RecordQueueSearchControls, useRecordSearch } from "@/components/khpos/ops/RecordQueueSearch";
import { WorkRecordRequirementCard } from "@/components/khpos/ops/WorkRecordRequirementCard";
import type { KhposOpsLibrary } from "@/lib/khpos/ops/library";
import type { KhposAttentionSnapshot } from "@/lib/khpos/ops/attention";
import type {
  KhposOpsAvailableProcess,
  KhposOpsMyWork,
  KhposOpsWorkItem,
} from "@/lib/khpos/ops/work";

function formatDate(value: string | null) {
  if (!value) return "No fixed deadline";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(value: KhposOpsWorkItem["status"]) {
  return value.replaceAll("_", " ");
}

export function MyWorkWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [roleFilter, setRoleFilter] = useState("");
  const [work, setWork] = useState<KhposOpsMyWork | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [library, setLibrary] = useState<KhposOpsLibrary | null>(null);
  const [attention, setAttention] = useState<KhposAttentionSnapshot | null>(null);
  const workSearch = useRecordSearch(
    work?.items ?? [],
    (item) => [item.title, item.description ?? "", item.roleTitle, item.campusName ?? "", item.unitName ?? "", item.processCode ?? "", item.status, item.priority].join(" "),
    (item) => item.title,
    (item) => item.dueAt,
    (item) => ({ critical: 1, high: 2, standard: 3, planned: 4 })[item.priority],
  );

  const setWorkQuery = workSearch.setQuery;

  useEffect(() => {
    const showAll = () => { setRoleFilter(""); setWorkQuery(""); };
    window.addEventListener("hashchange", showAll);
    return () => window.removeEventListener("hashchange", showAll);
  }, [setWorkQuery]);

  useEffect(() => {
    if (!roleFilter) focusKhposRecord(window.location.hash, document);
  }, [roleFilter]);

  async function accessToken() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

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

      const headers = { Authorization: `Bearer ${token}` };
      const [workResponse, libraryResponse, attentionResponse] = await Promise.all([
        fetch(`/api/khpos/ops/work/${organisationId}`, {
          headers,
          cache: "no-store",
        }),
        fetch(`/api/khpos/ops/library/${organisationId}`, {
          headers,
          cache: "no-store",
        }),
        fetch(`/api/khpos/ops/attention/${organisationId}`, {
          headers,
          cache: "no-store",
        }),
      ]);

      const workBody = (await workResponse.json()) as {
        ok?: boolean;
        work?: KhposOpsMyWork;
        error?: string;
      };
      const libraryBody = (await libraryResponse.json()) as {
        ok?: boolean;
        library?: KhposOpsLibrary;
        error?: string;
      };
      const attentionBody = (await attentionResponse.json()) as {
        ok?: boolean;
        attention?: KhposAttentionSnapshot;
      };

      if (!active) return;

      if (!workResponse.ok || !workBody.ok || !workBody.work) {
        setError(workBody.error ?? "Today could not be loaded.");
        return;
      }

      setWork(workBody.work);
      if (attentionResponse.ok && attentionBody.ok && attentionBody.attention) {
        setAttention(attentionBody.attention);
      }

      if (libraryResponse.ok && libraryBody.ok && libraryBody.library) {
        setLibrary(libraryBody.library);
        setError("");
      } else {
        setLibrary(null);
        setError(
          libraryBody.error ??
            "Your work loaded, but its operating processes could not be loaded.",
        );
      }
    }).catch(() => {
      if (active) setError("Today could not be loaded. Check your connection and try again.");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  useEffect(() => {
    let stopped = false;
    let pending = false;
    const refresh = async () => {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const session = await supabase?.auth.getSession();
        const token = session?.data.session?.access_token;
        if (!token) return;
        const response = await fetch(`/api/khpos/ops/attention/${organisationId}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const body = await response.json();
        if (!stopped && response.ok && body.ok) setAttention(body.attention);
      } catch { /* Existing attention remains until the next refresh. */ }
      finally { pending = false; }
    };
    const resume = () => { void refresh(); };
    const timer = window.setInterval(resume, 30000);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { stopped = true; window.clearInterval(timer); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); };
  }, [organisationId, supabase]);

  async function reloadAttention() {
    try {
      const token = await accessToken();
      if (!token) return;
      const response = await fetch(`/api/khpos/ops/attention/${organisationId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) return;
      const body = (await response.json()) as {
        ok?: boolean;
        attention?: KhposAttentionSnapshot;
      };
      if (body.ok && body.attention) setAttention(body.attention);
    } catch {
      // The next page refresh can recover an unavailable attention summary.
    }
  }

  async function startAvailableProcess(item: KhposOpsAvailableProcess) {
    const token = await accessToken();
    if (!token) {
      setError("Your session has ended. Sign in again to continue.");
      return;
    }

    const busyKey = [
      "process",
      item.processId,
      item.campusId ?? "school",
      item.unitId ?? "all",
    ].join(":");
    setBusyId(busyKey);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/khpos/ops/work/${organisationId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "start_process",
          processId: item.processId,
          campusId: item.campusId,
          unitId: item.unitId,
        }),
      });

      const body = (await response.json()) as {
        ok?: boolean;
        work?: KhposOpsMyWork;
        error?: string;
      };

      if (!response.ok || !body.ok || !body.work) {
        setError(body.error ?? "The process could not be started.");
        return;
      }

      setWork(body.work);
      announceKhposActivityChanged(organisationId);
      void reloadAttention();
      setMessage(
        item.code +
          " has been started and added to your work queue.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The process could not be started.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function act(
    item: KhposOpsWorkItem,
    payload: Record<string, unknown>,
  ) {
    const token = await accessToken();
    if (!token) {
      setError("Your session has ended. Sign in again to continue.");
      return;
    }

    setBusyId(item.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/khpos/ops/work/${organisationId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workItemId: item.id, ...payload }),
      });

      const body = (await response.json()) as {
        ok?: boolean;
        work?: KhposOpsMyWork;
        error?: string;
      };

      if (!response.ok || !body.ok || !body.work) {
        setError(body.error ?? "The work action could not be completed.");
        return;
      }

      setWork(body.work);
      announceKhposActivityChanged(organisationId);
      void reloadAttention();
    } catch {
      setError("The action could not be saved. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  useRecordFocus(!!work);

  if (!work && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-mint-300" />
          <p className="mt-4 text-sm font-semibold text-slate-300">
            Loading your school work…
          </p>
        </div>
      </main>
    );
  }

  if (!work) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <ClipboardCheck className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Today is unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <Link
            href={`/khpos/${organisationId}`}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950"
          >
            <ArrowLeft className="size-4" />
            School overview
          </Link>
        </div>
      </main>
    );
  }

  const roleTitles = [...new Set([...work.items.map((item) => item.roleTitle), ...work.availableProcesses.map((process) => process.ownerRoleTitle)])].sort();
  const searchTerms = workSearch.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const matchesSearch = (content: string) => searchTerms.every((term) => content.toLocaleLowerCase().includes(term));
  const visibleItems = workSearch.visibleItems.filter((item) => !roleFilter || item.roleTitle === roleFilter);
  const sortBySelection = <T extends { title: string; priority?: string; dueAt?: string | null }>(items: T[]): T[] => {
    if (workSearch.sort === "original") return items;
    return items.sort((a, b) => {
      if (workSearch.sort === "name_asc") return a.title.localeCompare(b.title);
      if (workSearch.sort === "name_desc") return b.title.localeCompare(a.title);
      if (workSearch.sort === "priority") {
        const scores: Record<string, number> = { P0: 0, P1: 1, P2: 2, critical: 0, high: 1, standard: 2, planned: 3 };
        const score = (priority: string | undefined) => scores[priority ?? ""] ?? 99;
        return score(a.priority) - score(b.priority);
      }
      const left = Date.parse(a.dueAt ?? "");
      const right = Date.parse(b.dueAt ?? "");
      if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : 0;
      if (!Number.isFinite(right)) return -1;
      return (left - right) * (workSearch.sort === "date_asc" ? 1 : -1);
    });
  };
  const availableProcesses = sortBySelection(work.availableProcesses
    .filter((process) => (!roleFilter || process.ownerRoleTitle === roleFilter) &&
      matchesSearch([process.title, process.code, process.ownerRoleTitle, process.campusName ?? "", process.unitName ?? "", process.criticality].join(" ")))
    .map((process) => ({ ...process, priority: process.criticality })));
  const verificationItems = sortBySelection(work.verificationQueue
    .filter((item) => matchesSearch([item.title, item.roleTitle, item.processCode ?? "", item.campusName ?? "", item.status].join(" "))));
  const openItems = visibleItems.filter((item) => needsOwnerWorkAction(item.status));
  const awaitingItems = visibleItems.filter((item) => item.status === "awaiting_verification");
  const completedItems = visibleItems.filter((item) => item.status === "completed");
  const otherActions = (attention?.items ?? []).filter(item => item.kind !== "work" && item.kind !== "verification");
  const processByCode = new Map(
    (library?.processes ?? []).map((process) => [process.code, process]),
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <ActionFeedback busy={Boolean(busyId)} error={error ?? ""} notice={""} onDismiss={() => { setError(""); }} />
      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex items-center justify-between gap-4">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-bold text-mint-200">
              Today
            </span>
            <Link
              href={`/khpos/${organisationId}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black text-white"
            >
              <ArrowLeft className="size-4" />
              School overview
            </Link>
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
            Today
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
            Start with your school arrival and scheduled classes. Then check your assigned work, reports and approvals. Each section shows what to do next.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["To do", openItems.length],
              ["Awaiting review", awaitingItems.length],
              ["Overdue", work.summary.overdue],
              ["Blocked", work.summary.blocked],
              ["Completed", work.summary.completed],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-white/10 bg-white/10 p-4"
              >
                <p className="text-xs font-bold text-brand-100">{label}</p>
                <p className="mt-1 text-3xl font-black">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {message && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <nav aria-label="Daily shortcuts" className="flex flex-wrap gap-3 text-sm font-bold text-brand-700">
          <a className="rounded-xl border bg-white px-4 py-3" href="#today-attendance">Attendance &amp; lessons</a>
          <a className="rounded-xl border bg-white px-4 py-3" href="#today-reports">My reports</a>
          <Link className="rounded-xl border bg-white px-4 py-3" href={`/khpos/${organisationId}/issues`}>Raise an issue</Link>
          {verificationItems.length > 0 && <a className="rounded-xl border bg-white px-4 py-3" href="#today-reviews">Review work ({verificationItems.length})</a>}
        </nav>
        <SchoolPlan school={organisationId} todayOnly />
        <div id="today-attendance" className="scroll-mt-24"><TodayAttendanceCard organisationId={organisationId} /></div>
        <div id="today-reports" className="scroll-mt-24"><ReportsWorkspace organisationId={organisationId} compact /></div>
        <AnnouncementsWorkspace organisationId={organisationId} compact />

        {attention && otherActions.length > 0 && (
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                  Action required
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Issues and decisions to follow up
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  See the actions waiting for you. Open an item to complete it or send it for review.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full bg-red-50 px-3 py-1.5 text-red-800">
                  {otherActions.filter(item=>item.severity === "critical").length} critical
                </span>
                <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-900">
                  {otherActions.filter(item=>item.dueAt && Date.parse(item.dueAt) < Date.parse(attention.generatedAt)).length} overdue
                </span>
                <span className="rounded-full bg-brand-50 px-3 py-1.5 text-brand-800">
                  {otherActions.length} actions
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-2">
              {otherActions.slice(0, 8).map((item) => (
                <Link
                  key={item.id}
                  onClick={() => setRoleFilter("")}
                  href={item.href}
                  className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <div className="flex items-start gap-3">
                    <span className={
                      "mt-1 size-2.5 shrink-0 rounded-full " +
                      (item.severity === "critical"
                        ? "bg-red-600"
                        : item.severity === "high"
                          ? "bg-amber-500"
                          : item.severity === "medium"
                            ? "bg-brand-600"
                            : "bg-slate-400")
                    } />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-black uppercase tracking-wide text-slate-500">
                        {item.kind.replaceAll("_", " ")}
                      </span>
                      <span className="mt-1 block font-black text-slate-950">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-slate-600">
                        {item.detail}
                      </span>
                      <span className="mt-2 block text-xs font-black text-brand-700">
                        {item.actionLabel}
                      </span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}


        <RecordQueueSearchControls
          query={workSearch.query}
          setQuery={workSearch.setQuery}
          sort={workSearch.sort}
          setSort={workSearch.setSort}
          shown={visibleItems.length + availableProcesses.length + verificationItems.length}
          total={work.items.length + work.availableProcesses.length + work.verificationQueue.length}
          placeholder="Search tasks, school processes, positions or status"
          hasPriority
        />
        {roleTitles.length > 1 && <label className="block rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold">Show work for my position
          <select className="mt-2 block w-full rounded-xl border p-3" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">All my work</option>{roleTitles.map((title) => <option key={title} value={title}>{title}</option>)}
          </select><span className="mt-2 block font-normal text-slate-600">You can still see reports waiting for your review below.</span>
        </label>}
        {roleFilter && !openItems.length && !awaitingItems.length && !completedItems.length && !workSearch.query.trim() && <p className="text-sm text-slate-600">No work has been assigned to this position yet.</p>}
        {workSearch.query.trim() && !visibleItems.length && !availableProcesses.length && !verificationItems.length && <p role="status" className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">No items match your search. Clear the search or change position.</p>}
        {availableProcesses.length > 0 && (
          <details className="rounded-[30px] border border-brand-200 bg-white p-6 shadow-sm sm:p-8">
            <summary className="min-h-11 cursor-pointer text-base font-bold text-brand-800">Start a task when needed ({availableProcesses.length})</summary>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                  Available to start
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Tasks you can start
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  These tasks belong to your current positions. Start a task when it is actually needed. KHP-OS will ask for the reports, checklists and evidence needed to complete it.
                </p>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-black text-brand-800">
                {availableProcesses.length} available
              </span>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {availableProcesses.map((process) => {
                const busyKey = [
                  "process",
                  process.processId,
                  process.campusId ?? "school",
                  process.unitId ?? "all",
                ].join(":");
                const isBusy = busyId === busyKey;
                const scope = [
                  process.campusName,
                  process.unitName,
                ].filter(Boolean).join(" · ");

                return (
                  <article
                    key={busyKey}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-brand-800">
                        {process.code}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600">
                        {process.criticality}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-black">{process.title}</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {process.ownerRoleTitle}
                      {scope ? ` · ${scope}` : " · School-wide role"}
                    </p>

                    {process.triggerSummary && (
                      <p className="mt-4 text-sm leading-6 text-slate-600">
                        <span className="font-black text-slate-900">Start when: </span>
                        {process.triggerSummary}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black">
                      {process.evidenceRequired && (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-900">
                          Evidence required
                        </span>
                      )}
                      {process.verificationRequired && (
                        <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-900">
                          Independent verification
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void startAvailableProcess(process)}
                      className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
                    >
                      {isBusy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Play className="size-4" />
                      )}
                      Start task
                    </button>
                  </article>
                );
              })}
            </div>
          </details>
        )}

        {verificationItems.length > 0 && (
          <section id="today-reviews" className="scroll-mt-24 space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                Independent verification
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Work waiting for your review
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Review the submitted checklist, reports/logs and evidence. Verify
                only what is supported; return anything that needs correction.
              </p>
            </div>

            {verificationItems.map((item) => {
              const reviewNote = reviewNotes[item.id] ?? "";
              const isBusy = busyId === item.id;

              return (
                <article
                  key={item.id}
                  id={khposRecordAnchor("verification", item.id)}
                  tabIndex={-1}
                  className="scroll-mt-24 target:ring-4 target:ring-brand-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 rounded-[28px] border border-amber-200 bg-white p-6 shadow-sm sm:p-7"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {item.processCode && (
                          <span className="rounded-full bg-brand-50 px-3 py-1 text-[11px] font-black text-brand-800">
                            {item.processCode}
                          </span>
                        )}
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-900">
                          Awaiting verification
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-black">{…25752 tokens truncated…{ id: string; name: string }>;
  todayPresence: null | { checkInLocation?: AttendanceLocation | null; checkOutLocation?: AttendanceLocation | null; id: string; campusId: string; in: string; out: string | null; administrativelyClosed: boolean };
  periods: KhposPresencePeriod[]; observations: KhposHqlsObservation[];
  teamPresence: Array<{ checkInLocation?: AttendanceLocation | null; checkOutLocation?: AttendanceLocation | null; name: string; campusId: string; in: string; out: string | null; administrativelyClosed: boolean }>;
  openClassSessions: Array<{ id: string; date: string; class: string; subject: string; teacher: string; in: string }>;
  openSchoolAttendance: Array<{ id: string; date: string; teacher: string; campusId: string; in: string }>;
}
export interface KhposPresenceHistory {
  from: string; to: string; page: number; pageSize: number;
  schoolTotal: number; classTotal: number;
  schoolRecords: Array<{ checkInLocation?:AttendanceLocation|null; checkOutLocation?:AttendanceLocation|null; id:string; name:string; campusId:string; date:string; in:string; out:string|null; administrativelyClosed:boolean }>;
  classRecords: Array<{ id:string; date:string; teacher:string; class:string; subject:string; in:string; out:string|null; topic:string|null; outcome:string|null; administrativelyClosed:boolean }>;
}

export interface KhposFilteredPresenceHistory extends KhposPresenceHistory {
  category: "school" | "class"; search: string; sort: "newest" | "oldest" | "name"; total: number;
}

export async function getFilteredPresenceHistory(
  org:string, actor:string, from:string, to:string,
  category:"school"|"class", search:string, sort:"newest"|"oldest"|"name", page:number, pageSize:20|50
):Promise<KhposFilteredPresenceHistory> {
  const {data,error}=await service().rpc("khpos_ops_presence_history_filtered_server",{
    p_actor:actor,p_org:org,p_from:from,p_to:to,p_category:category,
    p_query:search,p_sort:sort,p_page:page,p_page_size:pageSize
  });
  if(error) fail(error.message);
  if(!data || typeof data!=="object" || Array.isArray(data)) fail("Attendance history could not be loaded.");
  return data as KhposFilteredPresenceHistory;
}

export async function getPresenceHistory(org:string, actor:string, from:string, to:string, page:number):Promise<KhposPresenceHistory> {
  const {data,error}=await service().rpc("khpos_ops_presence_history_server",{
    p_actor:actor,p_org:org,p_from:from,p_to:to,p_page:page,p_page_size:50
  });
  if(error) fail(error.message);
  if(!data || typeof data!=="object" || Array.isArray(data)) fail("Attendance history could not be loaded.");
  return data as KhposPresenceHistory;
}

export class KhposPresenceError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}
function service() {
  if (!url || !key) throw new KhposPresenceError("Teaching attendance is not configured.", 503);
  return client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function fail(message: string) {
  const status = /does not exist|could not find the function|not configured|schema cache/i.test(message)
    ? 503 : /only|membership|authorised|permitted|active staff|another school|independent observer/i.test(message)
      ? 403 : 400;
  throw new KhposPresenceError(message, status);
}
export async function getPresenceWorkspace(org: string, actor: string): Promise<KhposPresenceWorkspace> {
  const { data, error } = await service().rpc("khpos_ops_presence_workspace_server", { p_actor: actor, p_org: org });
  if (error) fail(error.message);
  if (!data || typeof data !== "object" || Array.isArray(data)) fail("Attendance could not be loaded.");
  const workspace = data as KhposPresenceWorkspace;
  const date = new Date(workspace.localDay + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  const from = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 6);
  const to = date.toISOString().slice(0, 10);
  const { data: closures, error: closureError } = await service().from("khpos_school_plan_entries")
    .select("campus_id,kind,start_day,end_day").eq("organisation_id", org).eq("published", true)
    .in("kind", ["closure", "no_lessons"]).lte("start_day", to).gte("end_day", from);
  if (closureError) fail(closureError.message);
  return { ...workspace, calendarClosures: closures as SchoolClosure[] };
}
export async function actOnPresence(org: string, actor: string, mode: string, input: Record<string, unknown>) {
  const { error } = await service().rpc("khpos_ops_presence_action_server", {
    p_actor: actor, p_org: org, p_mode: mode, p_input: input
  });
  if (error) fail(error.message);
}

export type WeeklyClassRecord = { periodId: string; date: string; in: string; out: string | null; outcome: string | null; administrativelyClosed: boolean };

export async function getWeeklyClassRecords(org: string, actor: string) {
  const workspace = await getPresenceWorkspace(org, actor);
  const monday = new Date(workspace.localDay + "T12:00:00Z");
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const from = monday.toISOString().slice(0, 10);
  const to = sunday.toISOString().slice(0, 10);
  const visible = new Map(workspace.periods.map(period => [period.id, period.teacherUserId]));
  const ids = [...visible.keys()];
  const records: WeeklyClassRecord[] = [];
  // Keep each request below REST URL and row limits.
  for (let index = 0; index < ids.length; index += 100) {
    const { data, error } = await service().from("khpos_ops_class_sessions")
      .select("period_id,teacher_user_id,local_day,checked_in_at,checked_out_at,outcome,closed_by")
      .eq("organisation_id", org).in("period_id", ids.slice(index, index + 100))
      .gte("local_day", from).lte("local_day", to);
    if (error) fail(error.message);
    for (const row of data ?? []) {
      if (visible.get(row.period_id) !== row.teacher_user_id) continue;
      records.push({ periodId: row.period_id, date: row.local_day, in: row.checked_in_at,
        out: row.checked_out_at, outcome: row.outcome, administrativelyClosed: Boolean(row.closed_by) });
    }
  }
  return { from, to, records };
}

export async function getAssessmentAlerts(org: string, actor: string, day: string, nowMs: number) {
  const { data, error } = await service().rpc("khpos_assessment_timetable_server", {
    p_actor: actor, p_org: org, p_mode: "list", p_input: { from: day },
  });
  if (error) fail(error.message);
  const endOfDay = Date.parse(day + "T00:00:00+01:00") + 86400000;
  const entries = data as { id: string; mine: boolean; title: string; class_label: string;
    starts_at: string; ends_at: string; checked_in_at: string | null }[];
  return entries.filter(entry => entry.mine && !entry.checked_in_at &&
    Date.parse(entry.starts_at) < endOfDay && nowMs <= Date.parse(entry.ends_at) + 1800000)
    .map(entry => ({
      id: "assessment:" + entry.id, title: entry.title + " · " + entry.class_label,
      detail: "Open Tests & exams to check the time and record attendance.",
      href: `/khpos/${org}/teaching-presence?tab=exams`, dueAt: entry.starts_at,
      urgent: false, level: "action" as const, category: "assessment",
    }));
}

// Preview must be bound to an isolated Supabase branch before this feature is usable.
export function verifyTeachingPreviewIsolation() {
  if (process.env.VERCEL_ENV !== "preview") return;
  const ref = process.env.KHPOS_TEACHING_PREVIEW_DB_REF?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!ref || !/^[a-z0-9]{20}$/.test(ref) || !url) {
    throw new KhposPresenceError("Teaching preview requires an isolated Supabase branch.", 503);
  }
  let hostname = "";
  try { hostname = new URL(url).hostname.toLowerCase(); }
  catch { throw new KhposPresenceError("Invalid preview Supabase URL.", 503); }
  if (ref === "rlpciatblisxnuuiekkf" || hostname !== ref + ".supabase.co") {
    throw new KhposPresenceError("Teaching preview cannot use the live KHP-OS database.", 503);
  }
}
