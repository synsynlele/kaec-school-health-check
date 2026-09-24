"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CircleDollarSign,
  HandHeart,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsCapabilityEvidence,
  KhposOpsFinancialActivity,
  KhposOpsLeadershipFinancialWorkspace,
  KhposOpsLeadershipOpportunity,
} from "@/lib/khpos/ops/leadership-financial";

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
  if (["verified", "completed", "delivered"].includes(status))
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["submitted", "active", "planned"].includes(status))
    return "border-brand-200 bg-brand-50 text-brand-800";
  if (["missed", "returned"].includes(status))
    return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

const leadershipDimensions = [
  "initiative",
  "responsibility",
  "service",
  "communication",
  "conflict_handling",
  "reliability",
  "decision_making",
  "team_contribution",
  "mobilisation",
  "problem_solving",
  "other",
];

const financialDimensions = [
  "budgeting",
  "saving",
  "costing",
  "pricing",
  "revenue_profit",
  "opportunity_cost",
  "responsible_spending",
  "record_keeping",
  "value_creation",
  "investment_concepts",
  "other",
];

export function LeadershipFinancialWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] =
    useState<KhposOpsLeadershipFinancialWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const [leadTermId, setLeadTermId] = useState("");
  const [leadCampusId, setLeadCampusId] = useState("");
  const [leadOwnerId, setLeadOwnerId] = useState("");
  const [leadType, setLeadType] = useState("leadership_lab");
  const [leadTitle, setLeadTitle] = useState("");
  const [leadPurpose, setLeadPurpose] = useState("");
  const [leadStart, setLeadStart] = useState("");
  const [leadEnd, setLeadEnd] = useState("");

  const [finTermId, setFinTermId] = useState("");
  const [finCampusId, setFinCampusId] = useState("");
  const [finOwnerId, setFinOwnerId] = useState("");
  const [finType, setFinType] = useState("financial_literacy_lab");
  const [finTitle, setFinTitle] = useState("");
  const [finPurpose, setFinPurpose] = useState("");
  const [finDate, setFinDate] = useState("");

  const [evLearnerId, setEvLearnerId] = useState("");
  const [evTermId, setEvTermId] = useState("");
  const [evDomain, setEvDomain] = useState<
    "leadership" | "financial_capability"
  >("leadership");
  const [evDimension, setEvDimension] = useState("responsibility");
  const [evContextId, setEvContextId] = useState("");
  const [evNote, setEvNote] = useState("");
  const [evReference, setEvReference] = useState("");
  const [evObservedAt, setEvObservedAt] = useState("");

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [references, setReferences] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});

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
        "/api/khpos/ops/leadership-financial/" + organisationId,
        {
          headers: { Authorization: "Bearer " + accessToken },
          cache: "no-store",
        },
      );

      const body = (await response.json()) as {
        ok?: boolean;
        capability?: KhposOpsLeadershipFinancialWorkspace;
        error?: string;
      };

      if (!active) return;
      if (!response.ok || !body.ok || !body.capability) {
        setError(
          body.error ?? "Leadership & Financial Capability could not be loaded.",
        );
        return;
      }

      const next = body.capability;
      setWorkspace(next);
      const activeTerm =
        next.terms.find((term) => term.status === "active") ?? next.terms[0];
      const campus = next.campuses[0];
      const mine =
        next.assignments.find((assignment) => assignment.isMine) ??
        next.assignments[0];
      const learner = next.learners[0];

      setLeadTermId((current) => current || activeTerm?.id || "");
      setFinTermId((current) => current || activeTerm?.id || "");
      setEvTermId((current) => current || activeTerm?.id || "");
      setLeadCampusId((current) => current || campus?.id || "");
      setFinCampusId((current) => current || campus?.id || "");
      setLeadOwnerId((current) => current || mine?.id || "");
      setFinOwnerId((current) => current || mine?.id || "");
      setEvLearnerId((current) => current || learner?.id || "");
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
      "/api/khpos/ops/leadership-financial/" + organisationId,
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
      capability?: KhposOpsLeadershipFinancialWorkspace;
      error?: string;
    };

    setBusyId(null);
    if (!response.ok || !body.ok || !body.capability) {
      setError(
        body.error ?? "Leadership & Financial Capability operation failed.",
      );
      return false;
    }

    setWorkspace(body.capability);
    return true;
  }

  const evidenceDimensions =
    evDomain === "leadership" ? leadershipDimensions : financialDimensions;

  const evidenceContexts =
    evDomain === "leadership"
      ? workspace?.leadershipOpportunities.filter((item) =>
          ["active", "completed"].includes(item.status),
        ) ?? []
      : workspace?.financialActivities.filter(
          (item) => item.status === "delivered",
        ) ?? [];

  async function createLeadership() {
    const ok = await submit(
      {
        mode: "create_leadership_opportunity",
        termId: leadTermId,
        campusId: leadCampusId,
        ownerAssignmentId: leadOwnerId,
        opportunityType: leadType,
        title: leadTitle,
        purpose: leadPurpose,
        plannedStartDate: leadStart,
        plannedEndDate: leadEnd || null,
      },
      "create-leadership",
    );
    if (ok) {
      setLeadTitle("");
      setLeadPurpose("");
      setLeadStart("");
      setLeadEnd("");
    }
  }

  async function createFinancial() {
    const ok = await submit(
      {
        mode: "create_financial_activity",
        termId: finTermId,
        campusId: finCampusId,
        ownerAssignmentId: finOwnerId,
        activityType: finType,
        title: finTitle,
        purpose: finPurpose,
        activityDate: finDate,
      },
      "create-financial",
    );
    if (ok) {
      setFinTitle("");
      setFinPurpose("");
      setFinDate("");
    }
  }

  async function addEvidence() {
    const ok = await submit(
      {
        mode: "add_evidence",
        learnerId: evLearnerId,
        termId: evTermId,
        domain: evDomain,
        dimension: evDimension,
        leadershipOpportunityId:
          evDomain === "leadership" && evContextId ? evContextId : null,
        financialActivityId:
          evDomain === "financial_capability" && evContextId
            ? evContextId
            : null,
        evidenceNote: evNote,
        evidenceReference: evReference,
        observedAt: evObservedAt
          ? new Date(evObservedAt).toISOString()
          : new Date().toISOString(),
      },
      "add-evidence",
    );
    if (ok) {
      setEvNote("");
      setEvReference("");
      setEvObservedAt("");
    }
  }

  if (!workspace && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <Loader2 className="size-8 animate-spin text-mint-300" />
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-2xl font-black">
            Leadership & Financial Capability is unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <Link
            href={"/khpos/" + organisationId}
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
              Operations · O18
            </span>
            <Link
              href={"/khpos/" + organisationId}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black"
            >
              <ArrowLeft className="size-4" />
              Command Centre
            </Link>
          </div>

          <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-5xl">
            Leadership & Financial Capability
          </h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-brand-100 sm:text-base">
            Leadership is demonstrated through responsibility, service and
            contribution. Financial capability is demonstrated through practical
            decisions, trade-offs and value application. Neither is awarded from
            attendance, titles or a numerical score.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {[
              ["Leadership opportunities", workspace.summary.leadershipOpportunities],
              ["Financial planned", workspace.summary.financialActivitiesPlanned],
              ["Financial missed", workspace.summary.financialActivitiesMissed],
              ["Awaiting verification", workspace.summary.submittedEvidence],
              ["Leadership verified", workspace.summary.verifiedLeadershipEvidence],
              ["Financial verified", workspace.summary.verifiedFinancialEvidence],
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
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-3">
          <GuardrailCard
            icon={<HandHeart className="size-5" />}
            title="Participation is not leadership"
            text="A title, council seat or attendance record does not prove leadership. Record what the learner actually took responsibility for and contributed."
          />
          <GuardrailCard
            icon={<CircleDollarSign className="size-5" />}
            title="Attendance is not financial capability"
            text="Financial capability needs practical evidence such as budgeting, costing, pricing, trade-off reasoning, responsible spending or value creation."
          />
          <GuardrailCard
            icon={<ShieldCheck className="size-5" />}
            title="PipuPath privacy stays intact"
            text={workspace.privacyBoundary}
          />
        </section>

        {workspace.executiveAggregateOnly ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-sm font-black">Executive aggregate view</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Learner-level evidence is intentionally hidden from a pure
              executive account. Operational staff with governed learner
              responsibility record and verify the underlying evidence.
            </p>
          </section>
        ) : null}

        {workspace.canRecord ? (
          <section className="grid gap-5 xl:grid-cols-3">
            <CreateLeadershipCard
              workspace={workspace}
              termId={leadTermId}
              campusId={leadCampusId}
              ownerId={leadOwnerId}
              type={leadType}
              title={leadTitle}
              purpose={leadPurpose}
              start={leadStart}
              end={leadEnd}
              busy={busyId === "create-leadership"}
              setTermId={setLeadTermId}
              setCampusId={setLeadCampusId}
              setOwnerId={setLeadOwnerId}
              setType={setLeadType}
              setTitle={setLeadTitle}
              setPurpose={setLeadPurpose}
              setStart={setLeadStart}
              setEnd={setLeadEnd}
              create={() => void createLeadership()}
            />

            <CreateFinancialCard
              workspace={workspace}
              termId={finTermId}
              campusId={finCampusId}
              ownerId={finOwnerId}
              type={finType}
              title={finTitle}
              purpose={finPurpose}
              date={finDate}
              busy={busyId === "create-financial"}
              setTermId={setFinTermId}
              setCampusId={setFinCampusId}
              setOwnerId={setFinOwnerId}
              setType={setFinType}
              setTitle={setFinTitle}
              setPurpose={setFinPurpose}
              setDate={setFinDate}
              create={() => void createFinancial()}
            />

            <div className="rounded-[30px] border border-violet-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">
                Learner evidence
              </p>
              <h2 className="mt-2 text-xl font-black">
                Record what was actually demonstrated
              </h2>
              <div className="mt-5 space-y-3">
                <select
                  value={evLearnerId}
                  onChange={(event) => setEvLearnerId(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">Choose learner</option>
                  {workspace.learners.map((learner) => (
                    <option key={learner.id} value={learner.id}>
                      {learner.displayName} · {learner.classLabel}
                    </option>
                  ))}
                </select>
                <select
                  value={evTermId}
                  onChange={(event) => setEvTermId(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">Choose term</option>
                  {workspace.terms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.sessionLabel} · {term.termName}
                    </option>
                  ))}
                </select>
                <select
                  value={evDomain}
                  onChange={(event) => {
                    const next = event.target.value as
                      | "leadership"
                      | "financial_capability";
                    setEvDomain(next);
                    setEvContextId("");
                    setEvDimension(
                      next === "leadership" ? "responsibility" : "budgeting",
                    );
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="leadership">Leadership</option>
                  <option value="financial_capability">
                    Financial capability
                  </option>
                </select>
                <select
                  value={evDimension}
                  onChange={(event) => setEvDimension(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm capitalize"
                >
                  {evidenceDimensions.map((dimension) => (
                    <option key={dimension} value={dimension}>
                      {readable(dimension)}
                    </option>
                  ))}
                </select>
                <select
                  value={evContextId}
                  onChange={(event) => setEvContextId(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">School-owned context (optional)</option>
                  {evidenceContexts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
                <textarea
                  value={evNote}
                  onChange={(event) => setEvNote(event.target.value)}
                  rows={3}
                  placeholder="Specific behaviour, decision or application observed"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
                <input
                  value={evReference}
                  onChange={(event) => setEvReference(event.target.value)}
                  placeholder="Evidence reference"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
                <label className="block text-xs font-black text-slate-600">
                  Observed at
                  <input
                    type="datetime-local"
                    value={evObservedAt}
                    onChange={(event) => setEvObservedAt(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void addEvidence()}
                disabled={busyId === "add-evidence"}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-violet-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                {busyId === "add-evidence" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Submit evidence
              </button>
            </div>
          </section>
        ) : null}

        <section className="space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
              Leadership opportunities
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Real responsibility, service and contribution
            </h2>
          </div>
          {workspace.leadershipOpportunities.length === 0 ? (
            <EmptyState text="No leadership opportunities are recorded yet." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {workspace.leadershipOpportunities.map((item) => (
                <LeadershipCard
                  key={item.id}
                  item={item}
                  notes={notes}
                  references={references}
                  busyId={busyId}
                  setNotes={setNotes}
                  setReferences={setReferences}
                  submit={submit}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              Financial capability activities
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Practical money, value and trade-off decisions
            </h2>
          </div>
          {workspace.financialActivities.length === 0 ? (
            <EmptyState text="No Financial Capability activities are recorded yet." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {workspace.financialActivities.map((item) => (
                <FinancialCard
                  key={item.id}
                  item={item}
                  notes={notes}
                  references={references}
                  dates={dates}
                  busyId={busyId}
                  setNotes={setNotes}
                  setReferences={setReferences}
                  setDates={setDates}
                  submit={submit}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">
              Evidence verification
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Independent verification required
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              The person who records capability evidence cannot verify that same
              evidence. Only verified evidence is linked into O16 Potential
              Development.
            </p>
          </div>
          {workspace.evidence.length === 0 ? (
            <EmptyState text="No Leadership or Financial Capability evidence is visible yet." />
          ) : (
            <div className="space-y-3">
              {workspace.evidence.map((item) => (
                <EvidenceCard
                  key={item.id}
                  item={item}
                  note={notes["evidence-" + item.id] ?? ""}
                  setNote={(value) =>
                    setNotes((current) => ({
                      ...current,
                      ["evidence-" + item.id]: value,
                    }))
                  }
                  submit={submit}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function GuardrailCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-brand-700">{icon}</div>
      <p className="mt-3 text-sm font-black text-slate-950">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-7 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function CreateLeadershipCard(props: {
  workspace: KhposOpsLeadershipFinancialWorkspace;
  termId: string;
  campusId: string;
  ownerId: string;
  type: string;
  title: string;
  purpose: string;
  start: string;
  end: string;
  busy: boolean;
  setTermId: (value: string) => void;
  setCampusId: (value: string) => void;
  setOwnerId: (value: string) => void;
  setType: (value: string) => void;
  setTitle: (value: string) => void;
  setPurpose: (value: string) => void;
  setStart: (value: string) => void;
  setEnd: (value: string) => void;
  create: () => void;
}) {
  return (
    <div className="rounded-[30px] border border-brand-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
        Leadership Development
      </p>
      <h2 className="mt-2 text-xl font-black">Create an opportunity</h2>
      <div className="mt-5 space-y-3">
        <select
          value={props.termId}
          onChange={(event) => props.setTermId(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        >
          <option value="">Choose term</option>
          {props.workspace.terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.sessionLabel} · {term.termName}
            </option>
          ))}
        </select>
        <select
          value={props.campusId}
          onChange={(event) => props.setCampusId(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        >
          <option value="">Choose campus</option>
          {props.workspace.campuses.map((campus) => (
            <option key={campus.id} value={campus.id}>
              {campus.name}
            </option>
          ))}
        </select>
        <select
          value={props.ownerId}
          onChange={(event) => props.setOwnerId(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        >
          <option value="">Choose owner</option>
          {props.workspace.assignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>
              {assignment.roleTitle}
              {assignment.isMine ? " · me" : ""}
            </option>
          ))}
        </select>
        <select
          value={props.type}
          onChange={(event) => props.setType(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm capitalize"
        >
          {[
            "leadership_lab",
            "service",
            "initiative",
            "team_leadership",
            "representation",
            "problem_solving",
            "peer_support",
            "event_role",
            "council_service",
            "community_contribution",
            "other",
          ].map((value) => (
            <option key={value} value={value}>
              {readable(value)}
            </option>
          ))}
        </select>
        <input
          value={props.title}
          onChange={(event) => props.setTitle(event.target.value)}
          placeholder="Opportunity title"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
        <textarea
          value={props.purpose}
          onChange={(event) => props.setPurpose(event.target.value)}
          rows={2}
          placeholder="What real responsibility or contribution will learners practise?"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={props.start}
            onChange={(event) => props.setStart(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
          <input
            type="date"
            value={props.end}
            onChange={(event) => props.setEnd(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={props.create}
        disabled={props.busy}
        className="mt-4 rounded-full bg-brand-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
      >
        Create leadership opportunity
      </button>
    </div>
  );
}

function CreateFinancialCard(props: {
  workspace: KhposOpsLeadershipFinancialWorkspace;
  termId: string;
  campusId: string;
  ownerId: string;
  type: string;
  title: string;
  purpose: string;
  date: string;
  busy: boolean;
  setTermId: (value: string) => void;
  setCampusId: (value: string) => void;
  setOwnerId: (value: string) => void;
  setType: (value: string) => void;
  setTitle: (value: string) => void;
  setPurpose: (value: string) => void;
  setDate: (value: string) => void;
  create: () => void;
}) {
  return (
    <div className="rounded-[30px] border border-emerald-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
        Financial Capability
      </p>
      <h2 className="mt-2 text-xl font-black">Plan a practical activity</h2>
      <div className="mt-5 space-y-3">
        <select
          value={props.termId}
          onChange={(event) => props.setTermId(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        >
          <option value="">Choose term</option>
          {props.workspace.terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.sessionLabel} · {term.termName}
            </option>
          ))}
        </select>
        <select
          value={props.campusId}
          onChange={(event) => props.setCampusId(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        >
          <option value="">Choose campus</option>
          {props.workspace.campuses.map((campus) => (
            <option key={campus.id} value={campus.id}>
              {campus.name}
            </option>
          ))}
        </select>
        <select
          value={props.ownerId}
          onChange={(event) => props.setOwnerId(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        >
          <option value="">Choose owner</option>
          {props.workspace.assignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>
              {assignment.roleTitle}
              {assignment.isMine ? " · me" : ""}
            </option>
          ))}
        </select>
        <select
          value={props.type}
          onChange={(event) => props.setType(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm capitalize"
        >
          {[
            "financial_literacy_lab",
            "budget_challenge",
            "saving_plan",
            "costing_practice",
            "pricing_practice",
            "profit_loss_practice",
            "opportunity_cost",
            "responsible_spending",
            "value_creation",
            "investment_concepts",
            "other",
          ].map((value) => (
            <option key={value} value={value}>
              {readable(value)}
            </option>
          ))}
        </select>
        <input
          value={props.title}
          onChange={(event) => props.setTitle(event.target.value)}
          placeholder="Activity title"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
        <textarea
          value={props.purpose}
          onChange={(event) => props.setPurpose(event.target.value)}
          rows={2}
          placeholder="What practical financial decision or capability is being developed?"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
        <input
          type="date"
          value={props.date}
          onChange={(event) => props.setDate(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={props.create}
        disabled={props.busy}
        className="mt-4 rounded-full bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
      >
        Plan Financial Capability activity
      </button>
    </div>
  );
}

function LeadershipCard({
  item,
  notes,
  references,
  busyId,
  setNotes,
  setReferences,
  submit,
}: {
  item: KhposOpsLeadershipOpportunity;
  notes: Record<string, string>;
  references: Record<string, string>;
  busyId: string | null;
  setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setReferences: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const noteKey = "lead-note-" + item.id;
  const refKey = "lead-ref-" + item.id;
  return (
    <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-black text-slate-400">
          {item.reference}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold capitalize text-slate-600">
          {readable(item.opportunityType)}
        </span>
        <span
          className={
            "rounded-full border px-3 py-1 text-[11px] font-black capitalize " +
            statusClass(item.status)
          }
        >
          {readable(item.status)}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-black">{item.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{item.purpose}</p>
      <p className="mt-3 text-xs font-semibold text-slate-500">
        {formatDate(item.plannedStartDate)} → {formatDate(item.plannedEndDate)}
      </p>

      {(item.isOwner || item.canManage) &&
      ["planned", "active"].includes(item.status) ? (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          <textarea
            value={notes[noteKey] ?? ""}
            onChange={(event) =>
              setNotes((current) => ({
                ...current,
                [noteKey]: event.target.value,
              }))
            }
            placeholder="Completion/cancellation note"
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
          />
          <input
            value={references[refKey] ?? ""}
            onChange={(event) =>
              setReferences((current) => ({
                ...current,
                [refKey]: event.target.value,
              }))
            }
            placeholder="Completion evidence reference"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
          />
          <div className="flex flex-wrap gap-2">
            {item.status === "planned" ? (
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "leadership_action",
                      opportunityId: item.id,
                      action: "activate",
                      note: notes[noteKey] || "Opportunity activated.",
                    },
                    "lead-activate-" + item.id,
                  )
                }
                className="rounded-full bg-brand-700 px-3 py-2 text-xs font-black text-white"
              >
                Activate
              </button>
            ) : null}
            <button
              type="button"
              disabled={busyId === "lead-complete-" + item.id}
              onClick={() =>
                void submit(
                  {
                    mode: "leadership_action",
                    opportunityId: item.id,
                    action: "complete",
                    note: notes[noteKey] ?? "",
                    evidenceReference: references[refKey] ?? "",
                  },
                  "lead-complete-" + item.id,
                )
              }
              className="rounded-full bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
            >
              Complete
            </button>
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "leadership_action",
                    opportunityId: item.id,
                    action: "cancel",
                    note: notes[noteKey] ?? "",
                  },
                  "lead-cancel-" + item.id,
                )
              }
              className="rounded-full border border-slate-300 px-3 py-2 text-xs font-black text-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function FinancialCard({
  item,
  notes,
  references,
  dates,
  busyId,
  setNotes,
  setReferences,
  setDates,
  submit,
}: {
  item: KhposOpsFinancialActivity;
  notes: Record<string, string>;
  references: Record<string, string>;
  dates: Record<string, string>;
  busyId: string | null;
  setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setReferences: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setDates: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const noteKey = "fin-note-" + item.id;
  const refKey = "fin-ref-" + item.id;
  const dateKey = "fin-date-" + item.id;
  return (
    <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-black text-slate-400">
          {item.reference}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold capitalize text-slate-600">
          {readable(item.activityType)}
        </span>
        <span
          className={
            "rounded-full border px-3 py-1 text-[11px] font-black capitalize " +
            statusClass(item.status)
          }
        >
          {readable(item.status)}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-black">{item.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{item.purpose}</p>
      <p className="mt-3 text-xs font-semibold text-slate-500">
        Planned {formatDate(item.activityDate)}
      </p>
      {item.issueId ? (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">
          O4 recovery issue created · {item.issueId.slice(0, 8)}
        </p>
      ) : null}
      {item.status === "missed" ? (
        <p className="mt-2 text-xs font-black capitalize text-amber-800">
          Recovery: {readable(item.recoveryStatus)}
          {item.recoveryDueDate ? " · due " + formatDate(item.recoveryDueDate) : ""}
        </p>
      ) : null}

      {(item.isOwner || item.canManage) && item.status === "planned" ? (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          <textarea
            value={notes[noteKey] ?? ""}
            onChange={(event) =>
              setNotes((current) => ({
                ...current,
                [noteKey]: event.target.value,
              }))
            }
            placeholder="Delivery, missed-delivery or cancellation note"
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
          />
          <input
            value={references[refKey] ?? ""}
            onChange={(event) =>
              setReferences((current) => ({
                ...current,
                [refKey]: event.target.value,
              }))
            }
            placeholder="Delivery evidence reference"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
          />
          <input
            type="date"
            value={dates[dateKey] ?? ""}
            onChange={(event) =>
              setDates((current) => ({
                ...current,
                [dateKey]: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busyId === "fin-deliver-" + item.id}
              onClick={() =>
                void submit(
                  {
                    mode: "financial_action",
                    activityId: item.id,
                    action: "deliver",
                    note: notes[noteKey] ?? "",
                    evidenceReference: references[refKey] ?? "",
                  },
                  "fin-deliver-" + item.id,
                )
              }
              className="rounded-full bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
            >
              Delivered
            </button>
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "financial_action",
                    activityId: item.id,
                    action: "miss",
                    note: notes[noteKey] ?? "",
                    recoveryDueDate: dates[dateKey] ?? "",
                  },
                  "fin-miss-" + item.id,
                )
              }
              className="rounded-full bg-amber-700 px-3 py-2 text-xs font-black text-white"
            >
              Missed · create recovery
            </button>
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "financial_action",
                    activityId: item.id,
                    action: "cancel",
                    note: notes[noteKey] ?? "",
                  },
                  "fin-cancel-" + item.id,
                )
              }
              className="rounded-full border border-slate-300 px-3 py-2 text-xs font-black text-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {(item.isOwner || item.canManage) &&
      item.status === "missed" &&
      ["required", "planned"].includes(item.recoveryStatus) ? (
        <div className="mt-4 space-y-2 border-t border-amber-100 pt-4">
          <p className="text-xs font-black text-amber-900">
            Close the recovery obligation
          </p>
          <textarea
            value={notes[noteKey] ?? ""}
            onChange={(event) =>
              setNotes((current) => ({
                ...current,
                [noteKey]: event.target.value,
              }))
            }
            placeholder="What recovery happened, or why is a waiver justified?"
            rows={2}
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-xs"
          />
          <input
            value={references[refKey] ?? ""}
            onChange={(event) =>
              setReferences((current) => ({
                ...current,
                [refKey]: event.target.value,
              }))
            }
            placeholder="Recovery evidence reference"
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "financial_action",
                    activityId: item.id,
                    action: "recover",
                    note: notes[noteKey] ?? "",
                    evidenceReference: references[refKey] ?? "",
                  },
                  "fin-recover-" + item.id,
                )
              }
              className="rounded-full bg-emerald-700 px-3 py-2 text-xs font-black text-white"
            >
              Record recovery
            </button>
            {item.canManage ? (
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "financial_action",
                      activityId: item.id,
                      action: "waive_recovery",
                      note: notes[noteKey] ?? "",
                    },
                    "fin-waive-" + item.id,
                  )
                }
                className="rounded-full border border-amber-300 px-3 py-2 text-xs font-black text-amber-900"
              >
                Waive with reason
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function EvidenceCard({
  item,
  note,
  setNote,
  submit,
}: {
  item: KhposOpsCapabilityEvidence;
  note: string;
  setNote: (value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black text-slate-400">
              {item.reference}
            </span>
            <span className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-black capitalize text-violet-800">
              {readable(item.domain)}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold capitalize text-slate-600">
              {readable(item.dimension)}
            </span>
            <span
              className={
                "rounded-full border px-3 py-1 text-[11px] font-black capitalize " +
                statusClass(item.status)
              }
            >
              {readable(item.status)}
            </span>
          </div>
          <h3 className="mt-3 text-base font-black">
            {item.learnerName}
          </h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            {item.evidenceNote}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Evidence: {item.evidenceReference}
          </p>
          {item.potentialEvidenceId ? (
            <p className="mt-2 text-xs font-black text-emerald-700">
              Linked to O16 Potential Development
            </p>
          ) : null}
        </div>

        {item.status === "submitted" && item.canVerify ? (
          <div className="min-w-[280px] rounded-2xl border border-brand-100 bg-brand-50 p-4">
            <p className="text-xs font-black text-brand-950">
              Independent verification required
            </p>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="Why does this evidence support—or fail to support—the claim?"
              className="mt-3 w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "evidence_action",
                      evidenceId: item.id,
                      action: "verify",
                      note,
                    },
                    "evidence-verify-" + item.id,
                  )
                }
                className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-3 py-2 text-xs font-black text-white"
              >
                <BadgeCheck className="size-3.5" />
                Verify
              </button>
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "evidence_action",
                      evidenceId: item.id,
                      action: "return",
                      note,
                    },
                    "evidence-return-" + item.id,
                  )
                }
                className="rounded-full border border-brand-200 px-3 py-2 text-xs font-black text-brand-900"
              >
                Return
              </button>
            </div>
          </div>
        ) : null}

        {item.isRecorder && !["withdrawn"].includes(item.status) ? (
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "evidence_action",
                  evidenceId: item.id,
                  action: "withdraw",
                  note: note || "Recorder withdrew this capability evidence.",
                },
                "evidence-withdraw-" + item.id,
              )
            }
            className="rounded-full border border-slate-200 px-3 py-2 text-xs font-black text-slate-600"
          >
            Withdraw
          </button>
        ) : null}
      </div>
    </article>
  );
}
