"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import type {
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
  const [work, setWork] = useState<KhposOpsMyWork | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function accessToken() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function load() {
    const token = await accessToken();
    if (!token) {
      setError("Your session has ended. Sign in again to continue.");
      return;
    }

    const response = await fetch(`/api/khpos/ops/work/${organisationId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const body = (await response.json()) as {
      ok?: boolean;
      work?: KhposOpsMyWork;
      error?: string;
    };

    if (!response.ok || !body.ok || !body.work) {
      setError(body.error ?? "My Work could not be loaded.");
      return;
    }

    setWork(body.work);
    setError("");
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId]);

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

    setBusyId(null);

    if (!response.ok || !body.ok || !body.work) {
      setError(body.error ?? "The work action could not be completed.");
      return;
    }

    setWork(body.work);
  }

  if (!work && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-mint-300" />
          <p className="mt-4 text-sm font-semibold text-slate-300">
            Loading your institutional work…
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
          <h1 className="mt-4 text-2xl font-black">My Work is unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <Link
            href={`/khpos/${organisationId}`}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950"
          >
            <ArrowLeft className="size-4" />
            Command Centre
          </Link>
        </div>
      </main>
    );
  }

  const openItems = work.items.filter((item) => item.status !== "completed");
  const completedItems = work.items.filter((item) => item.status === "completed");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex items-center justify-between gap-4">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-bold text-mint-200">
              Operations · O3
            </span>
            <Link
              href={`/khpos/${organisationId}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black text-white"
            >
              <ArrowLeft className="size-4" />
              Command Centre
            </Link>
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
            My Work
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
            Your role decides what appears here. Recurring institutional responsibilities become work automatically; completion is tied to the required checklist and evidence rather than verbal confirmation.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["All", work.summary.total],
              ["Due today", work.summary.dueToday],
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
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {openItems.length === 0 ? (
          <section className="rounded-[30px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto size-10 text-mint-700" />
            <h2 className="mt-4 text-2xl font-black">Nothing needs your action right now.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              KHP-OS does not create busywork. New responsibilities will appear here when your operating role, an active recurring rule, or a future issue/decision assigns work to you.
            </p>
            <Link
              href={`/khpos/${organisationId}/team`}
              className="mt-5 inline-flex text-sm font-black text-brand-700"
            >
              Review Team & Roles →
            </Link>
          </section>
        ) : (
          <section className="space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                Action queue
              </p>
              <h2 className="mt-2 text-2xl font-black">What needs your attention</h2>
            </div>

            {openItems.map((item) => {
              const note = notes[item.id] ?? "";
              const isBusy = busyId === item.id;

              return (
                <article
                  key={item.id}
                  className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.processCode && (
                          <span className="rounded-full bg-brand-50 px-3 py-1 text-[11px] font-black text-brand-800">
                            {item.processCode}
                          </span>
                        )}
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black capitalize text-slate-600">
                          {statusLabel(item.status)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black capitalize text-slate-600">
                          {item.priority}
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-black">{item.title}</h3>
                      {item.description && (
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                          {item.description}
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
                        <span>{item.roleTitle}</span>
                        {item.campusName && <span>{item.campusName}</span>}
                        {item.unitName && <span>{item.unitName}</span>}
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="size-3.5" />
                          {formatDate(item.dueAt)}
                        </span>
                      </div>
                    </div>

                    {item.status === "blocked" && (
                      <div className="max-w-sm rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <div className="flex gap-2 font-black">
                          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                          Blocked
                        </div>
                        <p className="mt-2 leading-6">{item.blockedReason}</p>
                      </div>
                    )}
                  </div>

                  {item.checklist && (
                    <section className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex items-center gap-3">
                        <ClipboardCheck className="size-5 text-brand-700" />
                        <div>
                          <p className="text-sm font-black">{item.checklist.name}</p>
                          <p className="text-xs text-slate-500">{item.checklist.code}</p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {item.checklist.items.map((check) => {
                          const answered = check.response !== null;
                          const booleanValue =
                            check.response === true
                              ? true
                              : check.response === false
                                ? false
                                : null;

                          return (
                            <div
                              key={check.id}
                              className="rounded-2xl border border-slate-200 bg-white p-4"
                            >
                              <div className="flex items-start gap-3">
                                {answered ? (
                                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-mint-700" />
                                ) : (
                                  <Circle className="mt-0.5 size-5 shrink-0 text-slate-300" />
                                )}
                                <div className="flex-1">
                                  <p className="text-sm font-bold text-slate-900">
                                    {check.label}
                                    {check.required && <span className="text-red-600"> *</span>}
                                  </p>
                                  {check.guidance && (
                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                      {check.guidance}
                                    </p>
                                  )}

                                  {check.responseType === "boolean" ? (
                                    <div className="mt-3 flex gap-2">
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() =>
                                          void act(item, {
                                            action: "checklist",
                                            templateItemId: check.id,
                                            response: true,
                                          })
                                        }
                                        className={`rounded-full px-4 py-2 text-xs font-black ${
                                          booleanValue === true
                                            ? "bg-mint-700 text-white"
                                            : "border border-slate-200 bg-white text-slate-700"
                                        }`}
                                      >
                                        Yes
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() =>
                                          void act(item, {
                                            action: "checklist",
                                            templateItemId: check.id,
                                            response: false,
                                          })
                                        }
                                        className={`rounded-full px-4 py-2 text-xs font-black ${
                                          booleanValue === false
                                            ? "bg-amber-600 text-white"
                                            : "border border-slate-200 bg-white text-slate-700"
                                        }`}
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <input
                                      defaultValue={
                                        typeof check.response === "string"
                                          ? check.response
                                          : ""
                                      }
                                      disabled={isBusy}
                                      onBlur={(event) => {
                                        const value = event.currentTarget.value.trim();
                                        if (!value) return;
                                        void act(item, {
                                          action: "checklist",
                                          templateItemId: check.id,
                                          response: value,
                                        });
                                      }}
                                      className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                                      placeholder="Enter response"
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  <section className="mt-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                        Evidence / operating note
                      </p>
                      <span className="text-xs font-bold text-slate-500">
                        {item.evidenceCount} record{item.evidenceCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={note}
                        onChange={(event) =>
                          setNotes((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        placeholder={
                          item.evidenceRequired
                            ? "Add required evidence note"
                            : "Add a note or explain a blockage"
                        }
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                      />
                      <button
                        type="button"
                        disabled={isBusy || !note.trim()}
                        onClick={() =>
                          void act(item, {
                            action: "evidence",
                            evidenceType: "note",
                            note: note.trim(),
                          }).then(() =>
                            setNotes((current) => ({ ...current, [item.id]: "" })),
                          )
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700 disabled:opacity-50"
                      >
                        <FileCheck2 className="size-4" />
                        Add evidence
                      </button>
                    </div>
                  </section>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {(item.status === "pending" || item.status === "blocked") && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void act(item, { action: "start" })}
                        className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
                      >
                        {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                        {item.status === "blocked" ? "Resume" : "Start"}
                      </button>
                    )}
                    {item.status !== "awaiting_verification" && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void act(item, {
                            action: "block",
                            note: note.trim(),
                          })
                        }
                        className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-black text-amber-900 disabled:opacity-60"
                      >
                        <AlertTriangle className="size-4" />
                        Block
                      </button>
                    )}
                    {item.status !== "blocked" && item.status !== "awaiting_verification" && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void act(item, { action: "complete" })}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
                      >
                        <CheckCircle2 className="size-4" />
                        Complete
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {completedItems.length > 0 && (
          <section>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Recent completion
            </p>
            <div className="mt-3 space-y-2">
              {completedItems.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <CheckCircle2 className="size-5 shrink-0 text-mint-700" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{item.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.processCode ?? "Operational work"}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-slate-500">
                    {formatDate(item.completedAt)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
