"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpenCheck,
  ClipboardCheck,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsAcademicAssuranceWorkspace,
  KhposOpsAcademicCloseout,
  KhposOpsAssessmentCycle,
  KhposOpsAssessmentPackage,
  KhposOpsIntegrityCase,
  KhposOpsReadinessItem,
  KhposOpsResultCorrection,
} from "@/lib/khpos/ops/academic-assurance";

function readable(value: string | null | undefined) {
  return (value ?? "—").replaceAll("_", " ");
}

function statusClass(status: string) {
  if (["approved", "verified", "closed", "ready"].includes(status))
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (
    ["submitted", "planned", "in_progress", "results_pending", "under_review"].includes(
      status,
    )
  )
    return "border-brand-200 bg-brand-50 text-brand-800";
  if (["changes_required", "critical", "high", "exception_accepted"].includes(status))
    return "border-amber-200 bg-amber-50 text-amber-900";
  if (["rejected", "withdrawn", "cancelled", "referred"].includes(status))
    return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-violet-200 bg-violet-50 text-violet-800";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}

export function AcademicAssuranceWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] =
    useState<KhposOpsAcademicAssuranceWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});

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
        `/api/khpos/ops/academic-assurance/${organisationId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        academicAssurance?: KhposOpsAcademicAssuranceWorkspace;
        error?: string;
      };

      if (!active) return;
      if (!response.ok || !body.ok || !body.academicAssurance) {
        setError(body.error ?? "Academic Assurance could not be loaded.");
        return;
      }

      setWorkspace(body.academicAssurance);
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
      `/api/khpos/ops/academic-assurance/${organisationId}`,
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
      academicAssurance?: KhposOpsAcademicAssuranceWorkspace;
      error?: string;
    };
    setBusyId(null);

    if (!response.ok || !body.ok || !body.academicAssurance) {
      setError(body.error ?? "Academic Assurance operation could not be completed.");
      return false;
    }

    setWorkspace(body.academicAssurance);
    return true;
  }

  function value(key: string) {
    return values[key] ?? "";
  }

  function setValue(key: string, next: string) {
    setValues((current) => ({ ...current, [key]: next }));
  }

  if (!workspace && !error) {
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <Loader2 className="size-8 animate-spin text-brand-700" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-800">
          {error}
        </div>
      </main>
    );
  }

  const activeTerms = workspace.terms.filter((term) =>
    ["draft", "active"].includes(term.status),
  );

  return (
    <main className="mx-auto w-full max-w-7xl space-y-7 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <Link
          href={`/khpos/${organisationId}/academic-delivery`}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="size-3.5" />
          Academic Delivery
        </Link>
        <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-brand-600">
          Operations · O15
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Assessment, Examination & Academic Assurance
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Moderation, readiness, integrity, correction audit and academic
              close-out—without duplicating the SIS/CBT result system.
            </p>
          </div>
          <span className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-xs font-black text-brand-900">
            ACD-012…015 · ACD-P02
          </span>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Active cycles", workspace.summary.activeCycles],
          ["Awaiting moderation", workspace.summary.packagesAwaitingModeration],
          ["Readiness unresolved", workspace.summary.unresolvedReadiness],
          ["Integrity open", workspace.summary.openIntegrityCases],
          ["Corrections open", workspace.summary.openResultCorrections],
          ["Close-outs in review", workspace.summary.closeoutsAwaitingApproval],
        ].map(([label, number]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
              {String(label)}
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {String(number)}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" />
            <div>
              <p className="text-sm font-black text-emerald-950">
                Assurance principle
              </p>
              <p className="mt-1 text-sm leading-6 text-emerald-900">
                {workspace.principle}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex gap-3">
            <BookOpenCheck className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-black text-amber-950">
                Technology boundary
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                {workspace.technologyBoundary}
              </p>
            </div>
          </div>
        </div>
      </section>

      {workspace.executiveSummaryOnly ? (
        <section className="rounded-3xl border border-brand-200 bg-brand-50 p-6">
          <p className="text-sm font-black text-brand-950">
            Executive summary only
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-900">
            Routine assessment packages, learner/staff integrity subjects and
            result-correction records stay with the operational academic roles.
            Strategic executives see the aggregate assurance position by default.
          </p>
        </section>
      ) : (
        <>
          {workspace.canManage && activeTerms.length > 0 ? (
            <CreateCyclePanel
              workspace={workspace}
              values={values}
              flags={flags}
              busyId={busyId}
              setValue={setValue}
              setFlags={setFlags}
              submit={submit}
            />
          ) : null}

          <section className="space-y-4">
            <SectionHeading
              eyebrow="Assessment cycles"
              title="Plan → moderate → prove readiness → administer → reconcile"
            />
            {workspace.cycles.length === 0 ? (
              <Empty text="No governed assessment cycle is visible yet." />
            ) : (
              workspace.cycles.map((cycle) => (
                <CycleCard
                  key={cycle.id}
                  cycle={cycle}
                  workspace={workspace}
                  values={values}
                  flags={flags}
                  busyId={busyId}
                  setValue={setValue}
                  setFlags={setFlags}
                  submit={submit}
                />
              ))
            )}
          </section>

          <section className="space-y-4">
            <SectionHeading
              eyebrow="Academic integrity"
              title="Allegation ≠ finding: evidence + representation + reasoned decision"
            />
            <IntegrityReportPanel
              workspace={workspace}
              values={values}
              busyId={busyId}
              setValue={setValue}
              submit={submit}
            />
            {workspace.integrityCases.length === 0 ? (
              <Empty text="No academic-integrity case is visible." />
            ) : (
              workspace.integrityCases.map((item) => (
                <IntegrityCard
                  key={item.id}
                  item={item}
                  workspace={workspace}
                  values={values}
                  busyId={busyId}
                  setValue={setValue}
                  submit={submit}
                />
              ))
            )}
          </section>

          <section className="space-y-4">
            <SectionHeading
              eyebrow="Result correction"
              title="No silent edit: request → approve → external implementation → independent verification"
            />
            <CorrectionRequestPanel
              workspace={workspace}
              values={values}
              busyId={busyId}
              setValue={setValue}
              submit={submit}
            />
            {workspace.resultCorrections.length === 0 ? (
              <Empty text="No result-correction workflow is visible." />
            ) : (
              workspace.resultCorrections.map((item) => (
                <CorrectionCard
                  key={item.id}
                  item={item}
                  values={values}
                  busyId={busyId}
                  setValue={setValue}
                  submit={submit}
                />
              ))
            )}
          </section>

          {workspace.canCoordinate ? (
            <section className="space-y-4">
              <SectionHeading
                eyebrow="Academic close-out"
                title="Close the term only after assessment, support and exceptions are reconciled"
              />
              <CloseoutCreatePanel
                workspace={workspace}
                values={values}
                busyId={busyId}
                setValue={setValue}
                submit={submit}
              />
              {workspace.closeouts.length === 0 ? (
                <Empty text="No academic close-out has been prepared." />
              ) : (
                workspace.closeouts.map((item) => (
                  <CloseoutCard
                    key={item.id}
                    item={item}
                    values={values}
                    busyId={busyId}
                    setValue={setValue}
                    submit={submit}
                  />
                ))
              )}
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
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
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-semibold text-slate-500">
      {text}
    </div>
  );
}

function CreateCyclePanel({
  workspace,
  values,
  flags,
  busyId,
  setValue,
  setFlags,
  submit,
}: {
  workspace: KhposOpsAcademicAssuranceWorkspace;
  values: Record<string, string>;
  flags: Record<string, boolean>;
  busyId: string | null;
  setValue: (key: string, value: string) => void;
  setFlags: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const term = values["cycle-term"] || workspace.terms.find((item) => item.status === "active")?.id || workspace.terms[0]?.id || "";
  return (
    <details className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer text-sm font-black text-slate-950">
        Create assessment / examination cycle
      </summary>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <select
          value={term}
          onChange={(event) => setValue("cycle-term", event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        >
          {workspace.terms
            .filter((item) => ["draft", "active"].includes(item.status))
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.sessionLabel} · {item.termName}
              </option>
            ))}
        </select>
        <select
          value={values["cycle-type"] || "terminal"}
          onChange={(event) => setValue("cycle-type", event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        >
          {[
            "continuous_assessment",
            "midterm",
            "terminal",
            "mock",
            "external_exam",
            "practical",
            "other",
          ].map((item) => (
            <option key={item} value={item}>
              {readable(item)}
            </option>
          ))}
        </select>
        <input
          value={values["cycle-title"] || ""}
          onChange={(event) => setValue("cycle-title", event.target.value)}
          placeholder="Cycle title"
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm xl:col-span-2"
        />
        <input
          type="date"
          value={values["cycle-start"] || ""}
          onChange={(event) => setValue("cycle-start", event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
        <input
          type="date"
          value={values["cycle-end"] || ""}
          onChange={(event) => setValue("cycle-end", event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
        <input
          type="date"
          value={values["cycle-results"] || ""}
          onChange={(event) => setValue("cycle-results", event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
        <input
          value={values["cycle-external"] || ""}
          onChange={(event) => setValue("cycle-external", event.target.value)}
          placeholder="SIS/CBT/exam-body reference"
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-600">
        <input
          type="checkbox"
          checked={flags["cycle-campus"] ?? true}
          onChange={(event) =>
            setFlags((current) => ({
              ...current,
              "cycle-campus": event.target.checked,
            }))
          }
        />
        Scope to the term campus where available
      </label>
      <button
        type="button"
        disabled={busyId === "create-cycle"}
        onClick={() => {
          const selectedTerm = workspace.terms.find((item) => item.id === term);
          void submit(
            {
              mode: "create_cycle",
              termId: term,
              campusId:
                flags["cycle-campus"] === false
                  ? null
                  : selectedTerm?.campusId ?? null,
              title: values["cycle-title"],
              cycleType: values["cycle-type"] || "terminal",
              startsOn: values["cycle-start"],
              endsOn: values["cycle-end"],
              resultsDueOn: values["cycle-results"] || null,
              externalSystem: "SIS/CBT",
              externalReference: values["cycle-external"] || null,
            },
            "create-cycle",
          );
        }}
        className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
      >
        Create governed cycle
      </button>
    </details>
  );
}

function CycleCard({
  cycle,
  workspace,
  values,
  flags,
  busyId,
  setValue,
  setFlags,
  submit,
}: {
  cycle: KhposOpsAssessmentCycle;
  workspace: KhposOpsAcademicAssuranceWorkspace;
  values: Record<string, string>;
  flags: Record<string, boolean>;
  busyId: string | null;
  setValue: (key: string, value: string) => void;
  setFlags: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const cycleStreams = workspace.streams.filter(
    (stream) => stream.termId === cycle.termId,
  );
  const packageStreamKey = `pkg-stream-${cycle.id}`;
  const readyOwnerKey = `ready-owner-${cycle.id}`;
  const readyStreamKey = `ready-stream-${cycle.id}`;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-500">
              {cycle.reference}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-black capitalize ${statusClass(
                cycle.status,
              )}`}
            >
              {readable(cycle.status)}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black capitalize text-slate-700">
              {readable(cycle.cycleType)}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-black text-slate-950">{cycle.title}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {formatDate(cycle.startsOn)} → {formatDate(cycle.endsOn)}
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>{cycle.packages.length} package(s)</p>
          <p>{cycle.readinessItems.length} readiness control(s)</p>
        </div>
      </div>

      {cycle.canManage ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {cycle.status === "draft" ? (
            <ActionButton
              label="Approve plan"
              busy={busyId === `cycle-plan-${cycle.id}`}
              onClick={() =>
                void submit(
                  {
                    mode: "cycle_action",
                    cycleId: cycle.id,
                    action: "approve_plan",
                  },
                  `cycle-plan-${cycle.id}`,
                )
              }
            />
          ) : null}
          {cycle.status === "planned" ? (
            <ActionButton
              label="Mark Ready"
              busy={busyId === `cycle-ready-${cycle.id}`}
              onClick={() =>
                void submit(
                  {
                    mode: "cycle_action",
                    cycleId: cycle.id,
                    action: "mark_ready",
                  },
                  `cycle-ready-${cycle.id}`,
                )
              }
            />
          ) : null}
          {cycle.status === "ready" ? (
            <ActionButton
              label="Start cycle"
              busy={busyId === `cycle-start-${cycle.id}`}
              onClick={() =>
                void submit(
                  { mode: "cycle_action", cycleId: cycle.id, action: "start" },
                  `cycle-start-${cycle.id}`,
                )
              }
            />
          ) : null}
          {cycle.status === "in_progress" ? (
            <ActionButton
              label="Results pending"
              busy={busyId === `cycle-results-${cycle.id}`}
              onClick={() =>
                void submit(
                  {
                    mode: "cycle_action",
                    cycleId: cycle.id,
                    action: "results_pending",
                  },
                  `cycle-results-${cycle.id}`,
                )
              }
            />
          ) : null}
          {cycle.status === "results_pending" ? (
            <ActionButton
              label="Close cycle"
              busy={busyId === `cycle-close-${cycle.id}`}
              onClick={() =>
                void submit(
                  { mode: "cycle_action", cycleId: cycle.id, action: "close" },
                  `cycle-close-${cycle.id}`,
                )
              }
            />
          ) : null}
        </div>
      ) : null}

      {["draft", "planned"].includes(cycle.status) && cycleStreams.length > 0 ? (
        <details className="mt-4 rounded-2xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-black">
            Add assessment package reference
          </summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <select
              value={values[packageStreamKey] || cycleStreams[0]?.id || ""}
              onChange={(event) => setValue(packageStreamKey, event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            >
              {cycleStreams.map((stream) => (
                <option key={stream.id} value={stream.id}>
                  {stream.classLabel} {stream.sectionLabel ?? ""} ·{" "}
                  {stream.subjectLabel}
                </option>
              ))}
            </select>
            <select
              value={values[`pkg-source-${cycle.id}`] || "KSI"}
              onChange={(event) =>
                setValue(`pkg-source-${cycle.id}`, event.target.value)
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            >
              {["KSI", "SIS", "CBT", "external", "manual"].map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
            <input
              value={values[`pkg-ref-${cycle.id}`] || ""}
              onChange={(event) =>
                setValue(`pkg-ref-${cycle.id}`, event.target.value)
              }
              placeholder="Assessment source reference"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              value={values[`pkg-blueprint-${cycle.id}`] || ""}
              onChange={(event) =>
                setValue(`pkg-blueprint-${cycle.id}`, event.target.value)
              }
              placeholder="Blueprint/specification reference"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={flags[`pkg-declare-${cycle.id}`] ?? false}
              onChange={(event) =>
                setFlags((current) => ({
                  ...current,
                  [`pkg-declare-${cycle.id}`]: event.target.checked,
                }))
              }
            />
            I confirm this package follows the approved assessment-integrity
            requirements.
          </label>
          <button
            type="button"
            className="mt-3 rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white"
            onClick={() =>
              void submit(
                {
                  mode: "create_package",
                  cycleId: cycle.id,
                  streamId: values[packageStreamKey] || cycleStreams[0]?.id,
                  assessmentSource:
                    values[`pkg-source-${cycle.id}`] || "KSI",
                  sourceReference: values[`pkg-ref-${cycle.id}`],
                  blueprintReference: values[`pkg-blueprint-${cycle.id}`],
                  integrityDeclaration:
                    flags[`pkg-declare-${cycle.id}`] ?? false,
                },
                `pkg-create-${cycle.id}`,
              )
            }
          >
            Add package
          </button>
        </details>
      ) : null}

      {cycle.packages.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Moderation
          </p>
          {cycle.packages.map((pkg) => (
            <PackageRow
              key={pkg.id}
              pkg={pkg}
              busyId={busyId}
              values={values}
              setValue={setValue}
              submit={submit}
            />
          ))}
        </div>
      ) : null}

      {cycle.canManage && ["draft", "planned"].includes(cycle.status) ? (
        <details className="mt-4 rounded-2xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-black">
            Add examination-readiness control
          </summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <select
              value={values[`ready-category-${cycle.id}`] || "timetable"}
              onChange={(event) =>
                setValue(`ready-category-${cycle.id}`, event.target.value)
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            >
              {[
                "candidate_list",
                "timetable",
                "venue",
                "invigilation",
                "paper_material",
                "practical",
                "cbt_device",
                "power",
                "security",
                "access",
                "accommodation",
                "communication",
                "external_registration",
                "other",
              ].map((category) => (
                <option key={category} value={category}>
                  {readable(category)}
                </option>
              ))}
            </select>
            <select
              value={values[readyOwnerKey] || workspace.assignments[0]?.id || ""}
              onChange={(event) => setValue(readyOwnerKey, event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            >
              {workspace.assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.displayName} · {assignment.roleTitle}
                </option>
              ))}
            </select>
            <select
              value={values[readyStreamKey] || ""}
              onChange={(event) => setValue(readyStreamKey, event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            >
              <option value="">Whole cycle</option>
              {cycleStreams.map((stream) => (
                <option key={stream.id} value={stream.id}>
                  {stream.classLabel} · {stream.subjectLabel}
                </option>
              ))}
            </select>
            <input
              value={values[`ready-title-${cycle.id}`] || ""}
              onChange={(event) =>
                setValue(`ready-title-${cycle.id}`, event.target.value)
              }
              placeholder="Readiness control title"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              type="date"
              value={values[`ready-date-${cycle.id}`] || ""}
              onChange={(event) =>
                setValue(`ready-date-${cycle.id}`, event.target.value)
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              value={values[`ready-desc-${cycle.id}`] || ""}
              onChange={(event) =>
                setValue(`ready-desc-${cycle.id}`, event.target.value)
              }
              placeholder="What must be proven?"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
          </div>
          <button
            type="button"
            className="mt-3 rounded-lg bg-brand-700 px-3 py-2 text-xs font-black text-white"
            onClick={() =>
              void submit(
                {
                  mode: "create_readiness",
                  cycleId: cycle.id,
                  streamId: values[readyStreamKey] || null,
                  category:
                    values[`ready-category-${cycle.id}`] || "timetable",
                  title: values[`ready-title-${cycle.id}`],
                  description: values[`ready-desc-${cycle.id}`],
                  ownerAssignmentId:
                    values[readyOwnerKey] || workspace.assignments[0]?.id,
                  dueDate: values[`ready-date-${cycle.id}`],
                  mandatory: true,
                },
                `ready-create-${cycle.id}`,
              )
            }
          >
            Add readiness control
          </button>
        </details>
      ) : null}

      {cycle.readinessItems.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Examination readiness
          </p>
          {cycle.readinessItems.map((item) => (
            <ReadinessRow
              key={item.id}
              item={item}
              busyId={busyId}
              values={values}
              setValue={setValue}
              submit={submit}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function PackageRow({
  pkg,
  busyId,
  values,
  setValue,
  submit,
}: {
  pkg: KhposOpsAssessmentPackage;
  busyId: string | null;
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const noteKey = `pkg-note-${pkg.id}`;
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-900">{pkg.reference}</p>
          <p className="mt-1 text-xs text-slate-600">
            {pkg.assessmentSource} · {pkg.sourceReference}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Blueprint: {pkg.blueprintReference}
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-black capitalize ${statusClass(
            pkg.moderationState,
          )}`}
        >
          {readable(pkg.moderationState)}
        </span>
      </div>
      <textarea
        value={values[noteKey] || ""}
        onChange={(event) => setValue(noteKey, event.target.value)}
        placeholder="Moderation / action note"
        rows={2}
        className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {["draft", "changes_required"].includes(pkg.moderationState) ? (
          <MiniButton
            label="Submit"
            busy={busyId === `pkg-submit-${pkg.id}`}
            onClick={() =>
              void submit(
                { mode: "package_action", packageId: pkg.id, action: "submit" },
                `pkg-submit-${pkg.id}`,
              )
            }
          />
        ) : null}
        {pkg.canModerate && pkg.moderationState === "submitted" ? (
          <>
            <MiniButton
              label="Approve"
              busy={busyId === `pkg-approve-${pkg.id}`}
              onClick={() =>
                void submit(
                  {
                    mode: "package_action",
                    packageId: pkg.id,
                    action: "approve",
                    note: values[noteKey] || null,
                  },
                  `pkg-approve-${pkg.id}`,
                )
              }
            />
            <MiniButton
              label="Request changes"
              busy={busyId === `pkg-changes-${pkg.id}`}
              onClick={() =>
                void submit(
                  {
                    mode: "package_action",
                    packageId: pkg.id,
                    action: "request_changes",
                    note: values[noteKey],
                  },
                  `pkg-changes-${pkg.id}`,
                )
              }
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function ReadinessRow({
  item,
  busyId,
  values,
  setValue,
  submit,
}: {
  item: KhposOpsReadinessItem;
  busyId: string | null;
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const noteKey = `ready-note-${item.id}`;
  const refKey = `ready-ref-${item.id}`;
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-900">{item.title}</p>
          <p className="mt-1 text-xs text-slate-600">{item.description}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {readable(item.category)} · due {formatDate(item.dueDate)}
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-black capitalize ${statusClass(
            item.status,
          )}`}
        >
          {readable(item.status)}
        </span>
      </div>

      {(item.isOwner || item.canVerify) &&
      !["verified", "exception_accepted"].includes(item.status) ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <input
            value={values[noteKey] || ""}
            onChange={(event) => setValue(noteKey, event.target.value)}
            placeholder="Completion / review note"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          />
          <input
            value={values[refKey] || ""}
            onChange={(event) => setValue(refKey, event.target.value)}
            placeholder="Evidence / authority reference"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          />
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        {item.isOwner && ["pending", "in_progress"].includes(item.status) ? (
          <MiniButton
            label="Submit evidence"
            busy={busyId === `ready-submit-${item.id}`}
            onClick={() =>
              void submit(
                {
                  mode: "readiness_action",
                  itemId: item.id,
                  action: "submit_evidence",
                  note: values[noteKey],
                  evidenceReference: values[refKey],
                },
                `ready-submit-${item.id}`,
              )
            }
          />
        ) : null}
        {item.canVerify && item.status === "evidence_submitted" ? (
          <MiniButton
            label="Verify"
            busy={busyId === `ready-verify-${item.id}`}
            onClick={() =>
              void submit(
                {
                  mode: "readiness_action",
                  itemId: item.id,
                  action: "verify",
                },
                `ready-verify-${item.id}`,
              )
            }
          />
        ) : null}
      </div>
    </div>
  );
}

function IntegrityReportPanel({
  workspace,
  values,
  busyId,
  setValue,
  submit,
}: {
  workspace: KhposOpsAcademicAssuranceWorkspace;
  values: Record<string, string>;
  busyId: string | null;
  setValue: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const termId =
    values["int-term"] ||
    workspace.terms.find((term) => term.status === "active")?.id ||
    "";
  const cycleOptions = workspace.cycles.filter((cycle) => cycle.termId === termId);
  const subjectType = values["int-subject-type"] || "process";

  return (
    <details className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer text-sm font-black">
        Report academic-integrity concern
      </summary>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <select
          value={termId}
          onChange={(event) => setValue("int-term", event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
        >
          {workspace.terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.sessionLabel} · {term.termName}
            </option>
          ))}
        </select>
        <select
          value={values["int-cycle"] || ""}
          onChange={(event) => setValue("int-cycle", event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
        >
          <option value="">No cycle</option>
          {cycleOptions.map((cycle) => (
            <option key={cycle.id} value={cycle.id}>
              {cycle.title}
            </option>
          ))}
        </select>
        <select
          value={subjectType}
          onChange={(event) => setValue("int-subject-type", event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
        >
          {["process", "system", "learner", "staff"].map((item) => (
            <option key={item} value={item}>
              {readable(item)}
            </option>
          ))}
        </select>
        {subjectType === "learner" ? (
          <select
            value={values["int-learner"] || ""}
            onChange={(event) => setValue("int-learner", event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
          >
            <option value="">Choose learner</option>
            {workspace.learners.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName}
              </option>
            ))}
          </select>
        ) : subjectType === "staff" ? (
          <select
            value={values["int-staff"] || ""}
            onChange={(event) => setValue("int-staff", event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
          >
            <option value="">Choose staff</option>
            {workspace.staff.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName} · {item.roleTitle}
              </option>
            ))}
          </select>
        ) : (
          <div />
        )}
        <select
          value={values["int-type"] || "administrative_irregularity"}
          onChange={(event) => setValue("int-type", event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
        >
          {[
            "cheating",
            "plagiarism",
            "collusion",
            "unauthorised_aid",
            "impersonation",
            "paper_leakage",
            "mark_tampering",
            "result_manipulation",
            "administrative_irregularity",
            "other",
          ].map((item) => (
            <option key={item} value={item}>
              {readable(item)}
            </option>
          ))}
        </select>
        <select
          value={values["int-severity"] || "standard"}
          onChange={(event) => setValue("int-severity", event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
        >
          <option value="standard">Standard</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <input
          value={values["int-source"] || ""}
          onChange={(event) => setValue("int-source", event.target.value)}
          placeholder="Source/evidence reference"
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
        />
        <textarea
          value={values["int-summary"] || ""}
          onChange={(event) => setValue("int-summary", event.target.value)}
          placeholder="Specific allegation/incident summary — allegation is not a finding."
          rows={2}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs xl:col-span-4"
        />
      </div>
      <button
        type="button"
        disabled={busyId === "report-integrity"}
        onClick={() =>
          void submit(
            {
              mode: "report_integrity",
              termId,
              cycleId: values["int-cycle"] || null,
              streamId: null,
              subjectType,
              learnerId:
                subjectType === "learner" ? values["int-learner"] : null,
              subjectStaffId:
                subjectType === "staff" ? values["int-staff"] : null,
              incidentType:
                values["int-type"] || "administrative_irregularity",
              severity: values["int-severity"] || "standard",
              incidentSummary: values["int-summary"],
              sourceReference: values["int-source"] || null,
            },
            "report-integrity",
          )
        }
        className="mt-3 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
      >
        Report concern
      </button>
    </details>
  );
}

function IntegrityCard({
  item,
  workspace,
  values,
  busyId,
  setValue,
  submit,
}: {
  item: KhposOpsIntegrityCase;
  workspace: KhposOpsAcademicAssuranceWorkspace;
  values: Record<string, string>;
  busyId: string | null;
  setValue: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const noteKey = `int-note-${item.id}`;
  const refKey = `int-ref-${item.id}`;
  const outcomeKey = `int-outcome-${item.id}`;
  const actionKey = `int-action-${item.id}`;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-black text-slate-500">{item.reference}</span>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-black capitalize ${statusClass(
                item.status,
              )}`}
            >
              {readable(item.status)}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-black capitalize ${statusClass(
                item.severity,
              )}`}
            >
              {item.severity}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-black text-slate-950">
            {readable(item.incidentType)}
          </h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            {item.incidentSummary}
          </p>
          {item.learnerName ? (
            <p className="mt-2 text-xs font-bold text-slate-500">
              Learner: {item.learnerName}
            </p>
          ) : null}
          {item.subjectStaffName ? (
            <p className="mt-2 text-xs font-bold text-slate-500">
              Staff: {item.subjectStaffName}
            </p>
          ) : null}
        </div>
      </div>

      {item.representationNote ? (
        <div className="mt-4 rounded-2xl bg-brand-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-700">
            Subject representation
          </p>
          <p className="mt-2 text-sm leading-6 text-brand-950">
            {item.representationNote}
          </p>
        </div>
      ) : null}

      {item.evidence.length > 0 ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {item.evidence.map((evidence) => (
            <div key={evidence.id} className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-black">{evidence.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                {evidence.note}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {!["decision_recorded", "referred", "closed"].includes(item.status) ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 p-3">
            <p className="text-xs font-black">Add evidence</p>
            <input
              value={values[`evidence-title-${item.id}`] || ""}
              onChange={(event) =>
                setValue(`evidence-title-${item.id}`, event.target.value)
              }
              placeholder="Evidence title"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
            />
            <textarea
              value={values[`evidence-note-${item.id}`] || ""}
              onChange={(event) =>
                setValue(`evidence-note-${item.id}`, event.target.value)
              }
              placeholder="What does it establish?"
              rows={2}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
            />
            <MiniButton
              label="Add evidence"
              busy={busyId === `int-evidence-${item.id}`}
              onClick={() =>
                void submit(
                  {
                    mode: "integrity_evidence",
                    caseId: item.id,
                    evidenceType: "system_record",
                    title: values[`evidence-title-${item.id}`],
                    note: values[`evidence-note-${item.id}`],
                    evidenceReference: values[refKey] || null,
                  },
                  `int-evidence-${item.id}`,
                )
              }
            />
          </div>

          {["learner", "staff"].includes(item.subjectType) &&
          !item.representationRecordedAt &&
          workspace.canCoordinate &&
          !item.isReporter ? (
            <div className="rounded-2xl border border-slate-200 p-3">
              <p className="text-xs font-black">Record subject explanation</p>
              <textarea
                value={values[`representation-${item.id}`] || ""}
                onChange={(event) =>
                  setValue(`representation-${item.id}`, event.target.value)
                }
                placeholder="Their explanation, or documented decline/inability to respond"
                rows={3}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
              <MiniButton
                label="Record representation"
                busy={busyId === `int-representation-${item.id}`}
                onClick={() =>
                  void submit(
                    {
                      mode: "integrity_representation",
                      caseId: item.id,
                      representationNote:
                        values[`representation-${item.id}`],
                      representationReference: values[refKey] || null,
                    },
                    `int-representation-${item.id}`,
                  )
                }
              />
            </div>
          ) : null}

          {item.canDecide ? (
            <div className="rounded-2xl border border-slate-200 p-3">
              <p className="text-xs font-black">Reasoned academic decision</p>
              <select
                value={values[outcomeKey] || "inconclusive"}
                onChange={(event) => setValue(outcomeKey, event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                {[
                  "no_breach",
                  "substantiated",
                  "inconclusive",
                  "referred_other_process",
                ].map((value) => (
                  <option key={value} value={value}>
                    {readable(value)}
                  </option>
                ))}
              </select>
              <select
                value={values[actionKey] || "no_change"}
                onChange={(event) => setValue(actionKey, event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                {[
                  "no_change",
                  "hold_result_pending_process",
                  "invalidate_component",
                  "reassessment_required",
                  "correction_required",
                  "release_result",
                  "other",
                ].map((value) => (
                  <option key={value} value={value}>
                    {readable(value)}
                  </option>
                ))}
              </select>
              <textarea
                value={values[noteKey] || ""}
                onChange={(event) => setValue(noteKey, event.target.value)}
                placeholder="Decision rationale"
                rows={2}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
              <input
                value={values[refKey] || ""}
                onChange={(event) => setValue(refKey, event.target.value)}
                placeholder="O10/external process reference if required"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
              <MiniButton
                label="Record decision"
                busy={busyId === `int-decision-${item.id}`}
                onClick={() =>
                  void submit(
                    {
                      mode: "integrity_decision",
                      caseId: item.id,
                      outcome: values[outcomeKey] || "inconclusive",
                      academicAction: values[actionKey] || "no_change",
                      decisionNote: values[noteKey],
                      relatedProcessReference: values[refKey] || null,
                    },
                    `int-decision-${item.id}`,
                  )
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {item.canDecide && ["decision_recorded", "referred"].includes(item.status) ? (
        <button
          type="button"
          onClick={() =>
            void submit(
              { mode: "integrity_action", caseId: item.id, action: "close" },
              `int-close-${item.id}`,
            )
          }
          className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white"
        >
          Close governed case
        </button>
      ) : null}
    </article>
  );
}

function CorrectionRequestPanel({
  workspace,
  values,
  busyId,
  setValue,
  submit,
}: {
  workspace: KhposOpsAcademicAssuranceWorkspace;
  values: Record<string, string>;
  busyId: string | null;
  setValue: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const cycleId = values["corr-cycle"] || workspace.cycles[0]?.id || "";
  const cycle = workspace.cycles.find((item) => item.id === cycleId);
  const streamOptions = workspace.streams.filter(
    (stream) => stream.termId === cycle?.termId,
  );

  return (
    <details className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer text-sm font-black">
        Request official result correction
      </summary>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Enter only the external SIS/CBT result reference and reason. Do not copy
        the original/revised mark into KHP-OS.
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <select
          value={cycleId}
          onChange={(event) => setValue("corr-cycle", event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
        >
          {workspace.cycles.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <select
          value={values["corr-stream"] || streamOptions[0]?.id || ""}
          onChange={(event) => setValue("corr-stream", event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
        >
          {streamOptions.map((stream) => (
            <option key={stream.id} value={stream.id}>
              {stream.classLabel} · {stream.subjectLabel}
            </option>
          ))}
        </select>
        <select
          value={values["corr-type"] || "clerical"}
          onChange={(event) => setValue("corr-type", event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
        >
          {[
            "clerical",
            "transcription",
            "moderation_calculation",
            "identity_mapping",
            "integrity_outcome",
            "other",
          ].map((item) => (
            <option key={item} value={item}>
              {readable(item)}
            </option>
          ))}
        </select>
        <input
          value={values["corr-external"] || ""}
          onChange={(event) => setValue("corr-external", event.target.value)}
          placeholder="SIS/CBT result reference"
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
        />
        <textarea
          value={values["corr-note"] || ""}
          onChange={(event) => setValue("corr-note", event.target.value)}
          placeholder="Why is correction required?"
          rows={2}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs md:col-span-2 xl:col-span-4"
        />
      </div>
      <button
        type="button"
        disabled={busyId === "request-correction"}
        onClick={() =>
          void submit(
            {
              mode: "request_correction",
              cycleId,
              streamId: values["corr-stream"] || streamOptions[0]?.id,
              learnerId: null,
              integrityCaseId: null,
              externalResultReference: values["corr-external"],
              correctionType: values["corr-type"] || "clerical",
              requestNote: values["corr-note"],
            },
            "request-correction",
          )
        }
        className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-60"
      >
        Request correction
      </button>
    </details>
  );
}

function CorrectionCard({
  item,
  values,
  busyId,
  setValue,
  submit,
}: {
  item: KhposOpsResultCorrection;
  values: Record<string, string>;
  busyId: string | null;
  setValue: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const noteKey = `corr-note-${item.id}`;
  const refKey = `corr-ref-${item.id}`;
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-500">{item.reference}</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">
            {readable(item.correctionType)}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.requestNote}</p>
          <p className="mt-1 text-xs text-slate-500">
            External result: {item.externalResultReference}
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-black capitalize ${statusClass(
            item.status,
          )}`}
        >
          {readable(item.status)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <input
          value={values[noteKey] || ""}
          onChange={(event) => setValue(noteKey, event.target.value)}
          placeholder="Decision / implementation note"
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
        />
        <input
          value={values[refKey] || ""}
          onChange={(event) => setValue(refKey, event.target.value)}
          placeholder="SIS/CBT implementation reference"
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {item.canReview && item.status === "requested" ? (
          <>
            <MiniButton
              label="Approve"
              busy={busyId === `corr-approve-${item.id}`}
              onClick={() =>
                void submit(
                  {
                    mode: "correction_action",
                    correctionId: item.id,
                    action: "approve",
                    note: values[noteKey],
                  },
                  `corr-approve-${item.id}`,
                )
              }
            />
            <MiniButton
              label="Reject"
              busy={busyId === `corr-reject-${item.id}`}
              onClick={() =>
                void submit(
                  {
                    mode: "correction_action",
                    correctionId: item.id,
                    action: "reject",
                    note: values[noteKey],
                  },
                  `corr-reject-${item.id}`,
                )
              }
            />
          </>
        ) : null}
        {item.status === "approved" ? (
          <MiniButton
            label="Record external implementation"
            busy={busyId === `corr-implement-${item.id}`}
            onClick={() =>
              void submit(
                {
                  mode: "correction_action",
                  correctionId: item.id,
                  action: "implement",
                  note: values[noteKey],
                  reference: values[refKey],
                },
                `corr-implement-${item.id}`,
              )
            }
          />
        ) : null}
        {item.canVerify && item.status === "implemented" ? (
          <MiniButton
            label="Independently verify"
            busy={busyId === `corr-verify-${item.id}`}
            onClick={() =>
              void submit(
                {
                  mode: "correction_action",
                  correctionId: item.id,
                  action: "verify",
                },
                `corr-verify-${item.id}`,
              )
            }
          />
        ) : null}
      </div>
    </article>
  );
}

function CloseoutCreatePanel({
  workspace,
  values,
  busyId,
  setValue,
  submit,
}: {
  workspace: KhposOpsAcademicAssuranceWorkspace;
  values: Record<string, string>;
  busyId: string | null;
  setValue: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const termId =
    values["close-term"] ||
    workspace.terms.find((term) => term.status === "active")?.id ||
    "";
  return (
    <details className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer text-sm font-black">
        Prepare academic term close-out
      </summary>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <select
          value={termId}
          onChange={(event) => setValue("close-term", event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
        >
          {workspace.terms
            .filter((term) => term.status === "active")
            .map((term) => (
              <option key={term.id} value={term.id}>
                {term.sessionLabel} · {term.termName}
              </option>
            ))}
        </select>
        <input
          value={values["close-evidence"] || ""}
          onChange={(event) => setValue("close-evidence", event.target.value)}
          placeholder="Close-out evidence reference"
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
        />
        {[
          ["close-curriculum", "Curriculum delivery summary"],
          ["close-assessment", "Assessment/exam summary"],
          ["close-support", "Learner-support summary"],
          ["close-integrity", "Integrity/correction summary"],
          ["close-lessons", "Institutional learning / lessons"],
          ["close-external", "External-exam summary (optional)"],
        ].map(([key, placeholder]) => (
          <textarea
            key={key}
            value={values[key] || ""}
            onChange={(event) => setValue(key, event.target.value)}
            placeholder={placeholder}
            rows={2}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
          />
        ))}
        <input
          value={values["close-carryover"] || ""}
          onChange={(event) => setValue("close-carryover", event.target.value)}
          placeholder="Carry-over/escalation reference if anything remains open"
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs md:col-span-2"
        />
      </div>
      <button
        type="button"
        disabled={busyId === "create-closeout"}
        onClick={() =>
          void submit(
            {
              mode: "create_closeout",
              termId,
              curriculumSummary: values["close-curriculum"],
              assessmentSummary: values["close-assessment"],
              learnerSupportSummary: values["close-support"],
              integritySummary: values["close-integrity"],
              externalExamSummary: values["close-external"] || null,
              lessonsSummary: values["close-lessons"],
              carryoverReference: values["close-carryover"] || null,
              evidenceReference: values["close-evidence"] || null,
            },
            "create-closeout",
          )
        }
        className="mt-3 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
      >
        Prepare close-out
      </button>
    </details>
  );
}

function CloseoutCard({
  item,
  values,
  busyId,
  setValue,
  submit,
}: {
  item: KhposOpsAcademicCloseout;
  values: Record<string, string>;
  busyId: string | null;
  setValue: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const noteKey = `closeout-note-${item.id}`;
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-500">{item.reference}</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">
            Academic term close-out
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {item.assessmentSummary}
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-black capitalize ${statusClass(
            item.status,
          )}`}
        >
          {readable(item.status)}
        </span>
      </div>

      <textarea
        value={values[noteKey] || ""}
        onChange={(event) => setValue(noteKey, event.target.value)}
        placeholder="Approval / revision note"
        rows={2}
        className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {item.status === "draft" ? (
          <MiniButton
            label="Submit for School Guardian review"
            busy={busyId === `closeout-submit-${item.id}`}
            onClick={() =>
              void submit(
                { mode: "closeout_action", closeoutId: item.id, action: "submit" },
                `closeout-submit-${item.id}`,
              )
            }
          />
        ) : null}
        {item.canApprove && item.status === "in_review" ? (
          <>
            <MiniButton
              label="Approve"
              busy={busyId === `closeout-approve-${item.id}`}
              onClick={() =>
                void submit(
                  {
                    mode: "closeout_action",
                    closeoutId: item.id,
                    action: "approve",
                    note: values[noteKey],
                  },
                  `closeout-approve-${item.id}`,
                )
              }
            />
            <MiniButton
              label="Return for revision"
              busy={busyId === `closeout-return-${item.id}`}
              onClick={() =>
                void submit(
                  {
                    mode: "closeout_action",
                    closeoutId: item.id,
                    action: "return_to_draft",
                    note: values[noteKey],
                  },
                  `closeout-return-${item.id}`,
                )
              }
            />
          </>
        ) : null}
        {item.canApprove && item.status === "approved" ? (
          <MiniButton
            label="Close academic term"
            busy={busyId === `closeout-close-${item.id}`}
            onClick={() =>
              void submit(
                {
                  mode: "closeout_action",
                  closeoutId: item.id,
                  action: "close_term",
                  note: values[noteKey] || null,
                },
                `closeout-close-${item.id}`,
              )
            }
          />
        ) : null}
      </div>
    </article>
  );
}

function ActionButton({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <BadgeCheck className="size-3.5" />}
      {label}
    </button>
  );
}

function MiniButton({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-black text-slate-800 disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : <ClipboardCheck className="size-3" />}
      {label}
    </button>
  );
}
