"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  History,
  ListTodo,
  Loader2,
  MessageSquareText,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsDecision,
  KhposOpsDecisionsWorkspace,
  KhposOpsDecisionPriority,
} from "@/lib/khpos/ops/decisions";

const categories = [
  ["governance", "Governance"],
  ["academic", "Academic"],
  ["people", "People & staff"],
  ["finance", "Finance"],
  ["campus", "Campus & operations"],
  ["parent", "Parent experience"],
  ["event", "Events & programmes"],
  ["technology", "Technology"],
  ["strategic", "Strategic / reserved"],
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

function priorityClasses(priority: KhposOpsDecisionPriority) {
  if (priority === "P1") return "border-red-200 bg-red-50 text-red-800";
  if (priority === "P2") return "border-amber-200 bg-amber-50 text-amber-900";
  if (priority === "P3") return "border-brand-200 bg-brand-50 text-brand-800";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function statusClasses(status: KhposOpsDecision["status"]) {
  if (status === "closed" || status === "implemented")
    return "bg-emerald-50 text-emerald-800";
  if (status === "approved") return "bg-mint-50 text-mint-800";
  if (status === "rejected" || status === "withdrawn")
    return "bg-slate-100 text-slate-700";
  if (status === "returned") return "bg-amber-50 text-amber-900";
  if (status === "under_review") return "bg-brand-50 text-brand-800";
  return "bg-violet-50 text-violet-800";
}

type DecisionMode = "request" | "record";

export function DecisionsWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] = useState<KhposOpsDecisionsWorkspace | null>(
    null,
  );
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [decisionMode, setDecisionMode] = useState<DecisionMode>("request");
  const [requesterAssignmentId, setRequesterAssignmentId] = useState("");
  const [authorityRoleId, setAuthorityRoleId] = useState("");
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [category, setCategory] = useState("operational");
  const [priority, setPriority] =
    useState<KhposOpsDecisionPriority>("P3");
  const [recommendation, setRecommendation] = useState("");
  const [decisionDueAt, setDecisionDueAt] = useState("");
  const [decisionText, setDecisionText] = useState("");
  const [recordActionRequired, setRecordActionRequired] = useState(false);
  const [recordOwnerId, setRecordOwnerId] = useState("");
  const [recordActionTitle, setRecordActionTitle] = useState("");
  const [recordActionOutcome, setRecordActionOutcome] = useState("");
  const [recordActionDueAt, setRecordActionDueAt] = useState("");

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [approveAction, setApproveAction] = useState<Record<string, boolean>>(
    {},
  );
  const [approveOwner, setApproveOwner] = useState<Record<string, string>>({});
  const [approveTitle, setApproveTitle] = useState<Record<string, string>>({});
  const [approveOutcome, setApproveOutcome] = useState<Record<string, string>>(
    {},
  );
  const [approveDue, setApproveDue] = useState<Record<string, string>>({});

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
        `/api/khpos/ops/decisions/${organisationId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        decisions?: KhposOpsDecisionsWorkspace;
        error?: string;
      };

      if (!active) return;

      if (!response.ok || !body.ok || !body.decisions) {
        setError(body.error ?? "Decisions could not be loaded.");
        return;
      }

      setWorkspace(body.decisions);
      const primary =
        body.decisions.actorAssignments.find(
          (assignment) => assignment.primaryAssignment,
        ) ?? body.decisions.actorAssignments[0];

      if (primary) {
        setRequesterAssignmentId((current) => current || primary.id);
        const authority = body.decisions.authorityOptions
          .filter(
            (option) => option.requesterAssignmentId === primary.id,
          )
          .sort((a, b) => a.depth - b.depth)[0];
        setAuthorityRoleId((current) => current || authority?.roleId || "");
      }

      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  const selectedAssignment = workspace?.actorAssignments.find(
    (assignment) => assignment.id === requesterAssignmentId,
  );

  const authorityOptions = useMemo(() => {
    return (
      workspace?.authorityOptions
        .filter(
          (option) => option.requesterAssignmentId === requesterAssignmentId,
        )
        .sort((a, b) => a.depth - b.depth) ?? []
    );
  }, [requesterAssignmentId, workspace]);

  function chooseAssignment(id: string) {
    setRequesterAssignmentId(id);
    if (!workspace) return;

    if (decisionMode === "record") {
      const assignment = workspace.actorAssignments.find(
        (item) => item.id === id,
      );
      setAuthorityRoleId(assignment?.roleId ?? "");
      return;
    }

    const next = workspace.authorityOptions
      .filter((option) => option.requesterAssignmentId === id)
      .sort((a, b) => a.depth - b.depth)[0];
    setAuthorityRoleId(next?.roleId ?? "");
  }

  function changeMode(mode: DecisionMode) {
    setDecisionMode(mode);
    if (!workspace) return;

    if (mode === "record") {
      const leadership =
        workspace.actorAssignments.find(
          (assignment) =>
            assignment.id === requesterAssignmentId &&
            assignment.canRecordDecision,
        ) ??
        workspace.actorAssignments.find(
          (assignment) => assignment.canRecordDecision,
        );
      if (leadership) {
        setRequesterAssignmentId(leadership.id);
        setAuthorityRoleId(leadership.roleId);
      } else {
        setAuthorityRoleId("");
      }
    } else {
      const assignment =
        workspace.actorAssignments.find(
          (item) => item.id === requesterAssignmentId,
        ) ?? workspace.actorAssignments[0];

      if (assignment) {
        setRequesterAssignmentId(assignment.id);
        const next = workspace.authorityOptions
          .filter(
            (option) => option.requesterAssignmentId === assignment.id,
          )
          .sort((a, b) => a.depth - b.depth)[0];
        setAuthorityRoleId(next?.roleId ?? "");
      }
    }
  }

  async function submit(payload: Record<string, unknown>, busyKey: string) {
    const accessToken = await token();
    if (!accessToken) {
      setError("Your session has ended. Sign in again to continue.");
      return false;
    }

    setBusyId(busyKey);
    setError("");

    const response = await fetch(
      `/api/khpos/ops/decisions/${organisationId}`,
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
      decisions?: KhposOpsDecisionsWorkspace;
      error?: string;
    };

    setBusyId(null);

    if (!response.ok || !body.ok || !body.decisions) {
      setError(body.error ?? "Decision operation could not be completed.");
      return false;
    }

    setWorkspace(body.decisions);
    return true;
  }

  async function createDecision() {
    if (
      !requesterAssignmentId ||
      !authorityRoleId ||
      !title.trim() ||
      !context.trim()
    ) {
      setError(
        "Choose your operating role and decision authority, then add a title and context.",
      );
      return;
    }

    if (decisionMode === "record" && !decisionText.trim()) {
      setError("A recorded decision must state the decision made.");
      return;
    }

    if (
      decisionMode === "record" &&
      recordActionRequired &&
      (!recordOwnerId ||
        !recordActionTitle.trim() ||
        !recordActionOutcome.trim() ||
        !recordActionDueAt)
    ) {
      setError(
        "Action owner, action title, expected outcome and deadline are required when a recorded decision creates implementation work.",
      );
      return;
    }

    const ok = await submit(
      {
        mode: "create",
        decisionMode,
        requesterAssignmentId,
        authorityRoleId,
        title: title.trim(),
        context: context.trim(),
        category,
        priority,
        recommendation: recommendation.trim() || null,
        decisionDueAt: decisionDueAt
          ? new Date(decisionDueAt).toISOString()
          : null,
        decisionText: decisionText.trim() || null,
        actionRequired:
          decisionMode === "record" ? recordActionRequired : false,
        implementationOwnerAssignmentId:
          decisionMode === "record" && recordActionRequired
            ? recordOwnerId
            : null,
        implementationTitle:
          decisionMode === "record" && recordActionRequired
            ? recordActionTitle.trim()
            : null,
        implementationExpectedOutcome:
          decisionMode === "record" && recordActionRequired
            ? recordActionOutcome.trim()
            : null,
        implementationDueAt:
          decisionMode === "record" &&
          recordActionRequired &&
          recordActionDueAt
            ? new Date(recordActionDueAt).toISOString()
            : null,
      },
      "create",
    );

    if (ok) {
      setTitle("");
      setContext("");
      setRecommendation("");
      setDecisionDueAt("");
      setDecisionText("");
      setRecordActionRequired(false);
      setRecordOwnerId("");
      setRecordActionTitle("");
      setRecordActionOutcome("");
      setRecordActionDueAt("");
      setShowCreate(false);
    }
  }

  async function act(
    decision: KhposOpsDecision,
    action:
      | "review"
      | "return"
      | "resubmit"
      | "approve"
      | "reject"
      | "withdraw"
      | "close"
      | "comment",
  ) {
    const note = notes[decision.id]?.trim() ?? "";
    const noteRequired = [
      "return",
      "resubmit",
      "approve",
      "reject",
      "withdraw",
      "comment",
    ].includes(action);

    if (noteRequired && !note) {
      setError("Add the required decision note before taking this action.");
      return;
    }

    const actionRequired =
      action === "approve" ? approveAction[decision.id] ?? false : false;

    if (
      action === "approve" &&
      actionRequired &&
      (!approveOwner[decision.id] ||
        !approveTitle[decision.id]?.trim() ||
        !approveOutcome[decision.id]?.trim() ||
        !approveDue[decision.id])
    ) {
      setError(
        "Approved implementation requires an owner, action, expected outcome and deadline.",
      );
      return;
    }

    const ok = await submit(
      {
        mode: "action",
        decisionId: decision.id,
        action,
        actionPayload: {
          note: note || undefined,
          actionRequired,
          implementationOwnerAssignmentId: actionRequired
            ? approveOwner[decision.id]
            : null,
          implementationTitle: actionRequired
            ? approveTitle[decision.id]?.trim()
            : null,
          implementationExpectedOutcome: actionRequired
            ? approveOutcome[decision.id]?.trim()
            : null,
          implementationDueAt:
            actionRequired && approveDue[decision.id]
              ? new Date(approveDue[decision.id]).toISOString()
              : null,
        },
      },
      decision.id,
    );

    if (ok) {
      setNotes((current) => ({ ...current, [decision.id]: "" }));
    }
  }

  if (!workspace && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-mint-300" />
          <p className="mt-4 text-sm font-semibold text-slate-300">
            Loading decisions…
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
          <h1 className="mt-4 text-2xl font-black">Decisions are unavailable</h1>
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

  const canRecord = workspace.actorAssignments.some(
    (assignment) => assignment.canRecordDecision,
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex items-center justify-between gap-4">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-bold text-mint-200">
              Operations · O5
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
                Decisions & Approvals
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
                Make authority visible. Decisions move up the real reporting
                chain, then approved actions move into My Work with an owner,
                outcome, deadline and evidence.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate((value) => !value)}
              disabled={workspace.actorAssignments.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-mint-300 px-5 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-4" />
              New decision
            </button>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Pending", workspace.summary.pending],
              ["Waiting for me", workspace.summary.waitingForMe],
              ["Overdue", workspace.summary.overdue],
              ["Implemented", workspace.summary.implemented],
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

        {workspace.actorAssignments.length === 0 && (
          <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm">
            <h2 className="font-black">Your operating role is not assigned yet.</h2>
            <p className="mt-2 text-sm leading-6">
              KHP-OS will not guess authority. Assign your real KNS role in Team
              & Roles first; decision routing will then follow the actual
              reporting line.
            </p>
            <Link
              href={`/khpos/${organisationId}/team`}
              className="mt-4 inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
            >
              Open Team & Roles
            </Link>
          </section>
        )}

        {showCreate && workspace.actorAssignments.length > 0 && (
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                  Authority workflow
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {decisionMode === "request"
                    ? "Request a decision"
                    : "Record a decision you made"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  {decisionMode === "request"
                    ? "KHP-OS only offers authority roles above the role you are acting in."
                    : "Direct recording is limited to active leadership roles and records the authority that made the decision."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="self-start rounded-full border border-slate-200 p-2 text-slate-500"
                aria-label="Close decision form"
              >
                <XCircle className="size-5" />
              </button>
            </div>

            <div className="mt-6 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => changeMode("request")}
                className={`rounded-full px-4 py-2 text-xs font-black ${
                  decisionMode === "request"
                    ? "bg-slate-950 text-white"
                    : "text-slate-600"
                }`}
              >
                Request authority
              </button>
              <button
                type="button"
                disabled={!canRecord}
                onClick={() => changeMode("record")}
                className={`rounded-full px-4 py-2 text-xs font-black disabled:opacity-40 ${
                  decisionMode === "record"
                    ? "bg-slate-950 text-white"
                    : "text-slate-600"
                }`}
              >
                Record decision
              </button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="text-sm font-bold">
                Acting as
                <select
                  value={requesterAssignmentId}
                  onChange={(event) => chooseAssignment(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                >
                  {workspace.actorAssignments
                    .filter(
                      (assignment) =>
                        decisionMode === "request" ||
                        assignment.canRecordDecision,
                    )
                    .map((assignment) => (
                      <option key={assignment.id} value={assignment.id}>
                        {assignment.roleTitle}
                        {assignment.unitName
                          ? ` · ${assignment.unitName}`
                          : assignment.campusName
                            ? ` · ${assignment.campusName}`
                            : ""}
                      </option>
                    ))}
                </select>
              </label>

              {decisionMode === "request" ? (
                <label className="text-sm font-bold">
                  Decision authority
                  <select
                    value={authorityRoleId}
                    onChange={(event) =>
                      setAuthorityRoleId(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                  >
                    {authorityOptions.length === 0 && (
                      <option value="">No higher authority in this chain</option>
                    )}
                    {authorityOptions.map((option) => (
                      <option
                        key={`${option.requesterAssignmentId}-${option.roleId}`}
                        value={option.roleId}
                      >
                        {option.roleTitle}
                        {option.depth === 1 ? " · immediate" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="rounded-2xl border border-mint-200 bg-mint-50 p-4 text-sm text-mint-950">
                  <p className="font-black">Authority recorded as</p>
                  <p className="mt-1">
                    {selectedAssignment?.roleTitle ?? "Leadership role"}
                  </p>
                </div>
              )}

              <label className="text-sm font-bold">
                Decision title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={180}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                  placeholder="What needs to be decided?"
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
                  Priority
                  <select
                    value={priority}
                    onChange={(event) =>
                      setPriority(
                        event.target.value as KhposOpsDecisionPriority,
                      )
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
                Context
                <textarea
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  maxLength={6000}
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                  placeholder="State the facts, constraint, impact and what decision is needed."
                />
              </label>

              {decisionMode === "request" ? (
                <>
                  <label className="text-sm font-bold">
                    Recommendation / preferred option
                    <textarea
                      value={recommendation}
                      onChange={(event) =>
                        setRecommendation(event.target.value)
                      }
                      maxLength={4000}
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                      placeholder="What do you recommend and why?"
                    />
                  </label>

                  <label className="text-sm font-bold">
                    Decision needed by
                    <input
                      type="datetime-local"
                      value={decisionDueAt}
                      onChange={(event) =>
                        setDecisionDueAt(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                    />
                  </label>
                </>
              ) : (
                <label className="text-sm font-bold lg:col-span-2">
                  Decision made
                  <textarea
                    value={decisionText}
                    onChange={(event) => setDecisionText(event.target.value)}
                    maxLength={6000}
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                    placeholder="Record the decision clearly enough that another leader can execute it."
                  />
                </label>
              )}
            </div>

            {decisionMode === "record" && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <label className="flex items-start gap-3 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={recordActionRequired}
                    onChange={(event) =>
                      setRecordActionRequired(event.target.checked)
                    }
                    className="mt-1 size-4"
                  />
                  <span>
                    This decision creates implementation work.
                    <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                      KHP-OS will create an evidence-required item in the
                      selected owner’s My Work queue.
                    </span>
                  </span>
                </label>

                {recordActionRequired && (
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <label className="text-sm font-bold">
                      Implementation owner
                      <select
                        value={recordOwnerId}
                        onChange={(event) =>
                          setRecordOwnerId(event.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                      >
                        <option value="">Choose owner</option>
                        {workspace.actionOwnerOptions.map((owner) => (
                          <option
                            key={owner.assignmentId}
                            value={owner.assignmentId}
                          >
                            {owner.displayName} · {owner.roleTitle}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm font-bold">
                      Action deadline
                      <input
                        type="datetime-local"
                        value={recordActionDueAt}
                        onChange={(event) =>
                          setRecordActionDueAt(event.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                      />
                    </label>

                    <label className="text-sm font-bold">
                      Action
                      <input
                        value={recordActionTitle}
                        onChange={(event) =>
                          setRecordActionTitle(event.target.value)
                        }
                        maxLength={180}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                      />
                    </label>

                    <label className="text-sm font-bold">
                      Expected outcome
                      <input
                        value={recordActionOutcome}
                        onChange={(event) =>
                          setRecordActionOutcome(event.target.value)
                        }
                        maxLength={4000}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              disabled={busyId === "create" || !authorityRoleId}
              onClick={() => void createDecision()}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
            >
              {busyId === "create" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : decisionMode === "request" ? (
                <Send className="size-4" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {decisionMode === "request"
                ? "Send decision request"
                : "Record decision"}
            </button>
          </section>
        )}

        {workspace.items.length === 0 ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <ShieldCheck className="mx-auto size-10 text-mint-700" />
            <h2 className="mt-4 text-2xl font-black">No decisions to show.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              This is deliberate. KHP-OS does not manufacture an approval queue.
              Material decisions appear here when a real role requests or records
              one.
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            {workspace.items.map((decision) => {
              const note = notes[decision.id] ?? "";
              const busy = busyId === decision.id;
              const actionRequired = approveAction[decision.id] ?? false;

              return (
                <article
                  key={decision.id}
                  className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-white">
                          {decision.reference}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-black ${priorityClasses(
                            decision.priority,
                          )}`}
                        >
                          {decision.priority}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-black capitalize ${statusClasses(
                            decision.status,
                          )}`}
                        >
                          {readable(decision.status)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold capitalize text-slate-600">
                          {readable(decision.category)}
                        </span>
                        <span className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-bold capitalize text-slate-500">
                          {decision.mode}
                        </span>
                      </div>

                      <h2 className="mt-3 text-xl font-black">
                        {decision.title}
                      </h2>
                      <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                        {decision.context}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
                        <span>
                          Requested by{" "}
                          {decision.requester.displayName ??
                            decision.requester.email ??
                            "role holder"}
                          {decision.requester.roleTitle
                            ? ` · ${decision.requester.roleTitle}`
                            : ""}
                        </span>
                        <span>
                          Authority: {decision.authority.roleTitle}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="size-3.5" />
                          {formatDate(decision.decisionDueAt)}
                        </span>
                      </div>

                      {decision.recommendation && (
                        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                            Recommendation
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">
                            {decision.recommendation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {decision.decisionText && (
                    <div className="mt-5 rounded-2xl border border-mint-200 bg-mint-50 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-mint-800">
                        Decision
                      </p>
                      <p className="mt-2 text-sm leading-6 text-mint-950">
                        {decision.decisionText}
                      </p>
                      {decision.decidedAt && (
                        <p className="mt-2 text-xs font-semibold text-mint-800">
                          Decided {formatDate(decision.decidedAt)}
                        </p>
                      )}
                    </div>
                  )}

                  {decision.work && (
                    <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-700">
                            Implementation in My Work
                          </p>
                          <p className="mt-2 text-sm font-black text-brand-950">
                            {decision.work.title}
                          </p>
                          <p className="mt-1 text-xs font-semibold capitalize text-brand-700">
                            {readable(decision.work.status)} ·{" "}
                            {formatDate(decision.work.dueAt)}
                          </p>
                        </div>
                        <Link
                          href={`/khpos/${organisationId}/work`}
                          className="inline-flex items-center gap-2 rounded-full bg-brand-800 px-4 py-2 text-xs font-black text-white"
                        >
                          <ListTodo className="size-3.5" />
                          Open My Work
                        </Link>
                      </div>
                    </div>
                  )}

                  {decision.isAuthority &&
                    (decision.status === "submitted" ||
                      decision.status === "under_review") && (
                      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <label className="flex items-start gap-3 text-sm font-bold">
                          <input
                            type="checkbox"
                            checked={actionRequired}
                            onChange={(event) =>
                              setApproveAction((current) => ({
                                ...current,
                                [decision.id]: event.target.checked,
                              }))
                            }
                            className="mt-1 size-4"
                          />
                          <span>
                            Approval creates implementation work.
                            <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                              The action will enter the selected owner’s My Work
                              queue and require evidence before completion.
                            </span>
                          </span>
                        </label>

                        {actionRequired && (
                          <div className="mt-4 grid gap-3 lg:grid-cols-2">
                            <label className="text-xs font-black">
                              Owner
                              <select
                                value={approveOwner[decision.id] ?? ""}
                                onChange={(event) =>
                                  setApproveOwner((current) => ({
                                    ...current,
                                    [decision.id]: event.target.value,
                                  }))
                                }
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                              >
                                <option value="">Choose owner</option>
                                {workspace.actionOwnerOptions.map((owner) => (
                                  <option
                                    key={owner.assignmentId}
                                    value={owner.assignmentId}
                                  >
                                    {owner.displayName} · {owner.roleTitle}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="text-xs font-black">
                              Deadline
                              <input
                                type="datetime-local"
                                value={approveDue[decision.id] ?? ""}
                                onChange={(event) =>
                                  setApproveDue((current) => ({
                                    ...current,
                                    [decision.id]: event.target.value,
                                  }))
                                }
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                              />
                            </label>

                            <label className="text-xs font-black">
                              Action
                              <input
                                value={approveTitle[decision.id] ?? ""}
                                onChange={(event) =>
                                  setApproveTitle((current) => ({
                                    ...current,
                                    [decision.id]: event.target.value,
                                  }))
                                }
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                              />
                            </label>

                            <label className="text-xs font-black">
                              Expected outcome
                              <input
                                value={approveOutcome[decision.id] ?? ""}
                                onChange={(event) =>
                                  setApproveOutcome((current) => ({
                                    ...current,
                                    [decision.id]: event.target.value,
                                  }))
                                }
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    )}

                  {decision.status !== "closed" && (
                    <div className="mt-5">
                      <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        Decision note
                        <input
                          value={note}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [decision.id]: event.target.value,
                            }))
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal normal-case tracking-normal outline-none focus:border-brand-400"
                          placeholder="Decision, reason, clarification or record note"
                        />
                      </label>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2">
                    {decision.isAuthority && decision.status === "submitted" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(decision, "review")}
                        className="rounded-full bg-brand-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                      >
                        Start review
                      </button>
                    )}

                    {decision.isAuthority &&
                      (decision.status === "submitted" ||
                        decision.status === "under_review") && (
                        <>
                          <button
                            type="button"
                            disabled={busy || !note.trim()}
                            onClick={() => void act(decision, "approve")}
                            className="inline-flex items-center gap-2 rounded-full bg-mint-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                          >
                            <CheckCircle2 className="size-3.5" />
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busy || !note.trim()}
                            onClick={() => void act(decision, "return")}
                            className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-black text-amber-900 disabled:opacity-50"
                          >
                            <RotateCcw className="size-3.5" />
                            Return
                          </button>
                          <button
                            type="button"
                            disabled={busy || !note.trim()}
                            onClick={() => void act(decision, "reject")}
                            className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-black text-red-800 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}

                    {decision.isRequester && decision.status === "returned" && (
                      <button
                        type="button"
                        disabled={busy || !note.trim()}
                        onClick={() => void act(decision, "resubmit")}
                        className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                      >
                        <Send className="size-3.5" />
                        Resubmit
                      </button>
                    )}

                    {decision.isRequester &&
                      decision.mode === "request" &&
                      ["submitted", "under_review", "returned"].includes(
                        decision.status,
                      ) && (
                        <button
                          type="button"
                          disabled={busy || !note.trim()}
                          onClick={() => void act(decision, "withdraw")}
                          className="rounded-full border border-slate-300 px-4 py-2 text-xs font-black text-slate-700 disabled:opacity-50"
                        >
                          Withdraw
                        </button>
                      )}

                    {(decision.isRequester || decision.isAuthority) &&
                      (["rejected", "withdrawn", "implemented"].includes(
                        decision.status,
                      ) ||
                        (decision.status === "approved" &&
                          !decision.actionRequired)) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void act(decision, "close")}
                          className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                        >
                          Close
                        </button>
                      )}

                    {decision.status !== "closed" && (
                      <button
                        type="button"
                        disabled={busy || !note.trim()}
                        onClick={() => void act(decision, "comment")}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 disabled:opacity-50"
                      >
                        <MessageSquareText className="size-3.5" />
                        Add note
                      </button>
                    )}

                    {busy && (
                      <Loader2 className="mt-1 size-5 animate-spin text-brand-700" />
                    )}
                  </div>

                  <details className="mt-6 border-t border-slate-100 pt-4">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black text-slate-700">
                      <History className="size-4" />
                      Decision history
                      <ChevronDown className="size-4" />
                    </summary>
                    <div className="mt-4 space-y-3">
                      {decision.history.map((event, index) => (
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
