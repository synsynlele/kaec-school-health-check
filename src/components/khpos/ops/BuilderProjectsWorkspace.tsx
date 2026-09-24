"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Flag,
  Hammer,
  Layers3,
  Loader2,
  Share2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsBuilderProject,
  KhposOpsBuilderProjectCycle,
  KhposOpsBuilderProjectDefence,
  KhposOpsBuilderProjectMemberEvidence,
  KhposOpsBuilderProjectMilestone,
  KhposOpsBuilderProjectPortfolioLink,
  KhposOpsBuilderProjectsWorkspace,
} from "@/lib/khpos/ops/builder-projects";

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
  if (
    ["verified", "completed", "defended", "recovered", "showcase_ready"].includes(
      status,
    )
  )
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (
    [
      "active",
      "investigating",
      "designing",
      "building",
      "testing",
      "reflecting",
      "defence_ready",
    ].includes(status)
  )
    return "border-brand-200 bg-brand-50 text-brand-800";
  if (
    ["planned", "idea", "not_started", "in_progress", "evidence_submitted"].includes(
      status,
    )
  )
    return "border-violet-200 bg-violet-50 text-violet-800";
  if (["missed", "returned", "revision_required", "required"].includes(status))
    return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

const milestoneCodes = [
  ["problem", "Problem"],
  ["investigation", "Investigation"],
  ["solution_design", "Solution Design"],
  ["build", "Build"],
  ["test", "Test"],
  ["reflection", "Reflection"],
  ["defence_preparation", "Defence Preparation"],
] as const;

const evidenceDimensions = [
  "problem_framing",
  "investigation",
  "solution_design",
  "building",
  "testing",
  "collaboration",
  "communication",
  "initiative",
  "resilience",
  "reflection",
  "ownership",
  "other",
];

