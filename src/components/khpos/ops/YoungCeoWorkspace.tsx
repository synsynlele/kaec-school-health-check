"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  CircleDollarSign,
  Lightbulb,
  Loader2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsYoungCeoCycle,
  KhposOpsYoungCeoMemberEvidence,
  KhposOpsYoungCeoMilestone,
  KhposOpsYoungCeoSession,
  KhposOpsYoungCeoVenture,
  KhposOpsYoungCeoWorkspace,
} from "@/lib/khpos/ops/young-ceo";

function readable(value: string | null | undefined) {
  return (value ?? "—").replaceAll("_", " ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value + "T00:00:00"),
  );
}

function statusClass(status: string) {
  if (["verified", "completed", "delivered", "recovered"].includes(status))
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["active", "building", "testing", "selling", "iterating"].includes(status))
    return "border-brand-200 bg-brand-50 text-brand-800";
  if (["planned", "idea", "validating", "submitted", "evidence_submitted"].includes(status))
    return "border-violet-200 bg-violet-50 text-violet-800";
  if (["missed", "returned", "required"].includes(status))
    return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

const evidenceDimensions = [
  "problem_discovery",
  "customer_understanding",
  "solution_design",
  "value_proposition",
  "costing",
  "pricing",
  "communication",
  "selling",
  "money_management",
  "iteration",
  "collaboration",
  "initiative",
  "resilience",
  "other",
];

