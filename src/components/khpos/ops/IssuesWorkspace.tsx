"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  CornerUpRight,
  History,
  Loader2,
  MessageSquareText,
  Play,
  Plus,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsIssue,
  KhposOpsIssuesWorkspace,
  KhposOpsIssueSeverity,
} from "@/lib/khpos/ops/issues";

const categories = [
  ["operational", "Operational"],
  ["academic", "Academic"],
  ["learner_progress", "Learner progress"],
  ["people", "People & staff"],
  ["parent", "Parent experience"],
  ["finance", "Finance"],
  ["campus", "Campus & facilities"],
  ["event", "Events & programmes"],
  ["technology", "Technology"],
  ["other", "Other"],
] as const;

function formatDate(value: string | null) {
  if (!value) return "No fixed deadline";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function severityClasses(severity: KhposOpsIssueSeverity) {
  if (severity === "P1") return "bg-red-50 text-red-800 border-red-200";
  if (severity === "P2") return "bg-amber-50 text-amber-900 border-amber-200";
  if (severity === "P3") return "bg-brand-50 text-brand-800 border-brand-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function statusClasses(status: KhposOpsIssue["status"]) {
  if (status === "closed" || status === "verified")
    return "bg-emerald-50 text-emerald-800";
  if (status === "resolved") return "bg-mint-50 text-mint-800";
  if (status === "awaiting") return "bg-amber-50 text-amber-900";
  if (status === "in_action") return "bg-brand-50 text-brand-800";
  return "bg-slate-100 text-slate-700";
}

export function IssuesWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] = useState<KhposOpsIssuesWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("operational");
  const [severity, setSeverity] = useState<KhposOpsIssueSeverity>("P3");
  const [dueAt, setDueAt] = useState("");

  async function token() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setError("Your session has ended. Sign in again to continue.");
        return;
      }

      const response = await fetch(
        `/api/khpos/ops/issues/${organisationId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        issues?: KhposOpsIssuesWorkspace;
        error?: string;
      };

      if (!active) return;
      if (!response.ok || !body.ok || !body.issues) {
        setError(body.error ?? "Issues could not be loaded.");
        return;
      }

      setWorkspace(body.issues);
      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  async function submit(payload: Record<string, unknown>, busyKey: string) {
    const accessToken = await token();
    if (!accessToken) {
      setError("Your session has ended. Sign in again to continue.");
      return false;
    }

    setBusyId(busyKey);
    setError("");

    const response = await fetch(
      `/api/khpos/ops/issues/${organisationId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const body = (await response.json()) as {
      ok?: boolean;
      issues?: KhposOpsIssuesWorkspace;
      error?: string;
    };

    setBusyId(null);

    if (!response.ok || !body.ok || !body.issues) {
      setError(body.error ?? "Issue operation could not be completed.");
      return false;
    }

    setWorkspace(body.issues);
    return true;
  }

  async function createIssue() {
    if (!title.trim() || !description.trim()) {
      setError("Give the issue a clear title and description.");
      return;
    }

    const ok = await submit(
      {
        mode: "create",
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      },
      "create",
    );

    if (ok) {
      setTitle("");
      setDescription("");
      setCategory("operational");
      setSeverity("P3");
      setDueAt("");
      setShowCreate(false);
    }
  }

  async function act(
    issue: KhposOpsIssue,
    action:
      | "claim"
      | "start"
      | "await"
      | "resolve"
      | "verify"
      | "close"
      | "escalate"
      | "comment",
  ) {
    const note = notes[issue.id]?.trim() ?? "";
    const needsNote = ["await", "resolve", "escalate", "comment"].includes(action);

    if (needsNote && !note) {
      setError("Add the required note before taking this action.");
      return;
    }

    const ok = await submit(
      {
        mode: "action",
        issueId: issue.id,
        action,
        note: note || undefined,
      },
      issue.id,
    );

    if (ok && note) {
      setNotes((current) => ({ ...current, [issue.id]: "" }));
    }
  }

  if (!workspace && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-mint-300" />
          <p className="mt-4 text-sm font-semibold text-slate-300">
            Loading institutional issues…
          </p>
        </div>
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <CircleAlert className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Issues are unavailable</h1>
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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex items-center justify-between gap-4">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-bold text-mint-200">
              Operations · O4
            </span>
            <Link
              href={`/khpos/${organisationId}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black"
            >
              <ArrowLeft className="size-4" />
              Command Centre
            </Link>
          </div>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                Issues & Escalations
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
                A deviation does not disappear into WhatsApp or memory. It gets an owner, severity, status, evidence, escalation route and verified closure.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate((value) => !value)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-mint-300 px-5 py-3 text-sm font-black text-slate-950"
            >
              <Plus className="size-4" />
              Report issue
            </button>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Open", workspace.summary.open],
              ["P1 critical", workspace.summary.critical],
              ["Overdue", workspace.summary.overdue],
              ["Resolved / verified", workspace.summary.resolvedAwaitingClosure],
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

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 sm:py-10">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {workspace.summary.restrictedOwnedOrReported > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
            <strong>Restricted case present.</strong> Sensitive safeguarding or similarly restricted case details are intentionally excluded from this standard issue workspace.
          </div>
        )}

        {showCreate && (
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                  Report deviation
                </p>
                <h2 className="mt-2 text-2xl font-black">Create a standard issue</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500"
                aria-label="Close issue form"
              >
                <XCircle className="size-5" />
              </button>
            </div>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Use this for operational issues. Do not place confidential safeguarding disclosure details in the standard issue queue.
            </p>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="text-sm font-bold">
                Issue title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={180}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                  placeholder="What is off track?"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-bold">
                  Category
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                  >
                    {categories.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-bold">
                  Severity
                  <select
                    value={severity}
                    onChange={(event) =>
                      setSeverity(event.target.value as KhposOpsIssueSeverity)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                  >
                    <option value="P1">P1 · Critical</option>
                    <option value="P2">P2 · High</option>
                    <option value="P3">P3 · Standard</option>
                    <option value="P4">P4 · Planned</option>
                  </select>
                </label>
              </div>

              <label className="text-sm font-bold lg:col-span-2">
                What happened?
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={4000}
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                  placeholder="Describe the deviation, impact and what is known."
                />
              </label>

              <label className="text-sm font-bold">
                Resolution deadline
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                />
              </label>
            </div>

            <button
              type="button"
              disabled={busyId === "create"}
              onClick={() => void createIssue()}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
            >
              {busyId === "create" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CircleAlert className="size-4" />
              )}
              Create issue
            </button>
          </section>
        )}

        {workspace.items.length === 0 ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto size-10 text-mint-700" />
            <h2 className="mt-4 text-2xl font-black">No visible issues.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              When work is blocked or a required checklist control fails, O4 can create the issue automatically. Manual operational issues can also be reported here.
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            {workspace.items.map((issue) => {
              const note = notes[issue.id] ?? "";
              const busy = busyId === issue.id;
              const canVerify =
                !issue.isOwner &&
                issue.status === "resolved" &&
                (issue.isReporter ||
                  issue.isDirectManager ||
                  issue.isEscalationRecipient);
              const canClose =
                issue.status === "verified" &&
                (issue.isReporter ||
                  issue.isDirectManager ||
                  issue.isEscalationRecipient);
              const canEscalate =
                !["verified", "closed"].includes(issue.status) &&
                (issue.isOwner ||
                  issue.isReporter ||
                  issue.isDirectManager ||
                  issue.isEscalationRecipient);

              return (
                <article
                  key={issue.id}
                  id={`issue-${issue.id}`}
                  className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-white">
                          {issue.reference}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-black ${severityClasses(issue.severity)}`}
                        >
                          {issue.severity}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-black capitalize ${statusClasses(issue.status)}`}
                        >
                          {readable(issue.status)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold capitalize text-slate-600">
                          {readable(issue.category)}
                        </span>
                      </div>

                      <h2 className="mt-3 text-xl font-black">{issue.title}</h2>
                      <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                        {issue.description}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="size-3.5" />
                          {formatDate(issue.dueAt)}
                        </span>
                        {issue.owner && (
                          <span>
                            Owner: {issue.owner.displayName ?? issue.owner.email} ·{" "}
                            {issue.owner.roleTitle}
                          </span>
                        )}
                        {issue.process && (
                          <span>
                            {issue.process.code} · {issue.process.title}
                          </span>
                        )}
                      </div>

                      {issue.sourceWorkTitle && (
                        <p className="mt-3 text-xs font-semibold text-slate-500">
                          Source work: {issue.sourceWorkTitle}
                        </p>
                      )}
                    </div>

                    {issue.escalatedToTitle && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                        <div className="flex items-center gap-2 font-black">
                          <CornerUpRight className="size-4" />
                          Escalated
                        </div>
                        <p className="mt-1">Visible to {issue.escalatedToTitle}</p>
                      </div>
                    )}
                  </div>

                  {issue.immediateAction && (
                    <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        Immediate action
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {issue.immediateAction}
                      </p>
                    </div>
                  )}

                  {issue.resolution && (
                    <div className="mt-5 rounded-2xl border border-mint-200 bg-mint-50 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-mint-800">
                        Resolution
                      </p>
                      <p className="mt-2 text-sm leading-6 text-mint-950">
                        {issue.resolution}
                      </p>
                    </div>
                  )}

                  {!["closed"].includes(issue.status) && (
                    <div className="mt-5">
                      <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        Action note
                        <input
                          value={note}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [issue.id]: event.target.value,
                            }))
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal normal-case tracking-normal outline-none focus:border-brand-400"
                          placeholder="Reason, resolution evidence, dependency or case note"
                        />
                      </label>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2">
                    {issue.status === "open" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(issue, "claim")}
                        className="rounded-full bg-brand-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                      >
                        Claim
                      </button>
                    )}

                    {issue.isOwner &&
                      (issue.status === "assigned" ||
                        issue.status === "awaiting") && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void act(issue, "start")}
                          className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                        >
                          <Play className="size-3.5" />
                          {issue.status === "awaiting" ? "Resume" : "Start"}
                        </button>
                      )}

                    {issue.isOwner && issue.status === "in_action" && (
                      <button
                        type="button"
                        disabled={busy || !note.trim()}
                        onClick={() => void act(issue, "await")}
                        className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-black text-amber-900 disabled:opacity-50"
                      >
                        Await dependency
                      </button>
                    )}

                    {issue.isOwner &&
                      (issue.status === "in_action" ||
                        issue.status === "awaiting") && (
                        <button
                          type="button"
                          disabled={busy || !note.trim()}
                          onClick={() => void act(issue, "resolve")}
                          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                        >
                          <CheckCircle2 className="size-3.5" />
                          Resolve
                        </button>
                      )}

                    {canVerify && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(issue, "verify")}
                        className="inline-flex items-center gap-2 rounded-full bg-mint-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                      >
                        <ShieldCheck className="size-3.5" />
                        Verify
                      </button>
                    )}

                    {canClose && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(issue, "close")}
                        className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                      >
                        Close
                      </button>
                    )}

                    {canEscalate && (
                      <button
                        type="button"
                        disabled={busy || !note.trim()}
                        onClick={() => void act(issue, "escalate")}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-black text-slate-700 disabled:opacity-50"
                      >
                        <CornerUpRight className="size-3.5" />
                        Escalate
                      </button>
                    )}

                    {issue.status !== "closed" && (
                      <button
                        type="button"
                        disabled={busy || !note.trim()}
                        onClick={() => void act(issue, "comment")}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 disabled:opacity-50"
                      >
                        <MessageSquareText className="size-3.5" />
                        Add note
                      </button>
                    )}

                    {busy && <Loader2 className="mt-1 size-5 animate-spin text-brand-700" />}
                  </div>

                  <details className="mt-6 border-t border-slate-100 pt-4">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black text-slate-700">
                      <History className="size-4" />
                      Case history
                      <ChevronDown className="size-4" />
                    </summary>
                    <div className="mt-4 space-y-3">
                      {issue.history.map((event, index) => (
                        <div
                          key={`${event.createdAt}-${index}`}
                          className="rounded-2xl bg-slate-50 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-black capitalize text-slate-800">
                              {readable(event.eventType)}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-500">
                              {formatDate(event.createdAt)}
                            </p>
                          </div>
                          {event.note && (
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {event.note}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