export function BuilderProjectsWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] =
    useState<KhposOpsBuilderProjectsWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const [cycleTermId, setCycleTermId] = useState("");
  const [cycleCampusId, setCycleCampusId] = useState("");
  const [cycleOwnerId, setCycleOwnerId] = useState("");
  const [cycleTitle, setCycleTitle] = useState("");
  const [cyclePurpose, setCyclePurpose] = useState("");
  const [cycleStart, setCycleStart] = useState("");
  const [cycleEnd, setCycleEnd] = useState("");
  const [schedule, setSchedule] = useState<Record<string, string>>({});

  const [projectCycleId, setProjectCycleId] = useState("");
  const [projectType, setProjectType] =
    useState<"builder_team" | "personal">("builder_team");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectProblem, setProjectProblem] = useState("");
  const [projectBeneficiary, setProjectBeneficiary] = useState("");
  const [projectMentorId, setProjectMentorId] = useState("");

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [references, setReferences] = useState<Record<string, string>>({});
  const [selects, setSelects] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<Record<string, boolean>>({});

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
        "/api/khpos/ops/builder-projects/" + organisationId,
        {
          headers: { Authorization: "Bearer " + accessToken },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        builderProjects?: KhposOpsBuilderProjectsWorkspace;
        error?: string;
      };

      if (!active) return;
      if (!response.ok || !body.ok || !body.builderProjects) {
        setError(body.error ?? "Builder Projects could not be loaded.");
        return;
      }

      const next = body.builderProjects;
      setWorkspace(next);
      const activeTerm =
        next.terms.find((term) => term.status === "active") ?? next.terms[0];
      const campus = next.campuses[0];
      const mine =
        next.assignments.find((assignment) => assignment.isMine) ??
        next.assignments[0];
      const cycle =
        next.cycles.find((item) => item.status === "active") ??
        next.cycles.find((item) => item.status === "planned");

      setCycleTermId((current) => current || activeTerm?.id || "");
      setCycleCampusId((current) => current || campus?.id || "");
      setCycleOwnerId((current) => current || mine?.id || "");
      setProjectCycleId((current) => current || cycle?.id || "");
      setProjectMentorId((current) => current || mine?.id || "");
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
      "/api/khpos/ops/builder-projects/" + organisationId,
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
      builderProjects?: KhposOpsBuilderProjectsWorkspace;
      error?: string;
    };

    setBusyId(null);
    if (!response.ok || !body.ok || !body.builderProjects) {
      setError(body.error ?? "Builder Projects operation could not be completed.");
      return false;
    }

    setWorkspace(body.builderProjects);
    return true;
  }

  async function createCycle() {
    if (
      !cycleTermId ||
      !cycleCampusId ||
      !cycleOwnerId ||
      !cycleTitle.trim() ||
      !cyclePurpose.trim() ||
      !cycleStart ||
      !cycleEnd ||
      milestoneCodes.some(([code]) => !schedule[code])
    ) {
      setError(
        "Project Cycle requires term, campus, owner, purpose, dates and all seven milestone dates.",
      );
      return;
    }

    const ok = await submit(
      {
        mode: "create_cycle",
        termId: cycleTermId,
        campusId: cycleCampusId,
        ownerAssignmentId: cycleOwnerId,
        title: cycleTitle.trim(),
        purpose: cyclePurpose.trim(),
        startDate: cycleStart,
        endDate: cycleEnd,
        milestoneSchedule: schedule,
      },
      "create-cycle",
    );

    if (ok) {
      setCycleTitle("");
      setCyclePurpose("");
      setCycleStart("");
      setCycleEnd("");
      setSchedule({});
    }
  }

  async function createProject() {
    if (
      !projectCycleId ||
      !projectMentorId ||
      !projectTitle.trim() ||
      !projectProblem.trim()
    ) {
      setError("Project requires cycle, mentor, title and meaningful problem.");
      return;
    }

    const ok = await submit(
      {
        mode: "create_project",
        cycleId: projectCycleId,
        projectType,
        title: projectTitle.trim(),
        problemStatement: projectProblem.trim(),
        intendedBeneficiary: projectBeneficiary.trim() || null,
        mentorAssignmentId: projectMentorId,
      },
      "create-project",
    );

    if (ok) {
      setProjectTitle("");
      setProjectProblem("");
      setProjectBeneficiary("");
    }
  }

  if (!workspace && !error) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-7 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
          <CircleAlert className="mx-auto size-8 text-rose-600" />
          <h1 className="mt-3 text-xl font-black text-rose-950">
            Builder Projects unavailable
          </h1>
          <p className="mt-2 text-sm text-rose-800">{error}</p>
        </div>
      </main>
    );
  }

  const openCycles = workspace.cycles.filter(
    (cycle) => cycle.status === "planned" || cycle.status === "active",
  );

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={"/khpos/" + organisationId}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="size-3.5" />
            Command Centre
          </Link>
          <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-brand-600">
            Operations · O20
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Builder Projects & Defence
          </h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Turn meaningful problems into investigated, built, tested, reflected
            and defended solutions—without treating team success as automatic
            evidence for every learner.
          </p>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-xs font-bold text-brand-900">
          HPD-P03 · HPD-008 · HPD-009 · HPD-011 · HPD-013
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Active cycles", workspace.summary.activeCycles],
          ["Active projects", workspace.summary.activeProjects],
          ["Defence ready", workspace.summary.defenceReady],
          ["Missed milestones", workspace.summary.missedMilestones],
          ["Evidence awaiting verification", workspace.summary.submittedIndividualEvidence],
          ["Verified individual evidence", workspace.summary.verifiedIndividualEvidence],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
              {String(label)}
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {String(value)}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <BoundaryCard
          icon={Hammer}
          title="Builder Project principle"
          text={workspace.principle}
        />
        <BoundaryCard
          icon={Share2}
          title="PipuPath boundary"
          text={workspace.pipupathBoundary}
        />
        <BoundaryCard
          icon={ShieldCheck}
          title="Builder Defence standard"
          text={workspace.defenceBoundary}
        />
      </section>

      {workspace.executiveAggregateOnly ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm font-black text-amber-950">
            Executive aggregate view only
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            Detailed learner/project records are intentionally hidden from an
            executive account without an active learner-facing operating role.
            Use Human Potential Intelligence for strategic patterns, or operate
            through the appropriate school role for project execution.
          </p>
        </section>
      ) : null}

      {workspace.canManage ? (
        <section className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-600">
              Project Cycle
            </p>
            <h2 className="mt-1 text-lg font-black text-slate-950">
              Set the term-wide project rhythm
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <select
                value={cycleTermId}
                onChange={(event) => setCycleTermId(event.target.value)}
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
              <select
                value={cycleCampusId}
                onChange={(event) => setCycleCampusId(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="">Choose campus</option>
                {workspace.campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
              <select
                value={cycleOwnerId}
                onChange={(event) => setCycleOwnerId(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="">Cycle owner</option>
                {workspace.assignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.roleTitle}
                    {assignment.isMine ? " · Me" : ""}
                  </option>
                ))}
              </select>
              <input
                value={cycleTitle}
                onChange={(event) => setCycleTitle(event.target.value)}
                placeholder="Cycle title"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <textarea
                value={cyclePurpose}
                onChange={(event) => setCyclePurpose(event.target.value)}
                rows={2}
                placeholder="What should this project cycle achieve?"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:col-span-2"
              />
              <label className="text-xs font-black text-slate-600">
                Start date
                <input
                  type="date"
                  value={cycleStart}
                  onChange={(event) => setCycleStart(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"
                />
              </label>
              <label className="text-xs font-black text-slate-600">
                End date
                <input
                  type="date"
                  value={cycleEnd}
                  onChange={(event) => setCycleEnd(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {milestoneCodes.map(([code, label]) => (
                <label key={code} className="text-xs font-black text-slate-600">
                  {label}
                  <input
                    type="date"
                    value={schedule[code] ?? ""}
                    onChange={(event) =>
                      setSchedule((current) => ({
                        ...current,
                        [code]: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
                  />
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void createCycle()}
              disabled={busyId === "create-cycle"}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
            >
              {busyId === "create-cycle" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Layers3 className="size-4" />
              )}
              Create Project Cycle
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-600">
              New project
            </p>
            <h2 className="mt-1 text-lg font-black text-slate-950">
              Team Builder Project or one-owner Personal Project
            </h2>
            <div className="mt-4 space-y-3">
              <select
                value={projectCycleId}
                onChange={(event) => setProjectCycleId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="">Choose Project Cycle</option>
                {openCycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.title} · {readable(cycle.status)}
                  </option>
                ))}
              </select>
              <select
                value={projectType}
                onChange={(event) =>
                  setProjectType(
                    event.target.value as "builder_team" | "personal",
                  )
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="builder_team">Builder Team Project</option>
                <option value="personal">Personal Project</option>
              </select>
              <select
                value={projectMentorId}
                onChange={(event) => setProjectMentorId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="">Choose mentor</option>
                {workspace.assignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.roleTitle}
                    {assignment.isMine ? " · Me" : ""}
                  </option>
                ))}
              </select>
              <input
                value={projectTitle}
                onChange={(event) => setProjectTitle(event.target.value)}
                placeholder="Project title"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <textarea
                value={projectProblem}
                onChange={(event) => setProjectProblem(event.target.value)}
                rows={3}
                placeholder="What meaningful problem is being investigated?"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <textarea
                value={projectBeneficiary}
                onChange={(event) => setProjectBeneficiary(event.target.value)}
                rows={2}
                placeholder="Who should benefit?"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <button
                type="button"
                onClick={() => void createProject()}
                disabled={busyId === "create-project"}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
              >
                {busyId === "create-project" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Hammer className="size-4" />
                )}
                Create project
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {!workspace.executiveAggregateOnly ? (
        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-600">
              Project Cycles
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Term rhythm and close-out
            </h2>
          </div>
          {workspace.cycles.length === 0 ? (
            <Empty text="No Builder Project Cycle is visible yet." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {workspace.cycles.map((cycle) => (
                <CycleCard
                  key={cycle.id}
                  cycle={cycle}
                  busyId={busyId}
                  notes={notes}
                  references={references}
                  onNote={(key, value) =>
                    setNotes((current) => ({ ...current, [key]: value }))
                  }
                  onReference={(key, value) =>
                    setReferences((current) => ({ ...current, [key]: value }))
                  }
                  submit={submit}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!workspace.executiveAggregateOnly ? (
        <section className="space-y-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-600">
              Projects
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Problem → Build → Test → Reflect → Defend
            </h2>
          </div>
          {workspace.projects.length === 0 ? (
            <Empty text="No Builder or Personal Project is visible yet." />
          ) : (
            workspace.projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                workspace={workspace}
                busyId={busyId}
                notes={notes}
                references={references}
                selects={selects}
                dates={dates}
                checks={checks}
                onNote={(key, value) =>
                  setNotes((current) => ({ ...current, [key]: value }))
                }
                onReference={(key, value) =>
                  setReferences((current) => ({ ...current, [key]: value }))
                }
                onSelect={(key, value) =>
                  setSelects((current) => ({ ...current, [key]: value }))
                }
                onDate={(key, value) =>
                  setDates((current) => ({ ...current, [key]: value }))
                }
                onCheck={(key, value) =>
                  setChecks((current) => ({ ...current, [key]: value }))
                }
                submit={submit}
              />
            ))
          )}
        </section>
      ) : null}
    </main>
  );
}

function BoundaryCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Hammer;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Icon className="size-5 text-brand-600" />
      <h2 className="mt-3 text-sm font-black text-slate-950">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-7 text-center text-sm font-semibold text-slate-500">
      {text}
    </div>
  );
}

function CycleCard({
  cycle,
  busyId,
  notes,
  references,
  onNote,
  onReference,
  submit,
}: {
  cycle: KhposOpsBuilderProjectCycle;
  busyId: string | null;
  notes: Record<string, string>;
  references: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, busyKey: string) => Promise<boolean>;
}) {
  const noteKey = "cycle-note-" + cycle.id;
  const refKey = "cycle-ref-" + cycle.id;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-500">{cycle.reference}</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">
            {cycle.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {cycle.purpose}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {formatDate(cycle.startDate)} → {formatDate(cycle.endDate)}
          </p>
        </div>
        <span
          className={
            "rounded-full border px-2.5 py-1 text-[11px] font-black capitalize " +
            statusClass(cycle.status)
          }
        >
          {readable(cycle.status)}
        </span>
      </div>

      <details className="mt-4 rounded-2xl border border-slate-200 p-4">
        <summary className="cursor-pointer text-sm font-black text-slate-800">
          Seven-milestone calendar
        </summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {milestoneCodes.map(([code, label]) => (
            <div key={code} className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-black text-slate-800">{label}</p>
              <p className="mt-1 text-xs text-slate-500">
                {formatDate(cycle.milestoneSchedule[code])}
              </p>
            </div>
          ))}
        </div>
      </details>

      {(cycle.canManage || cycle.isOwner) &&
      ["planned", "active"].includes(cycle.status) ? (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          <textarea
            value={notes[noteKey] ?? ""}
            onChange={(event) => onNote(noteKey, event.target.value)}
            placeholder="Action / close-out note"
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
          />
          <input
            value={references[refKey] ?? ""}
            onChange={(event) => onReference(refKey, event.target.value)}
            placeholder="Close-out evidence reference"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
          />
          <div className="flex flex-wrap gap-2">
            {cycle.status === "planned" ? (
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "cycle_action",
                      cycleId: cycle.id,
                      action: "activate",
                      note: notes[noteKey] ?? null,
                    },
                    "cycle-activate-" + cycle.id,
                  )
                }
                className="rounded-xl bg-brand-700 px-3 py-2 text-xs font-black text-white"
              >
                Activate
              </button>
            ) : null}
            {cycle.status === "active" && cycle.canManage ? (
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "cycle_action",
                      cycleId: cycle.id,
                      action: "complete",
                      note: notes[noteKey] ?? "",
                      evidenceReference: references[refKey] ?? "",
                    },
                    "cycle-complete-" + cycle.id,
                  )
                }
                disabled={busyId === "cycle-complete-" + cycle.id}
                className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
              >
                Complete cycle
              </button>
            ) : null}
            {cycle.canManage ? (
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "cycle_action",
                      cycleId: cycle.id,
                      action: "cancel",
                      note: notes[noteKey] ?? "",
                    },
                    "cycle-cancel-" + cycle.id,
                  )
                }
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-700"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ProjectCard({
  project,
  workspace,
  busyId,
  notes,
  references,
  selects,
  dates,
  checks,
  onNote,
  onReference,
  onSelect,
  onDate,
  onCheck,
  submit,
}: {
  project: KhposOpsBuilderProject;
  workspace: KhposOpsBuilderProjectsWorkspace;
  busyId: string | null;
  notes: Record<string, string>;
  references: Record<string, string>;
  selects: Record<string, string>;
  dates: Record<string, string>;
  checks: Record<string, boolean>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  onSelect: (key: string, value: string) => void;
  onDate: (key: string, value: string) => void;
  onCheck: (key: string, value: boolean) => void;
  submit: (payload: Record<string, unknown>, busyKey: string) => Promise<boolean>;
}) {
  const memberKey = "member-" + project.id;
  const memberRoleKey = "member-role-" + project.id;
  const projectNoteKey = "project-note-" + project.id;
  const projectRefKey = "project-ref-" + project.id;
  const solutionKey = "solution-" + project.id;
  const beneficiaryKey = "beneficiary-" + project.id;

  const activeMembers = project.members.filter(
    (member) => member.status === "active",
  );

  const nextAction:
    | "activate"
    | "design"
    | "build"
    | "test"
    | "reflect"
    | "ready_defence"
    | "complete"
    | null =
    project.status === "idea"
      ? "activate"
      : project.status === "investigating"
        ? "design"
        : project.status === "designing"
          ? "build"
          : project.status === "building"
            ? "test"
            : project.status === "testing"
              ? "reflect"
              : project.status === "reflecting"
                ? "ready_defence"
                : project.status === "defended"
                  ? "complete"
                  : null;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-500">
              {project.reference}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black capitalize text-slate-700">
              {readable(project.projectType)}
            </span>
            <span
              className={
                "rounded-full border px-2.5 py-1 text-[11px] font-black capitalize " +
                statusClass(project.status)
              }
            >
              {readable(project.status)}
            </span>
          </div>
          <h3 className="mt-2 text-xl font-black text-slate-950">
            {project.title}
          </h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
            {project.problemStatement}
          </p>
          {project.intendedBeneficiary ? (
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Beneficiary: {project.intendedBeneficiary}
            </p>
          ) : null}
          {project.solutionHypothesis ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Current solution hypothesis: {project.solutionHypothesis}
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs">
          <p className="font-black text-slate-900">
            {activeMembers.length} active learner
            {activeMembers.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-slate-500">
            {project.milestones.filter((item) => item.status === "verified").length}
            /7 milestones verified
          </p>
        </div>
      </div>

      {(project.canManage || project.isMentor) &&
      !["completed", "withdrawn"].includes(project.status) ? (
        <details className="mt-4 rounded-2xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-black text-slate-800">
            Team / owner and project context
          </summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-black text-slate-700">
                Add learner
              </p>
              <select
                value={selects[memberKey] ?? ""}
                onChange={(event) => onSelect(memberKey, event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                <option value="">Choose learner</option>
                {workspace.learners
                  .filter(
                    (learner) =>
                      !project.members.some(
                        (member) =>
                          member.learnerId === learner.id &&
                          member.status === "active",
                      ),
                  )
                  .map((learner) => (
                    <option key={learner.id} value={learner.id}>
                      {learner.displayName} · {learner.classLabel}
                    </option>
                  ))}
              </select>
              <select
                value={
                  selects[memberRoleKey] ??
                  (project.projectType === "personal" ? "owner" : "member")
                }
                onChange={(event) => onSelect(memberRoleKey, event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                {project.projectType === "personal" ? (
                  <option value="owner">Owner</option>
                ) : (
                  <>
                    <option value="member">Member</option>
                    <option value="lead">Lead</option>
                  </>
                )}
              </select>
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "member_action",
                      projectId: project.id,
                      learnerId: selects[memberKey] ?? "",
                      action: "add",
                      memberRole:
                        selects[memberRoleKey] ??
                        (project.projectType === "personal"
                          ? "owner"
                          : "member"),
                      note: "Learner added to governed project membership.",
                    },
                    "member-add-" + project.id,
                  )
                }
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white"
              >
                Add learner
              </button>
              {project.members.length > 0 ? (
                <div className="space-y-1 pt-2">
                  {project.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                    >
                      <span className="text-xs font-semibold text-slate-700">
                        {member.learnerName} · {readable(member.memberRole)} ·{" "}
                        {readable(member.status)}
                      </span>
                      {member.status === "active" &&
                      !["defence_ready", "defended"].includes(project.status) ? (
                        <button
                          type="button"
                          onClick={() =>
                            void submit(
                              {
                                mode: "member_action",
                                projectId: project.id,
                                learnerId: member.learnerId,
                                action: "leave",
                                memberRole: member.memberRole,
                                note: "Membership changed before defence readiness.",
                              },
                              "member-leave-" + member.id,
                            )
                          }
                          className="text-[11px] font-black text-rose-700"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-black text-slate-700">
                Update current project reasoning
              </p>
              <textarea
                value={notes[projectNoteKey] ?? project.problemStatement}
                onChange={(event) =>
                  onNote(projectNoteKey, event.target.value)
                }
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
              <input
                value={
                  references[beneficiaryKey] ??
                  project.intendedBeneficiary ??
                  ""
                }
                onChange={(event) =>
                  onReference(beneficiaryKey, event.target.value)
                }
                placeholder="Intended beneficiary"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
              <textarea
                value={notes[solutionKey] ?? project.solutionHypothesis ?? ""}
                onChange={(event) => onNote(solutionKey, event.target.value)}
                rows={2}
                placeholder="Current solution hypothesis / revision"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "update_project",
                      projectId: project.id,
                      problemStatement:
                        notes[projectNoteKey] ?? project.problemStatement,
                      intendedBeneficiary:
                        references[beneficiaryKey] ??
                        project.intendedBeneficiary ??
                        null,
                      solutionHypothesis:
                        notes[solutionKey] ??
                        project.solutionHypothesis ??
                        null,
                      learnerSharedPipupathReference: null,
                    },
                    "project-update-" + project.id,
                  )
                }
                className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-black text-brand-800"
              >
                Save project context
              </button>
            </div>
          </div>
        </details>
      ) : null}

      {(project.canManage || project.isMentor) &&
      !["completed", "withdrawn"].includes(project.status) ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {nextAction ? (
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "project_action",
                    projectId: project.id,
                    action: nextAction,
                    note: notes[projectNoteKey] ?? null,
                    evidenceReference:
                      nextAction === "complete"
                        ? references[projectRefKey] ?? ""
                        : null,
                  },
                  "project-stage-" + project.id,
                )
              }
              className="rounded-xl bg-brand-700 px-4 py-2 text-xs font-black capitalize text-white"
            >
              {nextAction === "ready_defence"
                ? "Mark Defence Ready"
                : nextAction === "complete"
                  ? "Complete project"
                  : readable(nextAction)}
            </button>
          ) : null}
          {project.canManage ? (
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "project_action",
                    projectId: project.id,
                    action: "withdraw",
                    note:
                      notes[projectNoteKey] ??
                      "Project withdrawn by coordinating authority.",
                  },
                  "project-withdraw-" + project.id,
                )
              }
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-black text-slate-700"
            >
              Withdraw
            </button>
          ) : null}
          {project.status === "defended" ? (
            <input
              value={references[projectRefKey] ?? ""}
              onChange={(event) =>
                onReference(projectRefKey, event.target.value)
              }
              placeholder="Close-out evidence reference"
              className="min-w-64 rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
          ) : null}
        </div>
      ) : null}

      <details open className="mt-5 rounded-2xl border border-slate-200 p-4">
        <summary className="cursor-pointer text-sm font-black text-slate-900">
          Seven evidence milestones
        </summary>
        <div className="mt-4 space-y-3">
          {project.milestones.map((milestone) => (
            <MilestoneRow
              key={milestone.id}
              milestone={milestone}
              project={project}
              busyId={busyId}
              notes={notes}
              references={references}
              dates={dates}
              onNote={onNote}
              onReference={onReference}
              onDate={onDate}
              submit={submit}
            />
          ))}
        </div>
      </details>

      <DefenceSection
        project={project}
        busyId={busyId}
        notes={notes}
        references={references}
        selects={selects}
        dates={dates}
        onNote={onNote}
        onReference={onReference}
        onSelect={onSelect}
        onDate={onDate}
        submit={submit}
      />

      <EvidenceSection
        project={project}
        busyId={busyId}
        notes={notes}
        references={references}
        selects={selects}
        dates={dates}
        onNote={onNote}
        onReference={onReference}
        onSelect={onSelect}
        onDate={onDate}
        submit={submit}
      />

      <PortfolioSection
        project={project}
        busyId={busyId}
        notes={notes}
        references={references}
        selects={selects}
        checks={checks}
        onNote={onNote}
        onReference={onReference}
        onSelect={onSelect}
        onCheck={onCheck}
        submit={submit}
      />
    </article>
  );
}