export function YoungCeoWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] =
    useState<KhposOpsYoungCeoWorkspace | null>(null);
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

  const [sessionCycleId, setSessionCycleId] = useState("");
  const [sessionOwnerId, setSessionOwnerId] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTheme, setSessionTheme] = useState("");
  const [sessionPurpose, setSessionPurpose] = useState("");

  const [ventureCycleId, setVentureCycleId] = useState("");
  const [ventureMode, setVentureMode] = useState<"individual" | "team">(
    "individual",
  );
  const [ventureName, setVentureName] = useState("");
  const [ventureProblem, setVentureProblem] = useState("");

  const [evidenceVentureId, setEvidenceVentureId] = useState("");
  const [evidenceLearnerId, setEvidenceLearnerId] = useState("");
  const [evidenceDimension, setEvidenceDimension] =
    useState("problem_discovery");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [evidenceObservedAt, setEvidenceObservedAt] = useState("");

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [references, setReferences] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [selects, setSelects] = useState<Record<string, string>>({});

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
        "/api/khpos/ops/young-ceo/" + organisationId,
        {
          headers: { Authorization: "Bearer " + accessToken },
          cache: "no-store",
        },
      );

      const body = (await response.json()) as {
        ok?: boolean;
        youngCeo?: KhposOpsYoungCeoWorkspace;
        error?: string;
      };

      if (!active) return;
      if (!response.ok || !body.ok || !body.youngCeo) {
        setError(body.error ?? "Young CEO Hub could not be loaded.");
        return;
      }

      const next = body.youngCeo;
      setWorkspace(next);
      const activeTerm =
        next.terms.find((term) => term.status === "active") ?? next.terms[0];
      const campus = next.campuses[0];
      const mine =
        next.assignments.find((assignment) => assignment.isMine) ??
        next.assignments[0];
      const openCycle =
        next.cycles.find((cycle) => cycle.status === "active") ??
        next.cycles.find((cycle) => cycle.status === "planned");
      const openVenture = next.ventures.find(
        (venture) =>
          venture.status !== "completed" && venture.status !== "withdrawn",
      );
      const learner = next.learners[0];

      setCycleTermId((current) => current || activeTerm?.id || "");
      setCycleCampusId((current) => current || campus?.id || "");
      setCycleOwnerId((current) => current || mine?.id || "");
      setSessionCycleId((current) => current || openCycle?.id || "");
      setSessionOwnerId((current) => current || mine?.id || "");
      setVentureCycleId((current) => current || openCycle?.id || "");
      setEvidenceVentureId((current) => current || openVenture?.id || "");
      setEvidenceLearnerId((current) => current || learner?.id || "");
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
      "/api/khpos/ops/young-ceo/" + organisationId,
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
      youngCeo?: KhposOpsYoungCeoWorkspace;
      error?: string;
    };

    setBusyId(null);
    if (!response.ok || !body.ok || !body.youngCeo) {
      setError(body.error ?? "Young CEO Hub operation could not be completed.");
      return false;
    }

    setWorkspace(body.youngCeo);
    return true;
  }

  async function createCycle() {
    const ok = await submit(
      {
        mode: "create_cycle",
        termId: cycleTermId,
        campusId: cycleCampusId,
        ownerAssignmentId: cycleOwnerId,
        title: cycleTitle,
        purpose: cyclePurpose,
        startDate: cycleStart,
        endDate: cycleEnd,
      },
      "create-cycle",
    );
    if (ok) {
      setCycleTitle("");
      setCyclePurpose("");
      setCycleStart("");
      setCycleEnd("");
    }
  }

  async function createSession() {
    const ok = await submit(
      {
        mode: "create_session",
        cycleId: sessionCycleId,
        ownerAssignmentId: sessionOwnerId,
        sessionDate,
        theme: sessionTheme,
        purpose: sessionPurpose,
      },
      "create-session",
    );
    if (ok) {
      setSessionDate("");
      setSessionTheme("");
      setSessionPurpose("");
    }
  }

  async function createVenture() {
    const ok = await submit(
      {
        mode: "create_venture",
        cycleId: ventureCycleId,
        name: ventureName,
        ventureMode,
        problemStatement: ventureProblem,
      },
      "create-venture",
    );
    if (ok) {
      setVentureName("");
      setVentureProblem("");
    }
  }

  async function addMemberEvidence() {
    const ok = await submit(
      {
        mode: "add_member_evidence",
        ventureId: evidenceVentureId,
        learnerId: evidenceLearnerId,
        dimension: evidenceDimension,
        contributionNote: evidenceNote,
        evidenceReference,
        observedAt: evidenceObservedAt,
      },
      "add-member-evidence",
    );
    if (ok) {
      setEvidenceNote("");
      setEvidenceReference("");
      setEvidenceObservedAt("");
    }
  }

  if (!workspace && !error) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-7 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={"/khpos/" + organisationId + "/potential-development"}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="size-3.5" />
            Potential Development
          </Link>
          <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-brand-600">
            Operations · O19
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Young CEO Hub
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Problem → customer → solution → value → costing → pricing → pitch →
            responsible value test → money management → iteration.
          </p>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-xs font-bold text-brand-900">
          HPD-P04 · HPD-007
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {error}
        </div>
      ) : null}

      {workspace ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Active cycles",
                value: workspace.summary.activeCycles,
                Icon: BriefcaseBusiness,
              },
              {
                label: "Planned sessions",
                value: workspace.summary.plannedSessions,
                Icon: CalendarClock,
              },
              {
                label: "Active ventures",
                value: workspace.summary.activeVentures,
                Icon: Lightbulb,
              },
              {
                label: "Verified evidence",
                value: workspace.summary.verifiedMemberEvidence,
                Icon: BadgeCheck,
              },
            ].map(({ label, value, Icon }) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    {label}
                  </p>
                  <Icon className="size-4 text-slate-400" />
                </div>
                <p className="mt-3 text-2xl font-black text-slate-950">
                  {value}
                </p>
              </div>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Boundary
              icon={BriefcaseBusiness}
              title="Value-creation principle"
              text={workspace.principle}
            />
            <Boundary
              icon={CircleDollarSign}
              title="Commercial boundary"
              text={workspace.commercialBoundary}
            />
            <Boundary
              icon={ShieldCheck}
              title="Privacy boundary"
              text={workspace.privacyBoundary}
            />
          </section>

          {workspace.executiveAggregateOnly ? (
            <section className="rounded-3xl border border-brand-200 bg-brand-50 p-6">
              <h2 className="text-lg font-black text-brand-950">
                Aggregate strategic view only
              </h2>
              <p className="mt-2 text-sm leading-6 text-brand-900">
                Vision Custodian sees Young CEO programme health and exceptions,
                not routine learner-level evidence merely because of executive
                authority.
              </p>
            </section>
          ) : null}

          {!workspace.executiveAggregateOnly &&
          (workspace.canManage || workspace.canFacilitate) ? (
            <section className="grid gap-5 xl:grid-cols-3">
              {workspace.canManage ? (
                <CreateCard title="Create Hub cycle" eyebrow="Programme">
                  <Select
                    value={cycleTermId}
                    onChange={setCycleTermId}
                    options={workspace.terms
                      .filter((term) => term.status === "active")
                      .map((term) => [term.id, term.termName])}
                    placeholder="Active term"
                  />
                  <Select
                    value={cycleCampusId}
                    onChange={setCycleCampusId}
                    options={workspace.campuses.map((campus) => [
                      campus.id,
                      campus.name,
                    ])}
                    placeholder="Campus"
                  />
                  <Select
                    value={cycleOwnerId}
                    onChange={setCycleOwnerId}
                    options={workspace.assignments.map((assignment) => [
                      assignment.id,
                      assignment.roleTitle +
                        (assignment.isMine ? " · me" : ""),
                    ])}
                    placeholder="Cycle owner"
                  />
                  <Input value={cycleTitle} onChange={setCycleTitle} placeholder="Cycle title" />
                  <TextArea
                    value={cyclePurpose}
                    onChange={setCyclePurpose}
                    placeholder="Purpose and intended value-creation outcome"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" value={cycleStart} onChange={setCycleStart} />
                    <Input type="date" value={cycleEnd} onChange={setCycleEnd} />
                  </div>
                  <PrimaryButton
                    busy={busyId === "create-cycle"}
                    onClick={createCycle}
                  >
                    Create cycle
                  </PrimaryButton>
                </CreateCard>
              ) : null}

              <CreateCard title="Schedule Hub session" eyebrow="Delivery">
                <Select
                  value={sessionCycleId}
                  onChange={setSessionCycleId}
                  options={workspace.cycles
                    .filter((cycle) =>
                      ["planned", "active"].includes(cycle.status),
                    )
                    .map((cycle) => [cycle.id, cycle.title])}
                  placeholder="Cycle"
                />
                <Select
                  value={sessionOwnerId}
                  onChange={setSessionOwnerId}
                  options={workspace.assignments.map((assignment) => [
                    assignment.id,
                    assignment.roleTitle +
                      (assignment.isMine ? " · me" : ""),
                  ])}
                  placeholder="Session owner"
                />
                <Input type="date" value={sessionDate} onChange={setSessionDate} />
                <Input
                  value={sessionTheme}
                  onChange={setSessionTheme}
                  placeholder="Session theme"
                />
                <TextArea
                  value={sessionPurpose}
                  onChange={setSessionPurpose}
                  placeholder="What should learners practise or produce?"
                />
                <PrimaryButton
                  busy={busyId === "create-session"}
                  onClick={createSession}
                >
                  Schedule session
                </PrimaryButton>
              </CreateCard>

              <CreateCard title="Open learner venture" eyebrow="Value creation">
                <Select
                  value={ventureCycleId}
                  onChange={setVentureCycleId}
                  options={workspace.cycles
                    .filter((cycle) =>
                      ["planned", "active"].includes(cycle.status),
                    )
                    .map((cycle) => [cycle.id, cycle.title])}
                  placeholder="Cycle"
                />
                <select
                  value={ventureMode}
                  onChange={(event) =>
                    setVentureMode(
                      event.target.value as "individual" | "team",
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="individual">Individual venture</option>
                  <option value="team">Team venture</option>
                </select>
                <Input
                  value={ventureName}
                  onChange={setVentureName}
                  placeholder="Venture name"
                />
                <TextArea
                  value={ventureProblem}
                  onChange={setVentureProblem}
                  placeholder="What real problem are learners investigating?"
                />
                <PrimaryButton
                  busy={busyId === "create-venture"}
                  onClick={createVenture}
                >
                  Open venture
                </PrimaryButton>
              </CreateCard>
            </section>
          ) : null}

          {!workspace.executiveAggregateOnly ? (
            <>
              <section className="space-y-4">
                <SectionHeading
                  eyebrow="Cycles & sessions"
                  title="Delivery that cannot quietly disappear"
                />
                {workspace.cycles.length === 0 ? (
                  <Empty text="No Young CEO Hub cycle has been created." />
                ) : (
                  workspace.cycles.map((cycle) => (
                    <CycleCard
                      key={cycle.id}
                      cycle={cycle}
                      sessions={workspace.sessions.filter(
                        (session) => session.cycleId === cycle.id,
                      )}
                      busyId={busyId}
                      notes={notes}
                      references={references}
                      dates={dates}
                      onNote={(key, value) =>
                        setNotes((current) => ({ ...current, [key]: value }))
                      }
                      onReference={(key, value) =>
                        setReferences((current) => ({
                          ...current,
                          [key]: value,
                        }))
                      }
                      onDate={(key, value) =>
                        setDates((current) => ({ ...current, [key]: value }))
                      }
                      submit={submit}
                    />
                  ))
                )}
              </section>

              <section className="space-y-4">
                <SectionHeading
                  eyebrow="Ventures"
                  title="Milestone-gated value creation"
                />
                {workspace.ventures.length === 0 ? (
                  <Empty text="No learner venture has been opened." />
                ) : (
                  workspace.ventures.map((venture) => (
                    <VentureCard
                      key={venture.id}
                      venture={venture}
                      workspace={workspace}
                      busyId={busyId}
                      notes={notes}
                      references={references}
                      selects={selects}
                      onNote={(key, value) =>
                        setNotes((current) => ({ ...current, [key]: value }))
                      }
                      onReference={(key, value) =>
                        setReferences((current) => ({
                          ...current,
                          [key]: value,
                        }))
                      }
                      onSelect={(key, value) =>
                        setSelects((current) => ({
                          ...current,
                          [key]: value,
                        }))
                      }
                      submit={submit}
                    />
                  ))
                )}
              </section>

              {(workspace.canFacilitate || workspace.canManage) &&
              workspace.ventures.length > 0 &&
              workspace.learners.length > 0 ? (
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <SectionHeading
                    eyebrow="Individual evidence"
                    title="Team success does not become automatic evidence for every learner"
                  />
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Select
                      value={evidenceVentureId}
                      onChange={setEvidenceVentureId}
                      options={workspace.ventures
                        .filter(
                          (venture) =>
                            venture.status !== "completed" &&
                            venture.status !== "withdrawn",
                        )
                        .map((venture) => [venture.id, venture.name])}
                      placeholder="Venture"
                    />
                    <Select
                      value={evidenceLearnerId}
                      onChange={setEvidenceLearnerId}
                      options={workspace.members
                        .filter(
                          (member) =>
                            member.ventureId === evidenceVentureId &&
                            ["active", "completed"].includes(member.status),
                        )
                        .map((member) => [member.learnerId, member.learnerName])}
                      placeholder="Venture member"
                    />
                    <Select
                      value={evidenceDimension}
                      onChange={setEvidenceDimension}
                      options={evidenceDimensions.map((dimension) => [
                        dimension,
                        readable(dimension),
                      ])}
                      placeholder="Dimension"
                    />
                    <Input
                      type="datetime-local"
                      value={evidenceObservedAt}
                      onChange={setEvidenceObservedAt}
                    />
                    <div className="md:col-span-2">
                      <TextArea
                        value={evidenceNote}
                        onChange={setEvidenceNote}
                        placeholder="What did this learner personally demonstrate?"
                      />
                    </div>
                    <Input
                      value={evidenceReference}
                      onChange={setEvidenceReference}
                      placeholder="Evidence reference"
                    />
                    <PrimaryButton
                      busy={busyId === "add-member-evidence"}
                      onClick={addMemberEvidence}
                    >
                      Submit individual evidence
                    </PrimaryButton>
                  </div>
                </section>
              ) : null}

              <section className="space-y-4">
                <SectionHeading
                  eyebrow="O16 handoff"
                  title="Verified individual value-creation evidence"
                />
                {workspace.memberEvidence.length === 0 ? (
                  <Empty text="No Young CEO individual evidence has been submitted." />
                ) : (
                  workspace.memberEvidence.map((evidence) => (
                    <EvidenceCard
                      key={evidence.id}
                      evidence={evidence}
                      busyId={busyId}
                      notes={notes}
                      onNote={(key, value) =>
                        setNotes((current) => ({ ...current, [key]: value }))
                      }
                      submit={submit}
                    />
                  ))
                )}
              </section>
            </>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

function Boundary({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ShieldCheck;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-brand-600" />
        <div>
          <h2 className="text-sm font-black text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
        </div>
      </div>
    </div>
  );
}

function CreateCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-600">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
    >
      <option value="">{placeholder}</option>
      {options.map(([id, label]) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </select>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={3}
      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
    />
  );
}

function PrimaryButton({
  busy,
  onClick,
  children,
}: {
  busy: boolean;
  onClick: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-600">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2>
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
  sessions,
  busyId,
  notes,
  references,
  dates,
  onNote,
  onReference,
  onDate,
  submit,
}: {
  cycle: KhposOpsYoungCeoCycle;
  sessions: KhposOpsYoungCeoSession[];
  busyId: string | null;
  notes: Record<string, string>;
  references: Record<string, string>;
  dates: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  onDate: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const canAct = cycle.isOwner || cycle.canManage;
  const noteKey = "cycle-note-" + cycle.id;
  const refKey = "cycle-ref-" + cycle.id;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-500">
              {cycle.reference}
            </span>
            <span
              className={
                "rounded-full border px-2.5 py-1 text-[11px] font-black capitalize " +
                statusClass(cycle.status)
              }
            >
              {readable(cycle.status)}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-black text-slate-950">
            {cycle.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{cycle.purpose}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {formatDate(cycle.startDate)} → {formatDate(cycle.endDate)}
          </p>
        </div>
      </div>

      {sessions.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
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
      ) : null}

      {canAct && !["completed", "cancelled"].includes(cycle.status) ? (
        <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 md:grid-cols-[1fr_1fr_auto]">
          <Input
            value={notes[noteKey] ?? ""}
            onChange={(value) => onNote(noteKey, value)}
            placeholder="Action / close-out note"
          />
          <Input
            value={references[refKey] ?? ""}
            onChange={(value) => onReference(refKey, value)}
            placeholder="Evidence reference for completion"
          />
          <div className="flex gap-2">
            {cycle.status === "planned" ? (
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "cycle_action",
                      cycleId: cycle.id,
                      action: "activate",
                    },
                    "cycle-activate-" + cycle.id,
                  )
                }
                className="rounded-xl bg-brand-700 px-3 py-2 text-xs font-black text-white"
              >
                Activate
              </button>
            ) : null}
            {cycle.status === "active" ? (
              <button
                type="button"
                disabled={busyId === "cycle-complete-" + cycle.id}
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
                className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
              >
                Complete
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function SessionCard({
  session,
  busyId,
  notes,
  references,
  dates,
  onNote,
  onReference,
  onDate,
  submit,
}: {
  session: KhposOpsYoungCeoSession;
  busyId: string | null;
  notes: Record<string, string>;
  references: Record<string, string>;
  dates: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  onDate: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const noteKey = "session-note-" + session.id;
  const refKey = "session-ref-" + session.id;
  const dateKey = "session-date-" + session.id;
  const canAct = session.isOwner || session.canManage;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black text-slate-950">{session.theme}</p>
        <span
          className={
            "rounded-full border px-2 py-1 text-[10px] font-black capitalize " +
            statusClass(
              session.status === "missed"
                ? session.recoveryStatus
                : session.status,
            )
          }
        >
          {session.status === "missed"
            ? readable(session.recoveryStatus)
            : readable(session.status)}
        </span>
      </div>
      <p className="mt-1 text-xs font-semibold text-slate-500">
        {formatDate(session.sessionDate)}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-600">{session.purpose}</p>

      {canAct &&
      (session.status === "planned" ||
        (session.status === "missed" &&
          session.recoveryStatus === "required")) ? (
        <div className="mt-3 space-y-2">
          <Input
            value={notes[noteKey] ?? ""}
            onChange={(value) => onNote(noteKey, value)}
            placeholder="Outcome note"
          />
          <Input
            value={references[refKey] ?? ""}
            onChange={(value) => onReference(refKey, value)}
            placeholder="Evidence reference"
          />
          {session.status === "planned" ? (
            <Input
              type="date"
              value={dates[dateKey] ?? ""}
              onChange={(value) => onDate(dateKey, value)}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {session.status === "planned" ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    void submit(
                      {
                        mode: "session_action",
                        sessionId: session.id,
                        action: "deliver",
                        note: notes[noteKey] ?? "",
                        evidenceReference: references[refKey] ?? "",
                      },
                      "session-deliver-" + session.id,
                    )
                  }
                  className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white"
                >
                  Deliver
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void submit(
                      {
                        mode: "session_action",
                        sessionId: session.id,
                        action: "miss",
                        note: notes[noteKey] ?? "",
                        recoveryDueDate: dates[dateKey] ?? "",
                      },
                      "session-miss-" + session.id,
                    )
                  }
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900"
                >
                  Mark missed
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busyId === "session-recover-" + session.id}
                onClick={() =>
                  void submit(
                    {
                      mode: "session_action",
                      sessionId: session.id,
                      action: "recover",
                      note: notes[noteKey] ?? "",
                      evidenceReference: references[refKey] ?? "",
                    },
                    "session-recover-" + session.id,
                  )
                }
                className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
              >
                Record recovery
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VentureCard({
  venture,
  workspace,
  busyId,
  notes,
  references,
  selects,
  onNote,
  onReference,
  onSelect,
  submit,
}: {
  venture: KhposOpsYoungCeoVenture;
  workspace: KhposOpsYoungCeoWorkspace;
  busyId: string | null;
  notes: Record<string, string>;
  references: Record<string, string>;
  selects: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  onSelect: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const members = workspace.members.filter(
    (member) => member.ventureId === venture.id,
  );
  const milestones = workspace.milestones.filter(
    (milestone) => milestone.ventureId === venture.id,
  );
  const learnerKey = "venture-learner-" + venture.id;
  const memberRoleKey = "venture-member-role-" + venture.id;
  const problemKey = "venture-problem-" + venture.id;
  const customerKey = "venture-customer-" + venture.id;
  const solutionKey = "venture-solution-" + venture.id;
  const valueKey = "venture-value-" + venture.id;
  const salesKey = "venture-sales-" + venture.id;
  const approvalKey = "venture-approval-" + venture.id;
  const financeKey = "venture-finance-" + venture.id;
  const actionNoteKey = "venture-action-note-" + venture.id;
  const actionRefKey = "venture-action-ref-" + venture.id;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-500">
              {venture.reference}
            </span>
            <span
              className={
                "rounded-full border px-2.5 py-1 text-[11px] font-black capitalize " +
                statusClass(venture.status)
              }
            >
              {readable(venture.status)}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black capitalize text-slate-700">
              {readable(venture.ventureMode)}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-black text-slate-950">
            {venture.name}
          </h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            {venture.problemStatement}
          </p>
        </div>
        <div className="text-right text-xs font-semibold text-slate-500">
          {milestones.filter((m) => m.status === "verified").length}/10
          milestones verified
        </div>
      </div>

      {venture.canFacilitate &&
      !["completed", "withdrawn"].includes(venture.status) ? (
        <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-black text-slate-800">
              Venture canvas & commercial mode
            </p>
            <TextArea
              value={notes[problemKey] ?? venture.problemStatement}
              onChange={(value) => onNote(problemKey, value)}
              placeholder="Problem statement"
            />
            <Input
              value={notes[customerKey] ?? venture.targetCustomer ?? ""}
              onChange={(value) => onNote(customerKey, value)}
              placeholder="Target customer / user"
            />
            <TextArea
              value={notes[solutionKey] ?? venture.solutionSummary ?? ""}
              onChange={(value) => onNote(solutionKey, value)}
              placeholder="Solution summary"
            />
            <TextArea
              value={notes[valueKey] ?? venture.valueProposition ?? ""}
              onChange={(value) => onNote(valueKey, value)}
              placeholder="Value proposition"
            />
            <Select
              value={selects[salesKey] ?? venture.salesMode}
              onChange={(value) => onSelect(salesKey, value)}
              options={[
                ["simulation", "Simulation"],
                ["internal_school", "Internal school real-money"],
                ["external_approved", "External approved"],
              ]}
              placeholder="Sales mode"
            />
            {venture.canManage ? (
              <>
                <Input
                  value={
                    references[approvalKey] ??
                    venture.salesApprovalReference ??
                    ""
                  }
                  onChange={(value) => onReference(approvalKey, value)}
                  placeholder="External approval / safeguarding / consent ref"
                />
                <Input
                  value={
                    references[financeKey] ?? venture.financeReference ?? ""
                  }
                  onChange={(value) => onReference(financeKey, value)}
                  placeholder="Finance/Admin transaction record ref"
                />
              </>
            ) : null}
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "update_venture_canvas",
                    ventureId: venture.id,
                    problemStatement:
                      notes[problemKey] ?? venture.problemStatement,
                    targetCustomer:
                      notes[customerKey] ?? venture.targetCustomer ?? "",
                    solutionSummary:
                      notes[solutionKey] ?? venture.solutionSummary ?? "",
                    valueProposition:
                      notes[valueKey] ?? venture.valueProposition ?? "",
                    salesMode: selects[salesKey] ?? venture.salesMode,
                    salesApprovalReference:
                      references[approvalKey] ??
                      venture.salesApprovalReference ??
                      "",
                    financeReference:
                      references[financeKey] ?? venture.financeReference ?? "",
                  },
                  "venture-canvas-" + venture.id,
                )
              }
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white"
            >
              Save canvas
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-black text-slate-800">Venture members</p>
            {members.length > 0 ? (
              <div className="space-y-1">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs"
                  >
                    <span className="font-bold text-slate-800">
                      {member.learnerName}
                    </span>
                    <span className="capitalize text-slate-500">
                      {readable(member.memberRole)} · {readable(member.status)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            <Select
              value={selects[learnerKey] ?? ""}
              onChange={(value) => onSelect(learnerKey, value)}
              options={workspace.learners.map((learner) => [
                learner.id,
                learner.displayName + " · " + learner.classLabel,
              ])}
              placeholder="Add learner"
            />
            <Select
              value={selects[memberRoleKey] ?? "member"}
              onChange={(value) => onSelect(memberRoleKey, value)}
              options={[
                ["lead", "Lead"],
                ["member", "Member"],
              ]}
              placeholder="Member role"
            />
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "member_action",
                    ventureId: venture.id,
                    learnerId: selects[learnerKey] ?? "",
                    action: "add",
                    memberRole: selects[memberRoleKey] ?? "member",
                  },
                  "venture-member-" + venture.id,
                )
              }
              className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-black text-white"
            >
              Add member
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {milestones.map((milestone) => (
          <MilestoneRow
            key={milestone.id}
            milestone={milestone}
            venture={venture}
            notes={notes}
            references={references}
            onNote={onNote}
            onReference={onReference}
            submit={submit}
          />
        ))}
      </div>

      {venture.canFacilitate &&
      !["completed", "withdrawn"].includes(venture.status) ? (
        <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 md:grid-cols-[1fr_1fr_auto]">
          <Input
            value={notes[actionNoteKey] ?? ""}
            onChange={(value) => onNote(actionNoteKey, value)}
            placeholder="Stage / completion note"
          />
          <Input
            value={references[actionRefKey] ?? ""}
            onChange={(value) => onReference(actionRefKey, value)}
            placeholder="Completion evidence reference"
          />
          <VentureStageButtons
            venture={venture}
            busyId={busyId}
            note={notes[actionNoteKey] ?? ""}
            evidenceReference={references[actionRefKey] ?? ""}
            submit={submit}
          />
        </div>
      ) : null}
    </article>
  );
}

function MilestoneRow({
  milestone,
  venture,
  notes,
  references,
  onNote,
  onReference,
  submit,
}: {
  milestone: KhposOpsYoungCeoMilestone;
  venture: KhposOpsYoungCeoVenture;
  notes: Record<string, string>;
  references: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const noteKey = "milestone-note-" + milestone.id;
  const refKey = "milestone-ref-" + milestone.id;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-black text-slate-950">
            {milestone.sequenceNo}. {milestone.title}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {milestone.expectedEvidence}
          </p>
        </div>
        <span
          className={
            "rounded-full border px-2 py-1 text-[10px] font-black capitalize " +
            statusClass(milestone.status)
          }
        >
          {readable(milestone.status)}
        </span>
      </div>

      {venture.canFacilitate &&
      ["not_started", "in_progress", "returned"].includes(milestone.status) ? (
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Input
            value={notes[noteKey] ?? ""}
            onChange={(value) => onNote(noteKey, value)}
            placeholder="Evidence note"
          />
          <Input
            value={references[refKey] ?? ""}
            onChange={(value) => onReference(refKey, value)}
            placeholder="Evidence reference"
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
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white"
          >
            Submit
          </button>
        </div>
      ) : null}

      {milestone.canVerify && milestone.status === "evidence_submitted" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            value={notes[noteKey] ?? ""}
            onChange={(value) => onNote(noteKey, value)}
            placeholder="Verification / return note"
          />
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "milestone_action",
                  milestoneId: milestone.id,
                  action: "verify",
                  note: notes[noteKey] ?? "",
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
                  note: notes[noteKey] ?? "",
                },
                "milestone-return-" + milestone.id,
              )
            }
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900"
          >
            Return
          </button>
        </div>
      ) : null}
    </div>
  );
}

function VentureStageButtons({
  venture,
  busyId,
  note,
  evidenceReference,
  submit,
}: {
  venture: KhposOpsYoungCeoVenture;
  busyId: string | null;
  note: string;
  evidenceReference: string;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const next: Record<
    string,
    { action: string; label: string }[]
  > = {
    idea: [{ action: "activate", label: "Begin validation" }],
    validating: [{ action: "build", label: "Move to building" }],
    building: [{ action: "test", label: "Move to testing" }],
    testing: [
      { action: "sell", label: "Begin value/sales test" },
      { action: "iterate", label: "Move to iteration" },
    ],
    selling: [{ action: "iterate", label: "Move to iteration" }],
    iterating: [
      { action: "test", label: "Test again" },
      { action: "sell", label: "Value test again" },
    ],
  };

  const actions = next[venture.status] ?? [];
  if (["testing", "selling", "iterating"].includes(venture.status)) {
    actions.push({ action: "complete", label: "Complete venture" });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((item) => (
        <button
          key={item.action}
          type="button"
          disabled={busyId === "venture-" + item.action + "-" + venture.id}
          onClick={() =>
            void submit(
              {
                mode: "venture_action",
                ventureId: venture.id,
                action: item.action,
                note,
                evidenceReference,
              },
              "venture-" + item.action + "-" + venture.id,
            )
          }
          className="rounded-xl bg-brand-700 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function EvidenceCard({
  evidence,
  busyId,
  notes,
  onNote,
  submit,
}: {
  evidence: KhposOpsYoungCeoMemberEvidence;
  busyId: string | null;
  notes: Record<string, string>;
  onNote: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const noteKey = "evidence-action-" + evidence.id;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-500">
            {evidence.reference}
          </p>
          <h3 className="mt-1 text-sm font-black text-slate-950">
            {evidence.learnerName} · {readable(evidence.dimension)}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {evidence.contributionNote}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Evidence: {evidence.evidenceReference}
          </p>
          {evidence.potentialEvidenceId ? (
            <p className="mt-1 text-xs font-black text-emerald-700">
              Linked to O16 Potential Evidence
            </p>
          ) : null}
        </div>
        <span
          className={
            "rounded-full border px-2.5 py-1 text-[11px] font-black capitalize " +
            statusClass(evidence.status)
          }
        >
          {readable(evidence.status)}
        </span>
      </div>

      {evidence.canVerify && evidence.status === "submitted" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            value={notes[noteKey] ?? ""}
            onChange={(value) => onNote(noteKey, value)}
            placeholder="Verification / return note"
          />
          <button
            type="button"
            disabled={busyId === "evidence-verify-" + evidence.id}
            onClick={() =>
              void submit(
                {
                  mode: "member_evidence_action",
                  evidenceId: evidence.id,
                  action: "verify",
                  note: notes[noteKey] ?? "",
                },
                "evidence-verify-" + evidence.id,
              )
            }
            className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
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
                  note: notes[noteKey] ?? "",
                },
                "evidence-return-" + evidence.id,
              )
            }
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900"
          >
            Return
          </button>
        </div>
      ) : null}
    </article>
  );
}
