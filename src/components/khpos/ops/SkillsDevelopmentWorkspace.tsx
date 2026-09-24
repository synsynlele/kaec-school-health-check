"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarCheck,
  CheckCircle2,
  Compass,
  Gauge,
  GitBranch,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UsersRound,
  Wrench,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsSkillCompetencyEvidence,
  KhposOpsSkillLearner,
  KhposOpsSkillOffering,
  KhposOpsSkillSelection,
  KhposOpsSkillSession,
  KhposOpsSkillWeeklyReview,
  KhposOpsSkillsWorkspace,
} from "@/lib/khpos/ops/skills-development";

function readable(value: string | null | undefined) {
  return (value ?? "—").replaceAll("_", " ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value + "T00:00:00"),
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (["active", "approved", "verified", "delivered", "recovered"].includes(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (["ready", "submitted", "planned", "foundation", "independent"].includes(status)) {
    return "border-brand-200 bg-brand-50 text-brand-800";
  }
  if (
    ["partial", "required", "missed", "returned", "pending", "applied"].includes(
      status,
    )
  ) {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  if (["blocked", "concern", "cancelled", "withdrawn", "rejected"].includes(status)) {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  return "border-slate-200 bg-slate-100 text-slate-600";
}

const competencyLabels = [
  ["exposure", "Exposure"],
  ["foundation", "Foundation"],
  ["independent", "Independent"],
  ["applied", "Applied"],
  ["value_creation", "Value Creation"],
] as const;

export function SkillsDevelopmentWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] = useState<KhposOpsSkillsWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busy, setBusy] = useState("");

  const [pathwayId, setPathwayId] = useState("");
  const [termId, setTermId] = useState("");
  const [campusId, setCampusId] = useState("");
  const [facilitatorAssignmentId, setFacilitatorAssignmentId] = useState("");
  const [weeklyTarget, setWeeklyTarget] = useState("4");
  const [capacity, setCapacity] = useState("15");

  const [learnerId, setLearnerId] = useState("");
  const [selectionOfferingId, setSelectionOfferingId] = useState("");
  const [selectionBasis, setSelectionBasis] = useState("learner_choice");
  const [selectionNote, setSelectionNote] = useState("");

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [references, setReferences] = useState<Record<string, string>>({});
  const [states, setStates] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});

  async function token() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function load() {
    const accessToken = await token();
    if (!accessToken) {
      setError("Your session has ended. Sign in again to continue.");
      return;
    }

    const response = await fetch(
      "/api/khpos/ops/skills-development/" + organisationId,
      {
        headers: { Authorization: "Bearer " + accessToken },
        cache: "no-store",
      },
    );
    const body = (await response.json()) as {
      ok?: boolean;
      skills?: KhposOpsSkillsWorkspace;
      error?: string;
    };

    if (!response.ok || !body.ok || !body.skills) {
      setError(body.error ?? "Skills Development could not be loaded.");
      return;
    }

    setWorkspace(body.skills);
    const activeTerm =
      body.skills.terms.find((term) => term.status === "active") ??
      body.skills.terms[0];
    const firstPathway = body.skills.pathways.find(
      (pathway) => pathway.status === "active",
    );
    const firstFacilitator = body.skills.assignments.find(
      (assignment) => assignment.roleCode === "SKILLS_FACILITATOR",
    );
    const firstLearner = body.skills.learners[0];
    const firstOffering = body.skills.offerings.find((offering) =>
      ["ready", "active"].includes(offering.status),
    );

    setTermId((current) => current || activeTerm?.id || "");
    setPathwayId((current) => current || firstPathway?.id || "");
    setFacilitatorAssignmentId(
      (current) => current || firstFacilitator?.id || "",
    );
    setLearnerId((current) => current || firstLearner?.id || "");
    setCampusId(
      (current) =>
        current ||
        firstLearner?.campusId ||
        firstFacilitator?.campusId ||
        body.skills.offerings[0]?.campusId ||
        "",
    );
    setSelectionOfferingId(
      (current) => current || firstOffering?.id || "",
    );
    setError("");
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
        "/api/khpos/ops/skills-development/" + organisationId,
        {
          headers: { Authorization: "Bearer " + accessToken },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        skills?: KhposOpsSkillsWorkspace;
        error?: string;
      };

      if (!active) return;
      if (!response.ok || !body.ok || !body.skills) {
        setError(body.error ?? "Skills Development could not be loaded.");
        return;
      }

      setWorkspace(body.skills);
      const activeTerm =
        body.skills.terms.find((term) => term.status === "active") ??
        body.skills.terms[0];
      const firstPathway = body.skills.pathways.find(
        (pathway) => pathway.status === "active",
      );
      const firstFacilitator = body.skills.assignments.find(
        (assignment) => assignment.roleCode === "SKILLS_FACILITATOR",
      );
      const firstLearner = body.skills.learners[0];
      const firstOffering = body.skills.offerings.find((offering) =>
        ["ready", "active"].includes(offering.status),
      );

      setTermId(activeTerm?.id ?? "");
      setPathwayId(firstPathway?.id ?? "");
      setFacilitatorAssignmentId(firstFacilitator?.id ?? "");
      setLearnerId(firstLearner?.id ?? "");
      setCampusId(
        firstLearner?.campusId ??
          firstFacilitator?.campusId ??
          body.skills.offerings[0]?.campusId ??
          "",
      );
      setSelectionOfferingId(firstOffering?.id ?? "");
      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  async function submit(payload: Record<string, unknown>, key: string) {
    const accessToken = await token();
    if (!accessToken) {
      setError("Your session has ended. Sign in again to continue.");
      return false;
    }

    setBusy(key);
    setError("");
    const response = await fetch(
      "/api/khpos/ops/skills-development/" + organisationId,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    const body = (await response.json()) as {
      ok?: boolean;
      skills?: KhposOpsSkillsWorkspace;
      error?: string;
    };
    setBusy("");

    if (!response.ok || !body.ok || !body.skills) {
      setError(body.error ?? "Skills Development operation could not be completed.");
      return false;
    }

    setWorkspace(body.skills);
    return true;
  }

  const learner =
    workspace?.learners.find((item) => item.id === learnerId) ?? null;
  const activeSelection =
    learner?.selections.find((selection) => selection.status === "active") ?? null;
  const activeOfferings =
    workspace?.offerings.filter((offering) =>
      ["ready", "active"].includes(offering.status),
    ) ?? [];
  const facilitators =
    workspace?.assignments.filter(
      (assignment) => assignment.roleCode === "SKILLS_FACILITATOR",
    ) ?? [];

  async function createOffering() {
    if (!pathwayId || !termId || !campusId) {
      setError("Offering requires pathway, term and campus.");
      return;
    }

    await submit(
      {
        mode: "create_offering",
        pathwayId,
        termId,
        campusId,
        facilitatorAssignmentId: facilitatorAssignmentId || null,
        weeklySessionTarget: weeklyTarget,
        capacity: capacity || null,
      },
      "create-offering",
    );
  }

  async function selectPathway() {
    if (!learnerId || !selectionOfferingId || !selectionNote.trim()) {
      setError("Selection requires learner, offering and a clear selection note.");
      return;
    }

    const ok = await submit(
      {
        mode: "select_pathway",
        learnerId,
        offeringId: selectionOfferingId,
        selectionBasis,
        selectionNote: selectionNote.trim(),
      },
      "select-pathway",
    );
    if (ok) setSelectionNote("");
  }

  if (!workspace && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <Loader2 className="size-8 animate-spin text-mint-300" />
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <TriangleAlert className="mx-auto size-8 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">
            Skills Development is unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <Link
            href={"/khpos/" + organisationId}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-black text-slate-950"
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
      <section className="bg-gradient-to-br from-slate-950 via-emerald-950 to-brand-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-black text-mint-200">
              Operations · O17
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black"
              >
                <RefreshCw className="size-4" />
                Refresh
              </button>
              <Link
                href={"/khpos/" + organisationId + "/potential-development"}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black"
              >
                <ArrowLeft className="size-4" />
                Potential Development
              </Link>
            </div>
          </div>

          <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-5xl">
            Skills Development
          </h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-200 sm:text-base">
            Pathway choice, practical delivery, recovery and progressive
            competency evidence. Attendance alone never advances a learner.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {[
              ["Active offerings", workspace.summary.activeOfferings, Wrench],
              ["Active selections", workspace.summary.activeSelections, UsersRound],
              ["Pending changes", workspace.summary.pendingChanges, GitBranch],
              ["Verified competencies", workspace.summary.verifiedCompetencies, BadgeCheck],
              ["Open recoveries", workspace.summary.openRecoveries, RefreshCw],
              ["Reviews awaiting approval", workspace.summary.submittedReviews, Gauge],
            ].map(([label, value, Icon]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-white/10 bg-white/10 p-4"
              >
                <Icon className="size-4 text-mint-200" />
                <p className="mt-2 text-xs font-bold text-slate-300">
                  {String(label)}
                </p>
                <p className="mt-1 text-2xl font-black">{String(value)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" />
              <div>
                <p className="text-sm font-black text-emerald-950">
                  Competence is demonstrated, not assumed
                </p>
                <p className="mt-1 text-sm leading-6 text-emerald-900/80">
                  {workspace.principle}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-brand-200 bg-brand-50 p-5">
            <div className="flex gap-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-brand-700" />
              <div>
                <p className="text-sm font-black text-brand-950">
                  PipuPath privacy stays intact
                </p>
                <p className="mt-1 text-sm leading-6 text-brand-900/80">
                  {workspace.privacyBoundary}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Competency ladder
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-5">
            {competencyLabels.map(([value, label], index) => (
              <div
                key={value}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-xs font-black text-slate-400">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <p className="mt-1 text-sm font-black text-slate-900">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {workspace.executiveAggregateOnly ? (
          <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6">
            <p className="text-sm font-black text-amber-950">
              Aggregate view only
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Your current account is an executive observer without a Skills
              operating assignment. Individual learner skill records remain
              hidden until an appropriate operating role is assigned.
            </p>
          </section>
        ) : null}

        {workspace.canManage ? (
          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                Term offering
              </p>
              <h2 className="mt-2 text-xl font-black">
                Open a pathway for this term
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <select
                  value={pathwayId}
                  onChange={(event) => setPathwayId(event.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">Choose pathway</option>
                  {workspace.pathways
                    .filter((pathway) => pathway.status === "active")
                    .map((pathway) => (
                      <option key={pathway.id} value={pathway.id}>
                        {pathway.name}
                      </option>
                    ))}
                </select>
                <select
                  value={termId}
                  onChange={(event) => setTermId(event.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">Choose active term</option>
                  {workspace.terms
                    .filter((term) => term.status === "active")
                    .map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.sessionLabel} · {term.termName}
                      </option>
                    ))}
                </select>
                <input
                  value={campusId}
                  onChange={(event) => setCampusId(event.target.value)}
                  placeholder="Campus ID"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
                <select
                  value={facilitatorAssignmentId}
                  onChange={(event) =>
                    setFacilitatorAssignmentId(event.target.value)
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">Assign later</option>
                  {facilitators.map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>
                      {assignment.roleTitle} · {assignment.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={weeklyTarget}
                  onChange={(event) => setWeeklyTarget(event.target.value)}
                  placeholder="Weekly target"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
                <input
                  type="number"
                  min="1"
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                  placeholder="Capacity"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => void createOffering()}
                disabled={busy === "create-offering"}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                {busy === "create-offering" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Wrench className="size-3.5" />
                )}
                Create offering
              </button>
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
                Learner pathway
              </p>
              <h2 className="mt-2 text-xl font-black">
                Confirm one primary pathway
              </h2>
              <div className="mt-5 space-y-3">
                <select
                  value={learnerId}
                  onChange={(event) => setLearnerId(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">Choose learner</option>
                  {workspace.learners.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName} · {item.classLabel}
                    </option>
                  ))}
                </select>
                <select
                  value={selectionOfferingId}
                  onChange={(event) =>
                    setSelectionOfferingId(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">Choose ready/active offering</option>
                  {activeOfferings
                    .filter(
                      (offering) =>
                        !learnerId ||
                        workspace.learners.find((item) => item.id === learnerId)
                          ?.campusId === offering.campusId,
                    )
                    .map((offering) => (
                      <option key={offering.id} value={offering.id}>
                        {offering.pathwayName} · {readable(offering.status)}
                      </option>
                    ))}
                </select>
                <select
                  value={selectionBasis}
                  onChange={(event) => setSelectionBasis(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="learner_choice">Learner choice</option>
                  <option value="discovery_alignment">Discovery alignment</option>
                  <option value="continuation">Continuation</option>
                  <option value="other">Other</option>
                </select>
                <textarea
                  value={selectionNote}
                  onChange={(event) => setSelectionNote(event.target.value)}
                  rows={3}
                  placeholder="Why is this pathway appropriate now? Record learner voice; do not label the learner permanently."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => void selectPathway()}
                disabled={busy === "select-pathway"}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                {busy === "select-pathway" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Compass className="size-3.5" />
                )}
                Confirm selection
              </button>
            </div>
          </section>
        ) : null}

        <section>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            Pathways & offerings
          </p>
          <h2 className="mt-2 text-2xl font-black">
            Safe delivery before activity
          </h2>
          {workspace.offerings.length === 0 ? (
            <div className="mt-4 rounded-[28px] border border-dashed border-slate-300 bg-white p-7 text-center text-sm text-slate-500">
              No term skills offering exists yet.
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              {workspace.offerings.map((offering) => (
                <OfferingCard
                  key={offering.id}
                  offering={offering}
                  canManage={workspace.canManage}
                  busy={busy}
                  notes={notes}
                  references={references}
                  states={states}
                  dates={dates}
                  onNote={(key, value) =>
                    setNotes((current) => ({ ...current, [key]: value }))
                  }
                  onReference={(key, value) =>
                    setReferences((current) => ({ ...current, [key]: value }))
                  }
                  onState={(key, value) =>
                    setStates((current) => ({ ...current, [key]: value }))
                  }
                  onDate={(key, value) =>
                    setDates((current) => ({ ...current, [key]: value }))
                  }
                  submit={submit}
                />
              ))}
            </div>
          )}
        </section>

        {!workspace.executiveAggregateOnly ? (
          <section>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
              Learner competency
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Evidence, not attendance
            </h2>
            {workspace.learners.length === 0 ? (
              <div className="mt-4 rounded-[28px] border border-dashed border-slate-300 bg-white p-7 text-center text-sm text-slate-500">
                No learner anchors are visible yet.
              </div>
            ) : (
              <div className="mt-5 grid gap-5 xl:grid-cols-[320px_1fr]">
                <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                  <select
                    value={learnerId}
                    onChange={(event) => setLearnerId(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    {workspace.learners.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.displayName} · {item.classLabel}
                      </option>
                    ))}
                  </select>
                  {learner ? (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm font-black">{learner.displayName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {learner.classLabel}
                        {learner.sectionLabel
                          ? " · " + learner.sectionLabel
                          : ""}
                      </p>
                      <p className="mt-3 text-xs font-semibold text-slate-600">
                        Current:{" "}
                        {activeSelection
                          ? activeSelection.pathwayName +
                            " · " +
                            readable(activeSelection.currentCompetencyLevel)
                          : "No active pathway"}
                      </p>
                    </div>
                  ) : null}
                </div>

                {learner ? (
                  <LearnerSkillsCard
                    learner={learner}
                    offerings={activeOfferings}
                    canManage={workspace.canManage}
                    canRecord={workspace.canRecord}
                    busy={busy}
                    notes={notes}
                    references={references}
                    states={states}
                    dates={dates}
                    onNote={(key, value) =>
                      setNotes((current) => ({ ...current, [key]: value }))
                    }
                    onReference={(key, value) =>
                      setReferences((current) => ({ ...current, [key]: value }))
                    }
                    onState={(key, value) =>
                      setStates((current) => ({ ...current, [key]: value }))
                    }
                    onDate={(key, value) =>
                      setDates((current) => ({ ...current, [key]: value }))
                    }
                    submit={submit}
                  />
                ) : null}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function OfferingCard({
  offering,
  canManage,
  busy,
  notes,
  references,
  states,
  dates,
  onNote,
  onReference,
  onState,
  onDate,
  submit,
}: {
  offering: KhposOpsSkillOffering;
  canManage: boolean;
  busy: string;
  notes: Record<string, string>;
  references: Record<string, string>;
  states: Record<string, string>;
  dates: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  onState: (key: string, value: string) => void;
  onDate: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const safetyKey = "safety-" + offering.id;
  const resourceKey = "resource-" + offering.id;
  const readinessNoteKey = "readiness-note-" + offering.id;
  const readinessRefKey = "readiness-ref-" + offering.id;
  const sessionDateKey = "session-date-" + offering.id;
  const sessionFocusKey = "session-focus-" + offering.id;
  const reviewWeekKey = "review-week-" + offering.id;
  const reviewSafetyKey = "review-safety-" + offering.id;
  const reviewRecoveryKey = "review-recovery-" + offering.id;
  const reviewValueKey = "review-value-" + offering.id;

  const missedForRecovery = offering.sessions.filter(
    (session) =>
      session.status === "missed" &&
      ["required", "planned"].includes(session.recoveryStatus),
  );

  return (
    <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-400">
              {offering.reference}
            </span>
            <span
              className={
                "rounded-full border px-3 py-1 text-[11px] font-black capitalize " +
                statusClass(offering.status)
              }
            >
              {readable(offering.status)}
            </span>
          </div>
          <h3 className="mt-2 text-xl font-black">{offering.pathwayName}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Weekly target {offering.weeklySessionTarget} · Capacity{" "}
            {offering.capacity ?? "Not capped"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <span
            className={
              "rounded-xl border px-3 py-2 font-black capitalize " +
              statusClass(offering.safetyReadiness)
            }
          >
            Safety: {readable(offering.safetyReadiness)}
          </span>
          <span
            className={
              "rounded-xl border px-3 py-2 font-black capitalize " +
              statusClass(offering.resourceReadiness)
            }
          >
            Resources: {readable(offering.resourceReadiness)}
          </span>
        </div>
      </div>

      {canManage && ["planned", "ready"].includes(offering.status) ? (
        <details className="mt-5 rounded-2xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-black">
            Offering readiness & activation
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select
              value={states[safetyKey] ?? "ready"}
              onChange={(event) => onState(safetyKey, event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            >
              <option value="ready">Safety ready</option>
              <option value="blocked">Safety blocked</option>
            </select>
            <select
              value={states[resourceKey] ?? "ready"}
              onChange={(event) => onState(resourceKey, event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            >
              <option value="ready">Resources ready</option>
              <option value="partial">Resources partial</option>
              <option value="blocked">Resources blocked</option>
            </select>
            <textarea
              value={notes[readinessNoteKey] ?? ""}
              onChange={(event) => onNote(readinessNoteKey, event.target.value)}
              placeholder="Readiness evidence note"
              rows={2}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              value={references[readinessRefKey] ?? ""}
              onChange={(event) =>
                onReference(readinessRefKey, event.target.value)
              }
              placeholder="Readiness evidence reference"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "offering_action",
                    offeringId: offering.id,
                    action: "mark_ready",
                    safetyReadiness: states[safetyKey] ?? "ready",
                    resourceReadiness: states[resourceKey] ?? "ready",
                    note: notes[readinessNoteKey] ?? "",
                    evidenceReference: references[readinessRefKey] ?? "",
                  },
                  "offering-ready-" + offering.id,
                )
              }
              className="rounded-full border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-black text-brand-800"
            >
              Record readiness
            </button>
            {offering.status === "ready" ? (
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "offering_action",
                      offeringId: offering.id,
                      action: "activate",
                    },
                    "offering-activate-" + offering.id,
                  )
                }
                className="rounded-full bg-emerald-700 px-3 py-2 text-xs font-black text-white"
              >
                Activate offering
              </button>
            ) : null}
          </div>
        </details>
      ) : null}

      {offering.status === "active" ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-black">Plan a session</p>
            <div className="mt-3 space-y-2">
              <input
                type="date"
                value={dates[sessionDateKey] ?? ""}
                onChange={(event) => onDate(sessionDateKey, event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <input
                value={notes[sessionFocusKey] ?? ""}
                onChange={(event) => onNote(sessionFocusKey, event.target.value)}
                placeholder="Session focus"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "create_session",
                      offeringId: offering.id,
                      sessionDate: dates[sessionDateKey] ?? "",
                      focus: notes[sessionFocusKey] ?? "",
                    },
                    "session-create-" + offering.id,
                  )
                }
                className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white"
              >
                Plan session
              </button>
            </div>

            {missedForRecovery.length > 0 ? (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-xs font-black text-amber-800">
                  Recovery required
                </p>
                {missedForRecovery.map((session) => (
                  <div
                    key={session.id}
                    className="mt-2 rounded-xl bg-amber-50 p-3 text-xs"
                  >
                    <p className="font-black">{session.focus}</p>
                    <p className="mt-1 text-amber-900">
                      Due {formatDate(session.recoveryDueDate)}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        void submit(
                          {
                            mode: "create_session",
                            offeringId: offering.id,
                            sessionDate: session.recoveryDueDate ?? "",
                            focus: "Recovery: " + session.focus,
                            recoveryForSessionId: session.id,
                          },
                          "recovery-create-" + session.id,
                        )
                      }
                      className="mt-2 rounded-full border border-amber-300 bg-white px-3 py-1.5 font-black text-amber-900"
                    >
                      Plan recovery
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-black">Weekly review</p>
            <div className="mt-3 space-y-2">
              <input
                type="date"
                value={dates[reviewWeekKey] ?? ""}
                onChange={(event) => onDate(reviewWeekKey, event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <textarea
                value={notes[reviewSafetyKey] ?? ""}
                onChange={(event) => onNote(reviewSafetyKey, event.target.value)}
                placeholder="Safety/resource summary"
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <textarea
                value={notes[reviewRecoveryKey] ?? ""}
                onChange={(event) => onNote(reviewRecoveryKey, event.target.value)}
                placeholder="Recovery actions where needed"
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <textarea
                value={notes[reviewValueKey] ?? ""}
                onChange={(event) => onNote(reviewValueKey, event.target.value)}
                placeholder="Value-creation / Young CEO linkage where relevant"
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "create_weekly_review",
                      offeringId: offering.id,
                      weekStart: dates[reviewWeekKey] ?? "",
                      safetyResourceSummary: notes[reviewSafetyKey] ?? null,
                      recoveryActionNote: notes[reviewRecoveryKey] ?? null,
                      valueCreationNote: notes[reviewValueKey] ?? null,
                    },
                    "weekly-create-" + offering.id,
                  )
                }
                className="rounded-full bg-brand-700 px-3 py-2 text-xs font-black text-white"
              >
                Create weekly review
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {offering.sessions.length > 0 ? (
        <details className="mt-5 rounded-2xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-black">
            Sessions · {offering.sessions.length}
          </summary>
          <div className="mt-3 space-y-3">
            {offering.sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                busy={busy}
                notes={notes}
                references={references}
                states={states}
                dates={dates}
                onNote={onNote}
                onReference={onReference}
                onState={onState}
                onDate={onDate}
                submit={submit}
              />
            ))}
          </div>
        </details>
      ) : null}

      {offering.reviews.length > 0 ? (
        <details className="mt-4 rounded-2xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-black">
            Weekly reviews · {offering.reviews.length}
          </summary>
          <div className="mt-3 space-y-3">
            {offering.reviews.map((review) => (
              <WeeklyReviewCard
                key={review.id}
                review={review}
                canManage={canManage}
                busy={busy}
                notes={notes}
                onNote={onNote}
                submit={submit}
              />
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function SessionCard({
  session,
  busy,
  notes,
  references,
  states,
  dates,
  onNote,
  onReference,
  onState,
  onDate,
  submit,
}: {
  session: KhposOpsSkillSession;
  busy: string;
  notes: Record<string, string>;
  references: Record<string, string>;
  states: Record<string, string>;
  dates: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  onState: (key: string, value: string) => void;
  onDate: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const noteKey = "session-note-" + session.id;
  const refKey = "session-ref-" + session.id;
  const safetyKey = "session-safety-" + session.id;
  const resourceKey = "session-resource-" + session.id;
  const recoveryKey = "session-recovery-" + session.id;

  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black">{session.focus}</p>
          <p className="mt-1 text-xs text-slate-500">
            {formatDate(session.sessionDate)} · {session.reference}
          </p>
        </div>
        <span
          className={
            "rounded-full border px-2.5 py-1 text-[10px] font-black capitalize " +
            statusClass(session.status)
          }
        >
          {readable(session.status)}
        </span>
      </div>

      {session.issueId ? (
        <Link
          href={"#"}
          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-800"
        >
          <TriangleAlert className="size-3.5" />
          O4 issue linked: {session.issueId.slice(0, 8)}
        </Link>
      ) : null}

      {session.status === "planned" ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select
            value={states[safetyKey] ?? "safe"}
            onChange={(event) => onState(safetyKey, event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          >
            <option value="safe">Safe</option>
            <option value="concern">Safety concern</option>
          </select>
          <select
            value={states[resourceKey] ?? "ready"}
            onChange={(event) => onState(resourceKey, event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          >
            <option value="ready">Resources ready</option>
            <option value="partial">Resources partial</option>
            <option value="blocked">Resources blocked</option>
          </select>
          <textarea
            value={notes[noteKey] ?? ""}
            onChange={(event) => onNote(noteKey, event.target.value)}
            placeholder="Outcome / exception note"
            rows={2}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          />
          <input
            value={references[refKey] ?? ""}
            onChange={(event) => onReference(refKey, event.target.value)}
            placeholder="Delivery evidence reference"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          />
          <input
            type="date"
            value={dates[recoveryKey] ?? ""}
            onChange={(event) => onDate(recoveryKey, event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "session_action",
                    sessionId: session.id,
                    action: "deliver",
                    safetyState: states[safetyKey] ?? "safe",
                    resourceState: states[resourceKey] ?? "ready",
                    note: notes[noteKey] ?? "",
                    evidenceReference: references[refKey] ?? "",
                  },
                  "session-deliver-" + session.id,
                )
              }
              disabled={busy === "session-deliver-" + session.id}
              className="rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-50"
            >
              Delivered
            </button>
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "session_action",
                    sessionId: session.id,
                    action: "miss",
                    safetyState: states[safetyKey] ?? "safe",
                    resourceState: states[resourceKey] ?? "ready",
                    note: notes[noteKey] ?? "",
                    recoveryDueDate: dates[recoveryKey] ?? "",
                  },
                  "session-miss-" + session.id,
                )
              }
              disabled={busy === "session-miss-" + session.id}
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-900 disabled:opacity-50"
            >
              Missed + recovery
            </button>
          </div>
        </div>
      ) : null}

      {session.deliveryNote ? (
        <p className="mt-3 text-xs leading-5 text-slate-600">
          {session.deliveryNote}
        </p>
      ) : null}
    </div>
  );
}

function WeeklyReviewCard({
  review,
  canManage,
  busy,
  notes,
  onNote,
  submit,
}: {
  review: KhposOpsSkillWeeklyReview;
  canManage: boolean;
  busy: string;
  notes: Record<string, string>;
  onNote: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const noteKey = "weekly-action-" + review.id;

  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black">
            Week of {formatDate(review.weekStart)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{review.reference}</p>
        </div>
        <span
          className={
            "rounded-full border px-2.5 py-1 text-[10px] font-black capitalize " +
            statusClass(review.status)
          }
        >
          {readable(review.status)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {[
          ["Planned", review.plannedSessions],
          ["Delivered", review.deliveredSessions],
          ["Missed", review.missedSessions],
          ["Evidence", review.verifiedCompetencyEvidence],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg bg-white p-2">
            <p className="text-[10px] font-bold text-slate-400">{String(label)}</p>
            <p className="mt-1 text-sm font-black">{String(value)}</p>
          </div>
        ))}
      </div>

      <textarea
        value={notes[noteKey] ?? ""}
        onChange={(event) => onNote(noteKey, event.target.value)}
        placeholder="Approval / return note"
        rows={2}
        className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
      />

      <div className="mt-2 flex flex-wrap gap-2">
        {review.status === "draft" ? (
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "weekly_review_action",
                  reviewId: review.id,
                  action: "submit",
                },
                "weekly-submit-" + review.id,
              )
            }
            className="rounded-full bg-brand-700 px-3 py-1.5 text-[11px] font-black text-white"
          >
            Submit
          </button>
        ) : null}

        {canManage && review.status === "submitted" ? (
          <>
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "weekly_review_action",
                    reviewId: review.id,
                    action: "approve",
                    note: notes[noteKey] ?? "",
                  },
                  "weekly-approve-" + review.id,
                )
              }
              className="rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-black text-white"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "weekly_review_action",
                    reviewId: review.id,
                    action: "return",
                    note: notes[noteKey] ?? "",
                  },
                  "weekly-return-" + review.id,
                )
              }
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-900"
            >
              Return
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function LearnerSkillsCard({
  learner,
  offerings,
  canManage,
  canRecord,
  busy,
  notes,
  references,
  states,
  dates,
  onNote,
  onReference,
  onState,
  onDate,
  submit,
}: {
  learner: KhposOpsSkillLearner;
  offerings: KhposOpsSkillOffering[];
  canManage: boolean;
  canRecord: boolean;
  busy: string;
  notes: Record<string, string>;
  references: Record<string, string>;
  states: Record<string, string>;
  dates: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  onState: (key: string, value: string) => void;
  onDate: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const activeSelection =
    learner.selections.find((selection) => selection.status === "active") ?? null;

  return (
    <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-700">
            {learner.classLabel}
          </p>
          <h3 className="mt-1 text-xl font-black">{learner.displayName}</h3>
        </div>
        {activeSelection ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
            {activeSelection.pathwayName} ·{" "}
            {readable(activeSelection.currentCompetencyLevel)}
          </span>
        ) : (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black text-amber-900">
            Awaiting pathway
          </span>
        )}
      </div>

      {activeSelection ? (
        <>
          {canRecord ? (
            <CompetencyEntry
              selection={activeSelection}
              busy={busy}
              notes={notes}
              references={references}
              states={states}
              dates={dates}
              onNote={onNote}
              onReference={onReference}
              onState={onState}
              onDate={onDate}
              submit={submit}
            />
          ) : null}

          <div className="mt-5 space-y-2">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              Competency evidence
            </p>
            {activeSelection.competencyEvidence.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                No competency evidence recorded yet.
              </p>
            ) : (
              activeSelection.competencyEvidence.map((evidence) => (
                <CompetencyEvidenceCard
                  key={evidence.id}
                  evidence={evidence}
                  canManage={canManage}
                  busy={busy}
                  notes={notes}
                  onNote={onNote}
                  submit={submit}
                />
              ))
            )}
          </div>

          {canRecord ? (
            <PathwayChange
              learner={learner}
              selection={activeSelection}
              offerings={offerings}
              canManage={canManage}
              busy={busy}
              notes={notes}
              states={states}
              dates={dates}
              onNote={onNote}
              onState={onState}
              onDate={onDate}
              submit={submit}
            />
          ) : null}
        </>
      ) : (
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Use the pathway confirmation control above to place this learner into
          one ready or active term offering.
        </p>
      )}
    </article>
  );
}

function CompetencyEntry({
  selection,
  busy,
  notes,
  references,
  states,
  dates,
  onNote,
  onReference,
  onState,
  onDate,
  submit,
}: {
  selection: KhposOpsSkillSelection;
  busy: string;
  notes: Record<string, string>;
  references: Record<string, string>;
  states: Record<string, string>;
  dates: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  onState: (key: string, value: string) => void;
  onDate: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const levelKey = "competency-level-" + selection.id;
  const areaKey = "competency-area-" + selection.id;
  const noteKey = "competency-note-" + selection.id;
  const refKey = "competency-ref-" + selection.id;
  const dateKey = "competency-date-" + selection.id;

  return (
    <details className="mt-5 rounded-2xl border border-brand-200 bg-brand-50 p-4">
      <summary className="cursor-pointer text-sm font-black text-brand-950">
        Record practical competency evidence
      </summary>
      <p className="mt-2 text-xs leading-5 text-brand-900">
        Record what the learner demonstrated. The Skill Inspector or School
        Guardian must verify before the ladder advances.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select
          value={states[levelKey] ?? "exposure"}
          onChange={(event) => onState(levelKey, event.target.value)}
          className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs"
        >
          {competencyLabels.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          value={notes[areaKey] ?? ""}
          onChange={(event) => onNote(areaKey, event.target.value)}
          placeholder="Competency area"
          className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs"
        />
        <textarea
          value={notes[noteKey] ?? ""}
          onChange={(event) => onNote(noteKey, event.target.value)}
          placeholder="What was demonstrated?"
          rows={2}
          className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs"
        />
        <input
          value={references[refKey] ?? ""}
          onChange={(event) => onReference(refKey, event.target.value)}
          placeholder="Evidence reference"
          className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs"
        />
        <input
          type="datetime-local"
          value={dates[dateKey] ?? ""}
          onChange={(event) => onDate(dateKey, event.target.value)}
          className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs"
        />
      </div>
      <button
        type="button"
        onClick={() =>
          void submit(
            {
              mode: "add_competency_evidence",
              selectionId: selection.id,
              competencyLevel: states[levelKey] ?? "exposure",
              competencyArea: notes[areaKey] ?? "",
              evidenceNote: notes[noteKey] ?? "",
              evidenceReference: references[refKey] ?? "",
              observedAt: dates[dateKey]
                ? new Date(dates[dateKey]).toISOString()
                : "",
            },
            "competency-add-" + selection.id,
          )
        }
        className="mt-3 rounded-full bg-brand-700 px-3 py-2 text-xs font-black text-white"
      >
        Submit evidence
      </button>
    </details>
  );
}

function CompetencyEvidenceCard({
  evidence,
  canManage,
  busy,
  notes,
  onNote,
  submit,
}: {
  evidence: KhposOpsSkillCompetencyEvidence;
  canManage: boolean;
  busy: string;
  notes: Record<string, string>;
  onNote: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const noteKey = "competency-action-" + evidence.id;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black">
            {readable(evidence.competencyLevel)} · {evidence.competencyArea}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {formatDateTime(evidence.observedAt)}
          </p>
        </div>
        <span
          className={
            "rounded-full border px-2.5 py-1 text-[10px] font-black capitalize " +
            statusClass(evidence.status)
          }
        >
          {readable(evidence.status)}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        {evidence.evidenceNote}
      </p>
      {evidence.potentialEvidenceId ? (
        <p className="mt-2 text-[11px] font-bold text-emerald-700">
          Linked into O16 Potential evidence
        </p>
      ) : null}

      {canManage && ["submitted", "returned"].includes(evidence.status) ? (
        <div className="mt-3">
          <textarea
            value={notes[noteKey] ?? ""}
            onChange={(event) => onNote(noteKey, event.target.value)}
            placeholder="Verification / return note"
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "competency_action",
                    evidenceId: evidence.id,
                    action: "verify",
                    note: notes[noteKey] ?? "",
                  },
                  "competency-verify-" + evidence.id,
                )
              }
              disabled={busy === "competency-verify-" + evidence.id}
              className="rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-50"
            >
              Verify
            </button>
            {evidence.status === "submitted" ? (
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "competency_action",
                      evidenceId: evidence.id,
                      action: "return",
                      note: notes[noteKey] ?? "",
                    },
                    "competency-return-" + evidence.id,
                  )
                }
                className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-900"
              >
                Return
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PathwayChange({
  learner,
  selection,
  offerings,
  canManage,
  busy,
  notes,
  states,
  dates,
  onNote,
  onState,
  onDate,
  submit,
}: {
  learner: KhposOpsSkillLearner;
  selection: KhposOpsSkillSelection;
  offerings: KhposOpsSkillOffering[];
  canManage: boolean;
  busy: string;
  notes: Record<string, string>;
  states: Record<string, string>;
  dates: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onState: (key: string, value: string) => void;
  onDate: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const targetKey = "change-target-" + selection.id;
  const reasonKey = "change-reason-" + selection.id;
  const dateKey = "change-date-" + selection.id;
  const alternatives = offerings.filter(
    (offering) =>
      offering.id !== selection.offeringId &&
      offering.campusId === learner.campusId &&
      offering.termId === selection.termId,
  );

  return (
    <details className="mt-5 rounded-2xl border border-slate-200 p-4">
      <summary className="cursor-pointer text-sm font-black">
        Pathway change
      </summary>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        A pathway change is not a punishment. Preserve the reason, decision and
        former pathway history.
      </p>
      {alternatives.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select
            value={states[targetKey] ?? alternatives[0]?.id ?? ""}
            onChange={(event) => onState(targetKey, event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
          >
            {alternatives.map((offering) => (
              <option key={offering.id} value={offering.id}>
                {offering.pathwayName}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dates[dateKey] ?? ""}
            onChange={(event) => onDate(dateKey, event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
          />
          <textarea
            value={notes[reasonKey] ?? ""}
            onChange={(event) => onNote(reasonKey, event.target.value)}
            placeholder="Why should the change be reviewed?"
            rows={2}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs sm:col-span-2"
          />
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "request_change",
                  currentSelectionId: selection.id,
                  targetOfferingId: states[targetKey] ?? alternatives[0]?.id ?? "",
                  reason: notes[reasonKey] ?? "",
                  requestedEffectiveDate: dates[dateKey] ?? "",
                },
                "change-request-" + selection.id,
              )
            }
            className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white"
          >
            Request change
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          No alternative ready/active offering exists in the same term and campus.
        </p>
      )}

      {learner.changeRequests.length > 0 ? (
        <div className="mt-4 space-y-2">
          {learner.changeRequests.map((request) => {
            const decisionKey = "change-decision-" + request.id;
            return (
              <div key={request.id} className="rounded-xl bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-black">{request.reference}</p>
                  <span
                    className={
                      "rounded-full border px-2.5 py-1 text-[10px] font-black capitalize " +
                      statusClass(request.status)
                    }
                  >
                    {readable(request.status)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {request.reason}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Effective {formatDate(request.requestedEffectiveDate)}
                </p>

                {canManage && request.status === "pending" ? (
                  <div className="mt-2">
                    <textarea
                      value={notes[decisionKey] ?? ""}
                      onChange={(event) =>
                        onNote(decisionKey, event.target.value)
                      }
                      placeholder="Decision note"
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void submit(
                            {
                              mode: "decide_change",
                              changeRequestId: request.id,
                              action: "approve",
                              decisionNote: notes[decisionKey] ?? "",
                            },
                            "change-approve-" + request.id,
                          )
                        }
                        className="rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-black text-white"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void submit(
                            {
                              mode: "decide_change",
                              changeRequestId: request.id,
                              action: "reject",
                              decisionNote: notes[decisionKey] ?? "",
                            },
                            "change-reject-" + request.id,
                          )
                        }
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-black text-rose-800"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : null}

                {canManage && request.status === "approved" ? (
                  <button
                    type="button"
                    onClick={() =>
                      void submit(
                        {
                          mode: "execute_change",
                          changeRequestId: request.id,
                        },
                        "change-execute-" + request.id,
                      )
                    }
                    className="mt-2 rounded-full bg-brand-700 px-3 py-1.5 text-[11px] font-black text-white"
                  >
                    Execute approved change
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </details>
  );
}