function MilestoneRow({
  milestone,
  project,
  busyId,
  notes,
  references,
  dates,
  onNote,
  onReference,
  onDate,
  submit,
}: {
  milestone: KhposOpsBuilderProjectMilestone;
  project: KhposOpsBuilderProject;
  busyId: string | null;
  notes: Record<string, string>;
  references: Record<string, string>;
  dates: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  onDate: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, busyKey: string) => Promise<boolean>;
}) {
  const noteKey = "ms-note-" + milestone.id;
  const refKey = "ms-ref-" + milestone.id;
  const recoveryKey = "ms-recovery-" + milestone.id;
  const canSubmit =
    project.canManage ||
    project.isMentor ||
    ["not_started", "in_progress", "returned", "missed"].includes(
      milestone.status,
    );

  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-900">
            {milestone.sequenceNo}. {milestone.title}
          </p>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
            {milestone.expectedEvidence}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            Due {formatDate(milestone.dueDate)}
            {milestone.recoveryStatus === "required"
              ? " · Recovery due " + formatDate(milestone.recoveryDueDate)
              : ""}
          </p>
        </div>
        <span
          className={
            "rounded-full border px-2.5 py-1 text-[10px] font-black capitalize " +
            statusClass(milestone.status)
          }
        >
          {readable(milestone.status)}
        </span>
      </div>

      {milestone.evidenceNote ? (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-xs">
          <p className="font-semibold text-slate-700">{milestone.evidenceNote}</p>
          {milestone.evidenceReference ? (
            <p className="mt-1 text-slate-500">
              Evidence: {milestone.evidenceReference}
            </p>
          ) : null}
        </div>
      ) : null}

      {canSubmit &&
      ["not_started", "in_progress", "returned", "missed"].includes(
        milestone.status,
      ) ? (
        <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
          <textarea
            value={notes[noteKey] ?? ""}
            onChange={(event) => onNote(noteKey, event.target.value)}
            placeholder="Evidence note"
            rows={2}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          />
          <input
            value={references[refKey] ?? ""}
            onChange={(event) => onReference(refKey, event.target.value)}
            placeholder="Evidence reference"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          />
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "milestone_action",
                  milestoneId: milestone.id,
                  action: "submit_evidence",
                  note: notes[noteKey] ?? "",
                  evidenceReference: references[refKey] ?? "",
                },
                "milestone-submit-" + milestone.id,
              )
            }
            disabled={busyId === "milestone-submit-" + milestone.id}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
          >
            Submit evidence
          </button>
        </div>
      ) : null}

      {(project.canManage || project.isMentor) &&
      ["not_started", "in_progress", "returned"].includes(milestone.status) ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            type="date"
            value={dates[recoveryKey] ?? ""}
            onChange={(event) => onDate(recoveryKey, event.target.value)}
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs"
          />
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "milestone_action",
                  milestoneId: milestone.id,
                  action: "miss",
                  note:
                    notes[noteKey] ??
                    "Milestone missed; structured recovery is required.",
                  recoveryDueDate: dates[recoveryKey] ?? "",
                },
                "milestone-miss-" + milestone.id,
              )
            }
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900"
          >
            Record missed milestone
          </button>
        </div>
      ) : null}

      {milestone.canVerify && milestone.status === "evidence_submitted" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "milestone_action",
                  milestoneId: milestone.id,
                  action: "verify",
                  note:
                    notes[noteKey] ??
                    "Evidence independently verified against milestone expectation.",
                },
                "milestone-verify-" + milestone.id,
              )
            }
            className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white"
          >
            Verify
          </button>
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "milestone_action",
                  milestoneId: milestone.id,
                  action: "return",
                  note:
                    notes[noteKey] ??
                    "Evidence returned for clarification or stronger proof.",
                },
                "milestone-return-" + milestone.id,
              )
            }
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900"
          >
            Return
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DefenceSection({
  project,
  busyId,
  notes,
  references,
  selects,
  dates,
  onNote,
  onReference,
  onSelect,
  onDate,
  submit,
}: {
  project: KhposOpsBuilderProject;
  busyId: string | null;
  notes: Record<string, string>;
  references: Record<string, string>;
  selects: Record<string, string>;
  dates: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  onSelect: (key: string, value: string) => void;
  onDate: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, busyKey: string) => Promise<boolean>;
}) {
  const scheduleKey = "defence-schedule-" + project.id;
  const locationKey = "defence-location-" + project.id;
  const panelKey = "defence-panel-" + project.id;

  return (
    <details className="mt-4 rounded-2xl border border-slate-200 p-4">
      <summary className="cursor-pointer text-sm font-black text-slate-900">
        Builder Defence
      </summary>

      {project.canManage && project.status === "defence_ready" ? (
        <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <input
            type="datetime-local"
            value={dates[scheduleKey] ?? ""}
            onChange={(event) => onDate(scheduleKey, event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />
          <input
            value={references[locationKey] ?? ""}
            onChange={(event) => onReference(locationKey, event.target.value)}
            placeholder="Location"
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />
          <input
            value={references[panelKey] ?? ""}
            onChange={(event) => onReference(panelKey, event.target.value)}
            placeholder="Panel reference"
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "create_defence",
                  projectId: project.id,
                  scheduledAt: dates[scheduleKey] ?? "",
                  locationLabel: references[locationKey] ?? "",
                  panelReference: references[panelKey] ?? "",
                },
                "defence-create-" + project.id,
              )
            }
            disabled={busyId === "defence-create-" + project.id}
            className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
          >
            Schedule defence
          </button>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {project.defences.length === 0 ? (
          <p className="text-xs text-slate-500">No defence attempt yet.</p>
        ) : (
          project.defences.map((defence) => (
            <DefenceCard
              key={defence.id}
              defence={defence}
              canManage={project.canManage}
              notes={notes}
              references={references}
              selects={selects}
              dates={dates}
              onNote={onNote}
              onReference={onReference}
              onSelect={onSelect}
              onDate={onDate}
              submit={submit}
            />
          ))
        )}
      </div>
    </details>
  );
}

function DefenceCard({
  defence,
  canManage,
  notes,
  references,
  selects,
  dates,
  onNote,
  onReference,
  onSelect,
  onDate,
  submit,
}: {
  defence: KhposOpsBuilderProjectDefence;
  canManage: boolean;
  notes: Record<string, string>;
  references: Record<string, string>;
  selects: Record<string, string>;
  dates: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  onSelect: (key: string, value: string) => void;
  onDate: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, busyKey: string) => Promise<boolean>;
}) {
  const outcomeKey = "defence-outcome-" + defence.id;
  const feedbackKey = "defence-feedback-" + defence.id;
  const responseKey = "defence-response-" + defence.id;
  const refKey = "defence-ref-" + defence.id;
  const revisionKey = "defence-revision-" + defence.id;
  const outcome = selects[outcomeKey] ?? "completed";

  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-900">
            Attempt {defence.attemptNo} · {formatDateTime(defence.scheduledAt)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {defence.locationLabel} · Panel {defence.panelReference}
          </p>
        </div>
        <span
          className={
            "rounded-full border px-2.5 py-1 text-[10px] font-black capitalize " +
            statusClass(defence.outcome ?? defence.status)
          }
        >
          {readable(defence.outcome ?? defence.status)}
        </span>
      </div>

      {defence.panelFeedback ? (
        <p className="mt-2 text-xs leading-5 text-slate-600">
          {defence.panelFeedback}
        </p>
      ) : null}

      {canManage && defence.status === "planned" ? (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          <select
            value={outcome}
            onChange={(event) => onSelect(outcomeKey, event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          >
            <option value="completed">Completed</option>
            <option value="showcase_ready">Showcase ready</option>
            <option value="revision_required">Revision required</option>
          </select>
          <input
            value={references[refKey] ?? ""}
            onChange={(event) => onReference(refKey, event.target.value)}
            placeholder="Defence evidence reference"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          />
          <textarea
            value={notes[feedbackKey] ?? ""}
            onChange={(event) => onNote(feedbackKey, event.target.value)}
            placeholder="Panel feedback"
            rows={2}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          />
          <textarea
            value={notes[responseKey] ?? ""}
            onChange={(event) => onNote(responseKey, event.target.value)}
            placeholder="Learner response summary"
            rows={2}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          />
          {outcome === "revision_required" ? (
            <input
              type="date"
              value={dates[revisionKey] ?? ""}
              onChange={(event) => onDate(revisionKey, event.target.value)}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs"
            />
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "defence_action",
                    defenceId: defence.id,
                    action: "complete",
                    outcome,
                    panelFeedback: notes[feedbackKey] ?? "",
                    learnerResponseSummary: notes[responseKey] ?? "",
                    evidenceReference: references[refKey] ?? "",
                    revisionDueDate:
                      outcome === "revision_required"
                        ? dates[revisionKey] ?? ""
                        : null,
                  },
                  "defence-complete-" + defence.id,
                )
              }
              className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white"
            >
              Record outcome
            </button>
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "defence_action",
                    defenceId: defence.id,
                    action: "cancel",
                    panelFeedback:
                      notes[feedbackKey] ?? "Defence attempt cancelled.",
                  },
                  "defence-cancel-" + defence.id,
                )
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EvidenceSection({
  project,
  busyId,
  notes,
  references,
  selects,
  dates,
  onNote,
  onReference,
  onSelect,
  onDate,
  submit,
}: {
  project: KhposOpsBuilderProject;
  busyId: string | null;
  notes: Record<string, string>;
  references: Record<string, string>;
  selects: Record<string, string>;
  dates: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  onSelect: (key: string, value: string) => void;
  onDate: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, busyKey: string) => Promise<boolean>;
}) {
  const learnerKey = "evidence-learner-" + project.id;
  const dimensionKey = "evidence-dimension-" + project.id;
  const noteKey = "evidence-note-" + project.id;
  const refKey = "evidence-ref-" + project.id;
  const observedKey = "evidence-observed-" + project.id;
  const eligibleMembers = project.members.filter((member) =>
    ["active", "completed"].includes(member.status),
  );

  return (
    <details className="mt-4 rounded-2xl border border-slate-200 p-4">
      <summary className="cursor-pointer text-sm font-black text-slate-900">
        Individual contribution evidence
      </summary>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Team completion never creates automatic learner evidence. Record and
        verify each learner’s actual contribution separately.
      </p>

      {(project.isMentor || project.canManage) && eligibleMembers.length > 0 ? (
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          <select
            value={selects[learnerKey] ?? eligibleMembers[0]?.learnerId ?? ""}
            onChange={(event) => onSelect(learnerKey, event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
          >
            {eligibleMembers.map((member) => (
              <option key={member.id} value={member.learnerId}>
                {member.learnerName}
              </option>
            ))}
          </select>
          <select
            value={selects[dimensionKey] ?? "ownership"}
            onChange={(event) => onSelect(dimensionKey, event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
          >
            {evidenceDimensions.map((dimension) => (
              <option key={dimension} value={dimension}>
                {readable(dimension)}
              </option>
            ))}
          </select>
          <textarea
            value={notes[noteKey] ?? ""}
            onChange={(event) => onNote(noteKey, event.target.value)}
            placeholder="Specific individual contribution observed"
            rows={2}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />
          <input
            value={references[refKey] ?? ""}
            onChange={(event) => onReference(refKey, event.target.value)}
            placeholder="Evidence reference"
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />
          <input
            type="datetime-local"
            value={dates[observedKey] ?? ""}
            onChange={(event) => onDate(observedKey, event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "add_member_evidence",
                  projectId: project.id,
                  learnerId:
                    selects[learnerKey] ?? eligibleMembers[0]?.learnerId ?? "",
                  dimension: selects[dimensionKey] ?? "ownership",
                  contributionNote: notes[noteKey] ?? "",
                  evidenceReference: references[refKey] ?? "",
                  observedAt: dates[observedKey] ?? "",
                },
                "member-evidence-add-" + project.id,
              )
            }
            disabled={busyId === "member-evidence-add-" + project.id}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
          >
            Submit individual evidence
          </button>
        </div>
      ) : null}

      {project.memberEvidence.length > 0 ? (
        <div className="mt-4 space-y-2">
          {project.memberEvidence.map((evidence) => (
            <EvidenceCard
              key={evidence.id}
              evidence={evidence}
              notes={notes}
              onNote={onNote}
              submit={submit}
            />
          ))}
        </div>
      ) : null}
    </details>
  );
}

function EvidenceCard({
  evidence,
  notes,
  onNote,
  submit,
}: {
  evidence: KhposOpsBuilderProjectMemberEvidence;
  notes: Record<string, string>;
  onNote: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, busyKey: string) => Promise<boolean>;
}) {
  const noteKey = "evidence-action-" + evidence.id;

  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-black text-slate-900">
            {evidence.learnerName} · {readable(evidence.dimension)}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {evidence.contributionNote}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {formatDateTime(evidence.observedAt)} · {evidence.evidenceReference}
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
      {evidence.canVerify && evidence.status === "submitted" ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={notes[noteKey] ?? ""}
            onChange={(event) => onNote(noteKey, event.target.value)}
            placeholder="Verification / return note"
            className="min-w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          />
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "member_evidence_action",
                  evidenceId: evidence.id,
                  action: "verify",
                  note:
                    notes[noteKey] ??
                    "Individual contribution independently verified.",
                },
                "evidence-verify-" + evidence.id,
              )
            }
            className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white"
          >
            Verify → O16
          </button>
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "member_evidence_action",
                  evidenceId: evidence.id,
                  action: "return",
                  note:
                    notes[noteKey] ??
                    "Evidence returned for clarification or stronger proof.",
                },
                "evidence-return-" + evidence.id,
              )
            }
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900"
          >
            Return
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PortfolioSection({
  project,
  busyId,
  notes,
  references,
  selects,
  checks,
  onNote,
  onReference,
  onSelect,
  onCheck,
  submit,
}: {
  project: KhposOpsBuilderProject;
  busyId: string | null;
  notes: Record<string, string>;
  references: Record<string, string>;
  selects: Record<string, string>;
  checks: Record<string, boolean>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  onSelect: (key: string, value: string) => void;
  onCheck: (key: string, value: boolean) => void;
  submit: (payload: Record<string, unknown>, busyKey: string) => Promise<boolean>;
}) {
  const learnerKey = "portfolio-learner-" + project.id;
  const refKey = "portfolio-ref-" + project.id;
  const noteKey = "portfolio-note-" + project.id;
  const checkKey = "portfolio-confirm-" + project.id;
  const eligibleMembers = project.members.filter((member) =>
    ["active", "completed"].includes(member.status),
  );
  const canSubmit = ["defended", "completed"].includes(project.status);

  return (
    <details className="mt-4 rounded-2xl border border-slate-200 p-4">
      <summary className="cursor-pointer text-sm font-black text-slate-900">
        Deliberate PipuPath / portfolio handoff
      </summary>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        KHP-OS stores only a reference the learner deliberately shared. It does
        not pull private PipuPath project text, journals, missions or reflections.
      </p>

      {canSubmit && (project.isMentor || project.canManage) && eligibleMembers.length > 0 ? (
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          <select
            value={selects[learnerKey] ?? eligibleMembers[0]?.learnerId ?? ""}
            onChange={(event) => onSelect(learnerKey, event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
          >
            {eligibleMembers.map((member) => (
              <option key={member.id} value={member.learnerId}>
                {member.learnerName}
              </option>
            ))}
          </select>
          <input
            value={references[refKey] ?? ""}
            onChange={(event) => onReference(refKey, event.target.value)}
            placeholder="PipuPath / portfolio reference"
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />
          <textarea
            value={notes[noteKey] ?? ""}
            onChange={(event) => onNote(noteKey, event.target.value)}
            placeholder="What did the learner deliberately share, and why?"
            rows={2}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />
          <label className="flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-50 p-3 text-xs font-bold text-brand-900">
            <input
              type="checkbox"
              checked={checks[checkKey] ?? false}
              onChange={(event) => onCheck(checkKey, event.target.checked)}
              className="mt-0.5 size-4"
            />
            Learner deliberately shared this reference for school evidence.
          </label>
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "submit_portfolio_link",
                  projectId: project.id,
                  learnerId:
                    selects[learnerKey] ?? eligibleMembers[0]?.learnerId ?? "",
                  portfolioReference: references[refKey] ?? "",
                  shareNote: notes[noteKey] ?? "",
                  shareConfirmed: checks[checkKey] === true,
                },
                "portfolio-submit-" + project.id,
              )
            }
            disabled={busyId === "portfolio-submit-" + project.id}
            className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
          >
            Submit shared reference
          </button>
        </div>
      ) : null}

      {project.portfolioLinks.length > 0 ? (
        <div className="mt-4 space-y-2">
          {project.portfolioLinks.map((link) => (
            <PortfolioLinkCard
              key={link.id}
              link={link}
              notes={notes}
              onNote={onNote}
              submit={submit}
            />
          ))}
        </div>
      ) : null}
    </details>
  );
}

