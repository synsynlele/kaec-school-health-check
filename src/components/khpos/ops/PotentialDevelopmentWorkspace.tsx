"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  Compass,
  FileText,
  FlaskConical,
  Lightbulb,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsPotentialDiscoveryWorkspace,
  KhposOpsPotentialLearner,
  KhposOpsPotentialReview,
} from "@/lib/khpos/ops/potential-discovery";

function readable(value: string | null | undefined) {
  return (value ?? "—").replaceAll("_", " ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function statusClass(status: string) {
  if (["approved", "completed", "demonstrated"].includes(status))
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["developing", "emerging", "submitted"].includes(status))
    return "border-brand-200 bg-brand-50 text-brand-800";
  if (["returned", "planned", "exploring"].includes(status))
    return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

const evidenceTypes = [
  "teacher_observation",
  "skills_application",
  "project",
  "leadership",
  "financial_capability",
  "value_creation",
  "school_reflection",
  "learner_shared_portfolio",
  "external",
  "other",
];

const explorationTypes = [
  "exposure",
  "practice",
  "challenge",
  "project",
  "conversation",
  "shadowing",
  "service",
  "other",
];

const reflectionTypes = [
  "school_conversation",
  "project_debrief",
  "skills_debrief",
  "leadership_debrief",
  "value_creation_debrief",
  "learner_shared_summary",
  "other",
];

export function PotentialDevelopmentWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] =
    useState<KhposOpsPotentialDiscoveryWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busy, setBusy] = useState("");

  const [learnerId, setLearnerId] = useState("");
  const [termId, setTermId] = useState("");

  const [interests, setInterests] = useState("");
  const [curiosity, setCuriosity] = useState("");
  const [problems, setProblems] = useState("");
  const [strengths, setStrengths] = useState("");
  const [choices, setChoices] = useState("");
  const [discoveryNote, setDiscoveryNote] = useState("");
  const [discoveryReference, setDiscoveryReference] = useState("");

  const [hypothesisTheme, setHypothesisTheme] = useState("");
  const [hypothesisSummary, setHypothesisSummary] = useState("");
  const [hypothesisNote, setHypothesisNote] = useState("");

  const [evidenceHypothesisId, setEvidenceHypothesisId] = useState("");
  const [evidenceType, setEvidenceType] = useState("teacher_observation");
  const [evidenceOrigin, setEvidenceOrigin] = useState<
    "school" | "learner_shared" | "external" | "manual"
  >("school");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [observedAt, setObservedAt] = useState("");

  const [explorationHypothesisId, setExplorationHypothesisId] = useState("");
  const [explorationType, setExplorationType] = useState("exposure");
  const [explorationArea, setExplorationArea] = useState("");
  const [explorationPurpose, setExplorationPurpose] = useState("");
  const [explorationOwner, setExplorationOwner] = useState("");
  const [explorationPlanned, setExplorationPlanned] = useState("");
  const [explorationReview, setExplorationReview] = useState("");

  const [reflectionType, setReflectionType] = useState("school_conversation");
  const [reflectionSummary, setReflectionSummary] = useState("");
  const [reflectionNext, setReflectionNext] = useState("");
  const [reflectionReference, setReflectionReference] = useState("");
  const [reflectedAt, setReflectedAt] = useState("");

  const [reviewDiscovery, setReviewDiscovery] = useState("");
  const [reviewHypotheses, setReviewHypotheses] = useState("");
  const [reviewEvidence, setReviewEvidence] = useState("");
  const [reviewDevelopment, setReviewDevelopment] = useState("");
  const [reviewContribution, setReviewContribution] = useState("");
  const [reviewPriorities, setReviewPriorities] = useState("");
  const [reviewPortfolio, setReviewPortfolio] = useState("");

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [references, setReferences] = useState<Record<string, string>>({});
  const [states, setStates] = useState<Record<string, string>>({});

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
      `/api/khpos/ops/potential-development/${organisationId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    const body = (await response.json()) as {
      ok?: boolean;
      potential?: KhposOpsPotentialDiscoveryWorkspace;
      error?: string;
    };
    if (!response.ok || !body.ok || !body.potential) {
      setError(body.error ?? "Potential Development could not be loaded.");
      return;
    }
    setWorkspace(body.potential);
    setLearnerId((current) => current || body.potential?.learners[0]?.id || "");
    setTermId(
      (current) =>
        current ||
        body.potential?.terms.find((term) => term.status === "active")?.id ||
        body.potential?.terms[0]?.id ||
        "",
    );
    setExplorationOwner(
      (current) => current || body.potential?.assignments[0]?.id || "",
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
        `/api/khpos/ops/potential-development/${organisationId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        potential?: KhposOpsPotentialDiscoveryWorkspace;
        error?: string;
      };
      if (!active) return;
      if (!response.ok || !body.ok || !body.potential) {
        setError(body.error ?? "Potential Development could not be loaded.");
        return;
      }
      setWorkspace(body.potential);
      setLearnerId(body.potential.learners[0]?.id ?? "");
      setTermId(
        body.potential.terms.find((term) => term.status === "active")?.id ??
          body.potential.terms[0]?.id ??
          "",
      );
      setExplorationOwner(body.potential.assignments[0]?.id ?? "");
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
      `/api/khpos/ops/potential-development/${organisationId}`,
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
      potential?: KhposOpsPotentialDiscoveryWorkspace;
      error?: string;
    };
    setBusy("");

    if (!response.ok || !body.ok || !body.potential) {
      setError(body.error ?? "Potential Development operation could not be completed.");
      return false;
    }

    setWorkspace(body.potential);
    return true;
  }

  const learner = workspace?.learners.find((item) => item.id === learnerId) ?? null;
  const activeHypotheses = learner?.hypotheses.filter((item) => item.status === "active") ?? [];
  const currentReview =
    learner?.reviews.find(
      (review) =>
        review.termId === termId &&
        ["draft", "returned", "submitted"].includes(review.status),
    ) ?? null;

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
          <ShieldCheck className="mx-auto size-8 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">
            Potential Development unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <Link
            href={`/khpos/${organisationId}`}
            className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-black text-slate-950"
          >
            Command Centre
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/khpos/${organisationId}`}
              className="inline-flex items-center gap-2 text-xs font-bold text-brand-100"
            >
              <ArrowLeft className="size-4" /> Command Centre
            </Link>
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-black text-mint-200">
              Operations · O16
            </span>
          </div>
          <div className="mt-6 max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-mint-300">
              Human Potential Development
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
              Potential Development
            </h1>
            <p className="mt-4 text-sm leading-7 text-brand-100 sm:text-base">
              Discover possibilities, test them through real experiences, collect
              evidence, reflect and review progress—without permanently labelling
              a learner or turning potential into a score.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ["Learners", workspace.summary.activeLearners],
            ["With discovery", workspace.summary.learnersWithDiscovery],
            ["Hypotheses", workspace.summary.activeHypotheses],
            ["Open explorations", workspace.summary.openExplorations],
            ["Reviews submitted", workspace.summary.submittedReviews],
            ["Reviews approved", workspace.summary.approvedReviews],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                {label}
              </p>
              <p className="mt-2 text-2xl font-black">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-brand-200 bg-brand-50 p-5">
            <div className="flex gap-3">
              <Lightbulb className="mt-0.5 size-5 shrink-0 text-brand-700" />
              <div>
                <p className="text-sm font-black text-brand-950">
                  Potential is a living hypothesis
                </p>
                <p className="mt-1 text-sm leading-6 text-brand-900/80">
                  {workspace.principle}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
            <div className="flex gap-3">
              <BrainCircuit className="mt-0.5 size-5 shrink-0 text-violet-700" />
              <div>
                <p className="text-sm font-black text-violet-950">
                  PipuPath privacy boundary
                </p>
                <p className="mt-1 text-sm leading-6 text-violet-900/80">
                  {workspace.privacyBoundary}
                </p>
                <Link
                  href={`/khpos/${organisationId}/human-potential-intelligence`}
                  className="mt-3 inline-flex text-xs font-black text-violet-800 underline"
                >
                  Open privacy-thresholded Human Potential Intelligence
                </Link>
              </div>
            </div>
          </div>
        </section>

        {workspace.executiveAggregateOnly ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <ShieldCheck className="mx-auto size-9 text-brand-700" />
            <h2 className="mt-3 text-xl font-black">Aggregate visibility only</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Your executive view shows institutional counts, not learner-level
              discovery records. Learner-level work belongs to the operating roles
              responsible for development.
            </p>
          </section>
        ) : workspace.learners.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <Compass className="mx-auto size-9 text-slate-400" />
            <h2 className="mt-3 text-xl font-black">No learner anchors yet</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              O16 intentionally reuses O14 learners. Create or sync learners in
              Learner Progress first; Potential Development does not create a
              second student database.
            </p>
            <Link
              href={`/khpos/${organisationId}/learner-progress`}
              className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white"
            >
              Open Learner Progress
            </Link>
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <label className="flex-1 text-xs font-black text-slate-600">
                  Learner
                  <select
                    value={learnerId}
                    onChange={(event) => setLearnerId(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"
                  >
                    {workspace.learners.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.displayName} · {item.classLabel}
                        {item.sectionLabel ? ` ${item.sectionLabel}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex-1 text-xs font-black text-slate-600">
                  Term
                  <select
                    value={termId}
                    onChange={(event) => setTermId(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"
                  >
                    {workspace.terms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.sessionLabel} · {term.termName} · {readable(term.status)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black"
                >
                  <RefreshCw className="size-4" /> Refresh
                </button>
              </div>
            </section>

            {learner ? (
              <>
                <LearnerSnapshot learner={learner} termId={termId} />

                {workspace.canRecord ? (
                  <section className="grid gap-5 xl:grid-cols-2">
                    <ActionCard
                      eyebrow="HPD-001"
                      title="Record learner discovery"
                      icon={Compass}
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        {[
                          ["Interests", interests, setInterests],
                          ["Curiosity", curiosity, setCuriosity],
                          ["Meaningful problems", problems, setProblems],
                          ["Recurring strengths", strengths, setStrengths],
                          ["Repeated choices", choices, setChoices],
                        ].map(([label, value, setter]) => (
                          <textarea
                            key={String(label)}
                            value={String(value)}
                            onChange={(event) =>
                              (setter as (value: string) => void)(event.target.value)
                            }
                            placeholder={String(label)}
                            rows={2}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                        ))}
                      </div>
                      <textarea
                        value={discoveryNote}
                        onChange={(event) => setDiscoveryNote(event.target.value)}
                        placeholder="Evidence-based discovery note. Avoid fixed talent labels."
                        rows={3}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <input
                        value={discoveryReference}
                        onChange={(event) =>
                          setDiscoveryReference(event.target.value)
                        }
                        placeholder="Evidence reference"
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={busy === "discovery"}
                        onClick={() =>
                          void submit(
                            {
                              mode: "record_discovery",
                              learnerId,
                              termId,
                              interestsSummary: interests,
                              curiositySummary: curiosity,
                              meaningfulProblemsSummary: problems,
                              recurringStrengthsSummary: strengths,
                              repeatedChoicesSummary: choices,
                              discoveryNote,
                              evidenceReference: discoveryReference,
                            },
                            "discovery",
                          )
                        }
                        className="mt-3 rounded-xl bg-brand-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                      >
                        Record discovery
                      </button>
                    </ActionCard>

                    <ActionCard
                      eyebrow="Potential hypothesis"
                      title="Keep possibilities open to evidence"
                      icon={Lightbulb}
                    >
                      <input
                        value={hypothesisTheme}
                        onChange={(event) => setHypothesisTheme(event.target.value)}
                        placeholder="Theme, e.g. Practical Problem Solving"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <textarea
                        value={hypothesisSummary}
                        onChange={(event) =>
                          setHypothesisSummary(event.target.value)
                        }
                        placeholder="Why is this worth exploring? State evidence, not certainty."
                        rows={3}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <textarea
                        value={hypothesisNote}
                        onChange={(event) => setHypothesisNote(event.target.value)}
                        placeholder="Optional next-test note"
                        rows={2}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={busy === "hypothesis"}
                        onClick={() =>
                          void submit(
                            {
                              mode: "create_hypothesis",
                              learnerId,
                              originTermId: termId,
                              themeLabel: hypothesisTheme,
                              hypothesisSummary,
                              currentNote: hypothesisNote,
                            },
                            "hypothesis",
                          )
                        }
                        className="mt-3 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                      >
                        Open hypothesis
                      </button>
                    </ActionCard>

                    <ActionCard
                      eyebrow="Evidence"
                      title="Add observable evidence"
                      icon={FileText}
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        <select
                          value={evidenceHypothesisId}
                          onChange={(event) =>
                            setEvidenceHypothesisId(event.target.value)
                          }
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        >
                          <option value="">Unlinked evidence</option>
                          {activeHypotheses.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.themeLabel}
                            </option>
                          ))}
                        </select>
                        <select
                          value={evidenceType}
                          onChange={(event) => setEvidenceType(event.target.value)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        >
                          {evidenceTypes.map((item) => (
                            <option key={item} value={item}>
                              {readable(item)}
                            </option>
                          ))}
                        </select>
                        <select
                          value={evidenceOrigin}
                          onChange={(event) =>
                            setEvidenceOrigin(
                              event.target.value as
                                | "school"
                                | "learner_shared"
                                | "external"
                                | "manual",
                            )
                          }
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        >
                          <option value="school">School</option>
                          <option value="learner_shared">Learner shared</option>
                          <option value="external">External</option>
                          <option value="manual">Manual</option>
                        </select>
                        <input
                          type="datetime-local"
                          value={observedAt}
                          onChange={(event) => setObservedAt(event.target.value)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <input
                        value={evidenceTitle}
                        onChange={(event) => setEvidenceTitle(event.target.value)}
                        placeholder="Evidence title"
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <textarea
                        value={evidenceNote}
                        onChange={(event) => setEvidenceNote(event.target.value)}
                        placeholder="What did the learner actually demonstrate?"
                        rows={3}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <input
                        value={evidenceReference}
                        onChange={(event) =>
                          setEvidenceReference(event.target.value)
                        }
                        placeholder="Evidence reference"
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={busy === "evidence"}
                        onClick={() =>
                          void submit(
                            {
                              mode: "add_evidence",
                              learnerId,
                              termId,
                              hypothesisId: evidenceHypothesisId || null,
                              evidenceType,
                              evidenceOrigin,
                              title: evidenceTitle,
                              evidenceNote,
                              evidenceReference,
                              observedAt: observedAt
                                ? new Date(observedAt).toISOString()
                                : "",
                            },
                            "evidence",
                          )
                        }
                        className="mt-3 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                      >
                        Add evidence
                      </button>
                    </ActionCard>

                    <ActionCard
                      eyebrow="HPD-002"
                      title="Create an exploration"
                      icon={FlaskConical}
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        <select
                          value={explorationHypothesisId}
                          onChange={(event) =>
                            setExplorationHypothesisId(event.target.value)
                          }
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        >
                          <option value="">No linked hypothesis</option>
                          {activeHypotheses.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.themeLabel}
                            </option>
                          ))}
                        </select>
                        <select
                          value={explorationType}
                          onChange={(event) =>
                            setExplorationType(event.target.value)
                          }
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        >
                          {explorationTypes.map((item) => (
                            <option key={item} value={item}>
                              {readable(item)}
                            </option>
                          ))}
                        </select>
                        <select
                          value={explorationOwner}
                          onChange={(event) =>
                            setExplorationOwner(event.target.value)
                          }
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        >
                          {workspace.assignments.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.roleTitle}
                            </option>
                          ))}
                        </select>
                        <input
                          value={explorationArea}
                          onChange={(event) => setExplorationArea(event.target.value)}
                          placeholder="Exploration area"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                        <input
                          type="date"
                          value={explorationPlanned}
                          onChange={(event) =>
                            setExplorationPlanned(event.target.value)
                          }
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                        <input
                          type="date"
                          value={explorationReview}
                          onChange={(event) =>
                            setExplorationReview(event.target.value)
                          }
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <textarea
                        value={explorationPurpose}
                        onChange={(event) =>
                          setExplorationPurpose(event.target.value)
                        }
                        placeholder="What are we trying to test or develop?"
                        rows={3}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={busy === "exploration"}
                        onClick={() =>
                          void submit(
                            {
                              mode: "create_exploration",
                              learnerId,
                              termId,
                              hypothesisId: explorationHypothesisId || null,
                              explorationType,
                              areaLabel: explorationArea,
                              purpose: explorationPurpose,
                              ownerAssignmentId: explorationOwner,
                              plannedDate: explorationPlanned,
                              reviewDate: explorationReview,
                            },
                            "exploration",
                          )
                        }
                        className="mt-3 rounded-xl bg-amber-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                      >
                        Plan exploration
                      </button>
                    </ActionCard>

                    <ActionCard
                      eyebrow="HPD-010"
                      title="Record school-owned reflection"
                      icon={Sparkles}
                    >
                      <select
                        value={reflectionType}
                        onChange={(event) => setReflectionType(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      >
                        {reflectionTypes.map((item) => (
                          <option key={item} value={item}>
                            {readable(item)}
                          </option>
                        ))}
                      </select>
                      <textarea
                        value={reflectionSummary}
                        onChange={(event) =>
                          setReflectionSummary(event.target.value)
                        }
                        placeholder="Learning summary—not a copied private journal."
                        rows={3}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <textarea
                        value={reflectionNext}
                        onChange={(event) => setReflectionNext(event.target.value)}
                        placeholder="Next step"
                        rows={2}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input
                          value={reflectionReference}
                          onChange={(event) =>
                            setReflectionReference(event.target.value)
                          }
                          placeholder="Evidence reference"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                        <input
                          type="datetime-local"
                          value={reflectedAt}
                          onChange={(event) => setReflectedAt(event.target.value)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={busy === "reflection"}
                        onClick={() =>
                          void submit(
                            {
                              mode: "record_reflection",
                              learnerId,
                              termId,
                              reflectionType,
                              learningSummary: reflectionSummary,
                              nextStep: reflectionNext,
                              evidenceReference: reflectionReference,
                              reflectedAt: reflectedAt
                                ? new Date(reflectedAt).toISOString()
                                : "",
                            },
                            "reflection",
                          )
                        }
                        className="mt-3 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                      >
                        Record reflection
                      </button>
                    </ActionCard>

                    <ActionCard
                      eyebrow="HPD-012"
                      title={currentReview ? "Term review already open" : "Prepare term review"}
                      icon={CheckCircle2}
                    >
                      {currentReview ? (
                        <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
                          <p className="text-sm font-black text-brand-950">
                            {currentReview.reference} · {readable(currentReview.status)}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-brand-800">
                            Edit this review in its record below. Keeping the edit
                            controls with the review avoids hidden state copies and
                            preserves the exact draft/returned record being changed.
                          </p>
                        </div>
                      ) : (
                        <>
                          {[
                            ["Discovery summary", reviewDiscovery, setReviewDiscovery],
                            ["Hypothesis summary", reviewHypotheses, setReviewHypotheses],
                            ["Evidence summary", reviewEvidence, setReviewEvidence],
                            ["Development summary", reviewDevelopment, setReviewDevelopment],
                            ["Contribution summary", reviewContribution, setReviewContribution],
                            ["Next priorities", reviewPriorities, setReviewPriorities],
                          ].map(([label, value, setter]) => (
                            <textarea
                              key={String(label)}
                              value={String(value)}
                              onChange={(event) =>
                                (setter as (value: string) => void)(event.target.value)
                              }
                              placeholder={String(label)}
                              rows={2}
                              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm first:mt-0"
                            />
                          ))}
                          <input
                            value={reviewPortfolio}
                            onChange={(event) => setReviewPortfolio(event.target.value)}
                            placeholder="Optional portfolio reference"
                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                          <button
                            type="button"
                            disabled={busy === "review-save"}
                            onClick={() =>
                              void submit(
                                {
                                  mode: "create_review",
                                  learnerId,
                                  termId,
                                  discoverySummary: reviewDiscovery,
                                  hypothesisSummary: reviewHypotheses,
                                  evidenceSummary: reviewEvidence,
                                  developmentSummary: reviewDevelopment,
                                  contributionSummary: reviewContribution,
                                  nextPriorities: reviewPriorities,
                                  portfolioReference: reviewPortfolio,
                                },
                                "review-save",
                              )
                            }
                            className="mt-3 rounded-xl bg-brand-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                          >
                            Create review
                          </button>
                        </>
                      )}
                    </ActionCard>
                  </section>
                ) : null}

                <PotentialRecords
                  learner={learner}
                  workspace={workspace}
                  notes={notes}
                  references={references}
                  states={states}
                  setNotes={setNotes}
                  setReferences={setReferences}
                  setStates={setStates}
                  submit={submit}
                  busy={busy}
                />
              </>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

function ActionCard({
  eyebrow,
  title,
  icon: Icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: typeof Compass;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-brand-700">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-black">{title}</h2>
        </div>
        <Icon className="size-5 text-brand-700" />
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function LearnerSnapshot({
  learner,
  termId,
}: {
  learner: KhposOpsPotentialLearner;
  termId: string;
}) {
  const termEvidence = learner.evidence.filter((item) => item.termId === termId);
  const termReflections = learner.reflections.filter((item) => item.termId === termId);
  const termExplorations = learner.explorations.filter((item) => item.termId === termId);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Current learner
          </p>
          <h2 className="mt-1 text-2xl font-black">{learner.displayName}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {learner.classLabel}
            {learner.sectionLabel ? ` · ${learner.sectionLabel}` : ""}
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            ["Hypotheses", learner.hypotheses.length],
            ["Evidence", termEvidence.length],
            ["Explorations", termExplorations.length],
            ["Reflections", termReflections.length],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-lg font-black">{value}</p>
              <p className="text-[10px] font-bold text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>
      {learner.discovery ? (
        <div className="mt-4 rounded-2xl bg-brand-50 p-4">
          <p className="text-xs font-black text-brand-900">
            Latest discovery · {learner.discovery.reference}
          </p>
          <p className="mt-2 text-sm leading-6 text-brand-950">
            {learner.discovery.discoveryNote}
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          No discovery record yet for this learner.
        </p>
      )}
    </section>
  );
}

function PotentialRecords({
  learner,
  workspace,
  notes,
  references,
  states,
  setNotes,
  setReferences,
  setStates,
  submit,
  busy,
}: {
  learner: KhposOpsPotentialLearner;
  workspace: KhposOpsPotentialDiscoveryWorkspace;
  notes: Record<string, string>;
  references: Record<string, string>;
  states: Record<string, string>;
  setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setReferences: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setStates: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
  busy: string;
}) {
  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
          Evidence chain
        </p>
        <h2 className="mt-1 text-2xl font-black">
          Discovery → test → evidence → reflection → review
        </h2>
      </div>

      {learner.hypotheses.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {learner.hypotheses.map((item) => {
            const stateKey = `hyp-state-${item.id}`;
            const noteKey = `hyp-note-${item.id}`;
            return (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-black text-slate-400">
                      {item.reference}
                    </p>
                    <h3 className="mt-1 text-lg font-black">{item.themeLabel}</h3>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-black capitalize ${statusClass(
                      item.developmentState,
                    )}`}
                  >
                    {readable(item.developmentState)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {item.hypothesisSummary}
                </p>
                {workspace.canCoordinate && item.status === "active" ? (
                  <div className="mt-4 grid gap-2">
                    <select
                      value={states[stateKey] ?? item.developmentState}
                      onChange={(event) =>
                        setStates((current) => ({
                          ...current,
                          [stateKey]: event.target.value,
                        }))
                      }
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    >
                      <option value="exploring">Exploring</option>
                      <option value="emerging">Emerging</option>
                      <option value="developing">Developing</option>
                      <option value="demonstrated">Demonstrated</option>
                    </select>
                    <textarea
                      value={notes[noteKey] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [noteKey]: event.target.value,
                        }))
                      }
                      placeholder="Evidence-based review note"
                      rows={2}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy === `hyp-${item.id}`}
                        onClick={() =>
                          void submit(
                            {
                              mode: "hypothesis_action",
                              hypothesisId: item.id,
                              action: states[stateKey] ?? item.developmentState,
                              note: notes[noteKey] ?? "",
                            },
                            `hyp-${item.id}`,
                          )
                        }
                        className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-black text-white"
                      >
                        Update state
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void submit(
                            {
                              mode: "hypothesis_action",
                              hypothesisId: item.id,
                              action: "retire",
                              note: notes[noteKey] ?? "",
                            },
                            `hyp-retire-${item.id}`,
                          )
                        }
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700"
                      >
                        Retire
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {learner.explorations.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-black">Explorations</h3>
          {learner.explorations.map((item) => {
            const noteKey = `exp-note-${item.id}`;
            const refKey = `exp-ref-${item.id}`;
            return (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-black capitalize text-amber-800">
                      {readable(item.explorationType)}
                    </p>
                    <h4 className="mt-1 font-black">{item.areaLabel}</h4>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {item.purpose}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-black capitalize ${statusClass(
                      item.status,
                    )}`}
                  >
                    {readable(item.status)}
                  </span>
                </div>
                {["planned", "active"].includes(item.status) ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <input
                      value={notes[noteKey] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [noteKey]: event.target.value,
                        }))
                      }
                      placeholder="Outcome / action note"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
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
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    />
                    <div className="flex gap-2 md:col-span-2">
                      {item.status === "planned" ? (
                        <button
                          type="button"
                          onClick={() =>
                            void submit(
                              {
                                mode: "exploration_action",
                                explorationId: item.id,
                                action: "start",
                              },
                              `exp-start-${item.id}`,
                            )
                          }
                          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900"
                        >
                          Start
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          void submit(
                            {
                              mode: "exploration_action",
                              explorationId: item.id,
                              action: "complete",
                              note: notes[noteKey] ?? "",
                              evidenceReference: references[refKey] ?? "",
                            },
                            `exp-complete-${item.id}`,
                          )
                        }
                        className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white"
                      >
                        Complete with evidence
                      </button>
                    </div>
                  </div>
                ) : item.outcomeNote ? (
                  <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    {item.outcomeNote}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {learner.evidence.length > 0 ? (
        <details className="rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-black">
            Evidence record · {learner.evidence.length}
          </summary>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {learner.evidence.map((item) => (
              <div key={item.id} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-black">{item.title}</p>
                <p className="mt-1 text-[11px] font-semibold capitalize text-slate-500">
                  {readable(item.evidenceType)} · {readable(item.evidenceOrigin)}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {item.evidenceNote}
                </p>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {learner.reflections.length > 0 ? (
        <details className="rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-black">
            School-owned reflection summaries · {learner.reflections.length}
          </summary>
          <div className="mt-3 space-y-2">
            {learner.reflections.map((item) => (
              <div key={item.id} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-black capitalize">
                  {readable(item.reflectionType)}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {item.learningSummary}
                </p>
                {item.nextStep ? (
                  <p className="mt-1 text-xs font-semibold text-brand-700">
                    Next: {item.nextStep}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {learner.reviews.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-black">Potential Progress Reviews</h3>
          {learner.reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              workspace={workspace}
              notes={notes}
              setNotes={setNotes}
              submit={submit}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ReviewCard({
  review,
  workspace,
  notes,
  setNotes,
  submit,
}: {
  review: KhposOpsPotentialReview;
  workspace: KhposOpsPotentialDiscoveryWorkspace;
  notes: Record<string, string>;
  setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const noteKey = `review-note-${review.id}`;
  const [discovery, setDiscovery] = useState(review.discoverySummary);
  const [hypotheses, setHypotheses] = useState(review.hypothesisSummary);
  const [evidence, setEvidence] = useState(review.evidenceSummary);
  const [development, setDevelopment] = useState(review.developmentSummary);
  const [contribution, setContribution] = useState(
    review.contributionSummary ?? "",
  );
  const [priorities, setPriorities] = useState(review.nextPriorities);
  const [portfolio, setPortfolio] = useState(review.portfolioReference ?? "");
  const editable = ["draft", "returned"].includes(review.status);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-black text-slate-400">{review.reference}</p>
          <h4 className="mt-1 text-lg font-black">Term Potential Progress Review</h4>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-black capitalize ${statusClass(
            review.status,
          )}`}
        >
          {readable(review.status)}
        </span>
      </div>

      {editable ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <textarea
            value={discovery}
            onChange={(event) => setDiscovery(event.target.value)}
            placeholder="Discovery summary"
            rows={3}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <textarea
            value={hypotheses}
            onChange={(event) => setHypotheses(event.target.value)}
            placeholder="Hypothesis summary"
            rows={3}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <textarea
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            placeholder="Evidence summary"
            rows={3}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <textarea
            value={development}
            onChange={(event) => setDevelopment(event.target.value)}
            placeholder="Development summary"
            rows={3}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <textarea
            value={contribution}
            onChange={(event) => setContribution(event.target.value)}
            placeholder="Contribution summary"
            rows={3}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <textarea
            value={priorities}
            onChange={(event) => setPriorities(event.target.value)}
            placeholder="Next priorities"
            rows={3}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            value={portfolio}
            onChange={(event) => setPortfolio(event.target.value)}
            placeholder="Optional portfolio reference"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2"
          />
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "update_review",
                    reviewId: review.id,
                    discoverySummary: discovery,
                    hypothesisSummary: hypotheses,
                    evidenceSummary: evidence,
                    developmentSummary: development,
                    contributionSummary: contribution,
                    nextPriorities: priorities,
                    portfolioReference: portfolio,
                  },
                  `review-update-${review.id}`,
                )
              }
              className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-black text-brand-800"
            >
              Save review
            </button>
            <button
              type="button"
              onClick={() =>
                void submit(
                  { mode: "review_action", reviewId: review.id, action: "submit" },
                  `review-submit-${review.id}`,
                )
              }
              className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-black text-white"
            >
              Submit evidence-gated review
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Summary label="Discovery" text={review.discoverySummary} />
          <Summary label="Hypotheses" text={review.hypothesisSummary} />
          <Summary label="Evidence" text={review.evidenceSummary} />
          <Summary label="Development" text={review.developmentSummary} />
          <Summary label="Next priorities" text={review.nextPriorities} />
          <Summary
            label="Contribution"
            text={review.contributionSummary ?? "Not recorded"}
          />
        </div>
      )}

      {review.status === "submitted" && workspace.canApproveReview ? (
        <div className="mt-4">
          <textarea
            value={notes[noteKey] ?? ""}
            onChange={(event) =>
              setNotes((current) => ({
                ...current,
                [noteKey]: event.target.value,
              }))
            }
            placeholder="Independent approval/return note"
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "review_action",
                    reviewId: review.id,
                    action: "approve",
                    note: notes[noteKey] ?? "",
                  },
                  `review-approve-${review.id}`,
                )
              }
              className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "review_action",
                    reviewId: review.id,
                    action: "return",
                    note: notes[noteKey] ?? "",
                  },
                  `review-return-${review.id}`,
                )
              }
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900"
            >
              Return for correction
            </button>
          </div>
        </div>
      ) : null}

      {review.approvalNote ? (
        <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900">
          Approval: {review.approvalNote}
        </p>
      ) : null}
      {review.returnNote ? (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
          Returned: {review.returnNote}
        </p>
      ) : null}
    </article>
  );
}

function Summary({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm leading-6 text-slate-700">{text}</p>
    </div>
  );
}