function PortfolioLinkCard({
  link,
  notes,
  onNote,
  submit,
}: {
  link: KhposOpsBuilderProjectPortfolioLink;
  notes: Record<string, string>;
  onNote: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, busyKey: string) => Promise<boolean>;
}) {
  const noteKey = "portfolio-action-" + link.id;

  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-black text-slate-900">
            {link.learnerName} · {link.referenceCode}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {link.shareNote}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {link.portfolioReference}
          </p>
        </div>
        <span
          className={
            "rounded-full border px-2.5 py-1 text-[10px] font-black capitalize " +
            statusClass(link.status)
          }
        >
          {readable(link.status)}
        </span>
      </div>

      {link.canVerify && link.status === "submitted" ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={notes[noteKey] ?? ""}
            onChange={(event) => onNote(noteKey, event.target.value)}
            placeholder="Verification / return note"
            className="min-w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          />
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "portfolio_link_action",
                  portfolioLinkId: link.id,
                  action: "verify",
                  note:
                    notes[noteKey] ??
                    "Learner-shared portfolio reference independently verified.",
                },
                "portfolio-verify-" + link.id,
              )
            }
            className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white"
          >
            Verify → O16
          </button>
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "portfolio_link_action",
                  portfolioLinkId: link.id,
                  action: "return",
                  note:
                    notes[noteKey] ??
                    "Portfolio reference returned for clarification.",
                },
                "portfolio-return-" + link.id,
              )
            }
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900"
          >
            Return
          </button>
        </div>
      ) : null}
    </div>
  );
}
