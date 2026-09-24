"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  ClipboardList,
  Loader2,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsCandidateApplication,
  KhposOpsRecruitmentVacancy,
  KhposOpsRecruitmentWorkspace,
  KhposOpsWorkforceRequest,
} from "@/lib/khpos/ops/recruitment";

function readable(value: string | null | undefined) {
  return (value ?? "—").replaceAll("_", " ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(\`\${value}T00:00:00\`),
  );
}

function statusClass(status: string) {
  if (["filled", "appointed", "cleared", "verified"].includes(status))
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["open", "interview", "conditional_selection"].includes(status))
    return "border-brand-200 bg-brand-50 text-brand-800";
  if (["submitted", "screening", "clearance", "needs_review", "on_hold"].includes(status))
    return "border-amber-200 bg-amber-50 text-amber-900";
  if (["declined", "withdrawn", "closed", "cancelled", "not_clear"].includes(status))
    return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-violet-200 bg-violet-50 text-violet-800";
}

export function RecruitmentWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] =
    useState<KhposOpsRecruitmentWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const [roleId, setRoleId] = useState("");
  const [campusId, setCampusId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [employmentType, setEmploymentType] = useState("employee");
  const [needType, setNeedType] = useState("replacement");
  const [rationale, setRationale] = useState("");
  const [alternatives, setAlternatives] = useState("");
  const [desiredStartDate, setDesiredStartDate] = useState("");
  const [budgetReference, setBudgetReference] = useState("");

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
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
        \`/api/khpos/ops/recruitment/\${organisationId}\`,
        {
          headers: { Authorization: \`Bearer \${accessToken}\` },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        recruitment?: KhposOpsRecruitmentWorkspace;
        error?: string;
      };

      if (!active) return;
      if (!response.ok || !body.ok || !body.recruitment) {
        setError(body.error ?? "Recruitment could not be loaded.");
        return;
      }

      setWorkspace(body.recruitment);
      setRoleId((current) => current || body.recruitment?.roles.at(-1)?.id || "");
      setCampusId((current) => current || body.recruitment?.campuses[0]?.id || "");
      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  const availableUnits = useMemo(() => {
    if (!workspace) return [];
    return workspace.units.filter(
      (unit) => !campusId || !unit.campusId || unit.campusId === campusId,
    );
  }, [workspace, campusId]);

  useEffect(() => {
    if (!availableUnits.some((unit) => unit.id === unitId)) {
      setUnitId("");
    }
  }, [availableUnits, unitId]);

  async function submit(payload: Record<string, unknown>, key: string) {
    const accessToken = await token();
    if (!accessToken) {
      setError("Your session has ended. Sign in again to continue.");
      return false;
    }

    setBusyId(key);
    setError("");

    const response = await fetch(
      \`/api/khpos/ops/recruitment/\${organisationId}\`,
      {
        method: "POST",
        headers: {
          Authorization: \`Bearer \${accessToken}\`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const body = (await response.json()) as {
      ok?: boolean;
      recruitment?: KhposOpsRecruitmentWorkspace;
      error?: string;
    };

    setBusyId(null);
    if (!response.ok || !body.ok || !body.recruitment) {
      setError(body.error ?? "Recruitment operation could not be completed.");
      return false;
    }

    setWorkspace(body.recruitment);
    return true;
  }

  async function createWorkforce() {
    const ok = await submit(
      {
        mode: "create_workforce",
        roleId,
        campusId: campusId || null,
        unitId: unitId || null,
        employmentType,
        needType,
        rationale,
        alternativesConsidered: alternatives || null,
        desiredStartDate,
        budgetReference: budgetReference || null,
      },
      "create-workforce",
    );

    if (ok) {
      setRationale("");
      setAlternatives("");
      setDesiredStartDate("");
      setBudgetReference("");
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={\`/khpos/\${organisationId}/people\`}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="size-3.5" />
            People & Staff
          </Link>
          <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-brand-600">
            Operations · O13
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Workforce & Recruitment
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Approved need → governed vacancy → evidence-based selection →
            conditional selection → safer recruitment → O7 appointment.
          </p>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-xs font-black text-brand-900">
          PEO-001–004 · PEO-P01
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
              ["Open needs", workspace.summary.openRequests, ClipboardList],
              ["Open vacancies", workspace.summary.openVacancies, BriefcaseBusiness],
              ["Active candidates", workspace.summary.activeApplications, UsersRound],
              ["In clearance", workspace.summary.clearancePending, ShieldCheck],
            ].map(([label, value, Icon]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    {String(label)}
                  </p>
                  <Icon className="size-4 text-slate-400" />
                </div>
                <p className="mt-3 text-2xl font-black text-slate-950">
                  {String(value)}
                </p>
              </div>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-black text-emerald-950">
                Recruitment principle
              </p>
              <p className="mt-1 text-sm leading-6 text-emerald-900">
                {workspace.principle}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-black text-amber-950">
                Candidate-data boundary
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                {workspace.privacyBoundary}
              </p>
            </div>
          </section>

          {!workspace.canManageRecruitment && workspace.canEvaluateCandidates ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-900">
              You are in <strong>functional evaluator</strong> mode. You can add
              evidence for candidates in your reporting scope, but you cannot
              approve workforce needs, advance candidates, decide safeguarding
              clearance or appoint.
            </div>
          ) : null}

          {workspace.canManageRecruitment ? (
            <>
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-600">
                  Workforce planning
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-950">
                  Open a staffing need only after alternatives are considered
                </h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <select
                    value={roleId}
                    onChange={(event) => setRoleId(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="">Choose role</option>
                    {workspace.roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={campusId}
                    onChange={(event) => setCampusId(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="">No campus / organisation-wide</option>
                    {workspace.campuses.map((campus) => (
                      <option key={campus.id} value={campus.id}>
                        {campus.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={unitId}
                    onChange={(event) => setUnitId(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="">No unit</option>
                    {availableUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={employmentType}
                    onChange={(event) => setEmploymentType(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    {["employee", "facilitator", "contractor", "volunteer", "intern", "temporary"].map(
                      (item) => (
                        <option key={item} value={item}>
                          {readable(item)}
                        </option>
                      ),
                    )}
                  </select>
                  <select
                    value={needType}
                    onChange={(event) => setNeedType(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    {["replacement", "expansion", "workload", "specialist", "temporary_cover", "other"].map(
                      (item) => (
                        <option key={item} value={item}>
                          {readable(item)}
                        </option>
                      ),
                    )}
                  </select>
                  <input
                    type="date"
                    value={desiredStartDate}
                    onChange={(event) => setDesiredStartDate(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <input
                    value={budgetReference}
                    onChange={(event) => setBudgetReference(event.target.value)}
                    placeholder="Budget/authority reference (if applicable)"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:col-span-2"
                  />
                  <textarea
                    value={rationale}
                    onChange={(event) => setRationale(event.target.value)}
                    placeholder="What institutional outcome/work needs an owner?"
                    rows={3}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:col-span-2"
                  />
                  <textarea
                    value={alternatives}
                    onChange={(event) => setAlternatives(event.target.value)}
                    placeholder="What alternatives were considered before adding headcount?"
                    rows={3}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:col-span-2"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void createWorkforce()}
                  disabled={busyId === "create-workforce"}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
                >
                  {busyId === "create-workforce" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  Submit workforce request
                </button>
              </section>

              <section className="space-y-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-600">
                    Workforce requests
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    Need must be approved before recruitment opens
                  </h2>
                </div>
                {workspace.workforceRequests.length === 0 ? (
                  <Empty text="No workforce request has been created." />
                ) : (
                  workspace.workforceRequests.map((request) => (
                    <WorkforceCard
                      key={request.id}
                      request={request}
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

              <section className="space-y-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-600">
                    Vacancies
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    Role Charter + complete brief before publication
                  </h2>
                </div>
                {workspace.vacancies.length === 0 ? (
                  <Empty text="No vacancy has been created from an approved need." />
                ) : (
                  workspace.vacancies.map((vacancy) => (
                    <VacancyCard
                      key={vacancy.id}
                      vacancy={vacancy}
                      busyId={busyId}
                      notes={notes}
                      values={values}
                      dates={dates}
                      onNote={(key, value) =>
                        setNotes((current) => ({ ...current, [key]: value }))
                      }
                      onValue={(key, value) =>
                        setValues((current) => ({ ...current, [key]: value }))
                      }
                      onDate={(key, value) =>
                        setDates((current) => ({ ...current, [key]: value }))
                      }
                      submit={submit}
                    />
                  ))
                )}
              </section>
            </>
          ) : null}

          <section className="space-y-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-600">
                Candidate selection
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                Evidence → conditional selection → clearance → appointment
              </h2>
            </div>
            {workspace.applications.length === 0 ? (
              <Empty text="No candidate application is visible in your scope." />
            ) : (
              workspace.applications.map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  canManage={workspace.canManageRecruitment}
                  canEvaluate={workspace.canEvaluateCandidates}
                  busyId={busyId}
                  notes={notes}
                  values={values}
                  dates={dates}
                  selects={selects}
                  onNote={(key, value) =>
                    setNotes((current) => ({ ...current, [key]: value }))
                  }
                  onValue={(key, value) =>
                    setValues((current) => ({ ...current, [key]: value }))
                  }
                  onDate={(key, value) =>
                    setDates((current) => ({ ...current, [key]: value }))
                  }
                  onSelect={(key, value) =>
                    setSelects((current) => ({ ...current, [key]: value }))
                  }
                  submit={submit}
                />
              ))
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-7 text-center text-sm font-semibold text-slate-500">
      {text}
    </div>
  );
}

function WorkforceCard({
  request,
  busyId,
  notes,
  onNote,
  submit,
}: {
  request: KhposOpsWorkforceRequest;
  busyId: string | null;
  notes: Record<string, string>;
  onNote: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const key = \`workforce-\${request.id}\`;
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-500">
              {request.reference}
            </span>
            <span
              className={\`rounded-full border px-2.5 py-1 text-[11px] font-black capitalize \${statusClass(
                request.status,
              )}\`}
            >
              {readable(request.status)}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-black text-slate-950">
            {request.roleTitle} · {readable(request.needType)}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {request.rationale}
          </p>
          {request.alternativesConsidered ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Alternatives considered: {request.alternativesConsidered}
            </p>
          ) : null}
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Desired start: {formatDate(request.desiredStartDate)}
          </p>
        </div>
      </div>

      {request.status === "submitted" ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <textarea
            value={notes[key] ?? ""}
            onChange={(event) => onNote(key, event.target.value)}
            placeholder="Reasoned approval / decline note"
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busyId === \`\${key}-approve\`}
              onClick={() =>
                void submit(
                  {
                    mode: "decide_workforce",
                    requestId: request.id,
                    decision: "approve",
                    note: notes[key] ?? "",
                  },
                  \`\${key}-approve\`,
                )
              }
              className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-60"
            >
              Approve need
            </button>
            <button
              type="button"
              disabled={busyId === \`\${key}-decline\`}
              onClick={() =>
                void submit(
                  {
                    mode: "decide_workforce",
                    requestId: request.id,
                    decision: "decline",
                    note: notes[key] ?? "",
                  },
                  \`\${key}-decline\`,
                )
              }
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-black text-slate-700 disabled:opacity-60"
            >
              Decline
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function VacancyCard({
  vacancy,
  busyId,
  notes,
  values,
  dates,
  onNote,
  onValue,
  onDate,
  submit,
}: {
  vacancy: KhposOpsRecruitmentVacancy;
  busyId: string | null;
  notes: Record<string, string>;
  values: Record<string, string>;
  dates: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onValue: (key: string, value: string) => void;
  onDate: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const prefix = \`vacancy-\${vacancy.id}\`;
  const editable = ["draft", "on_hold"].includes(vacancy.status);

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-500">
              {vacancy.reference}
            </span>
            <span
              className={\`rounded-full border px-2.5 py-1 text-[11px] font-black capitalize \${statusClass(
                vacancy.status,
              )}\`}
            >
              {readable(vacancy.status)}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-black text-slate-950">
            {vacancy.title} · {vacancy.roleTitle}
          </h3>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Closing: {formatDate(vacancy.closingDate)}
          </p>
        </div>
      </div>

      {editable ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={values[\`\${prefix}-title\`] ?? vacancy.title}
            onChange={(event) => onValue(\`\${prefix}-title\`, event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:col-span-2"
          />
          <textarea
            value={values[\`\${prefix}-outcomes\`] ?? vacancy.roleOutcomes}
            onChange={(event) =>
              onValue(\`\${prefix}-outcomes\`, event.target.value)
            }
            rows={3}
            placeholder="Role outcomes"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
          <textarea
            value={
              values[\`\${prefix}-requirements\`] ??
              vacancy.minimumRequirements ??
              ""
            }
            onChange={(event) =>
              onValue(\`\${prefix}-requirements\`, event.target.value)
            }
            rows={3}
            placeholder="Minimum relevant requirements"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
          <textarea
            value={
              values[\`\${prefix}-safeguarding\`] ??
              vacancy.safeguardingStatement
            }
            onChange={(event) =>
              onValue(\`\${prefix}-safeguarding\`, event.target.value)
            }
            rows={2}
            placeholder="Safeguarding statement"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:col-span-2"
          />
          <input
            type="date"
            value={dates[\`\${prefix}-close-date\`] ?? vacancy.closingDate ?? ""}
            onChange={(event) =>
              onDate(\`\${prefix}-close-date\`, event.target.value)
            }
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "update_vacancy",
                  vacancyId: vacancy.id,
                  title: values[\`\${prefix}-title\`] ?? vacancy.title,
                  roleOutcomes:
                    values[\`\${prefix}-outcomes\`] ?? vacancy.roleOutcomes,
                  minimumRequirements:
                    values[\`\${prefix}-requirements\`] ??
                    vacancy.minimumRequirements ??
                    "",
                  safeguardingStatement:
                    values[\`\${prefix}-safeguarding\`] ??
                    vacancy.safeguardingStatement,
                  closingDate:
                    dates[\`\${prefix}-close-date\`] ??
                    vacancy.closingDate ??
                    null,
                },
                \`\${prefix}-save\`,
              )
            }
            disabled={busyId === \`\${prefix}-save\`}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
          >
            Save governed vacancy brief
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <Info label="Role outcomes" value={vacancy.roleOutcomes} />
          <Info
            label="Minimum requirements"
            value={vacancy.minimumRequirements ?? "Not recorded"}
          />
          <Info label="Safeguarding" value={vacancy.safeguardingStatement} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {["draft", "on_hold"].includes(vacancy.status) ? (
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "vacancy_action",
                  vacancyId: vacancy.id,
                  action: "open",
                  closingDate:
                    dates[\`\${prefix}-close-date\`] ??
                    vacancy.closingDate ??
                    null,
                },
                \`\${prefix}-open\`,
              )
            }
            className="rounded-xl bg-brand-700 px-4 py-2 text-xs font-black text-white"
          >
            Open recruitment
          </button>
        ) : null}
        {vacancy.status === "open" ? (
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "vacancy_action",
                  vacancyId: vacancy.id,
                  action: "hold",
                  note:
                    notes[\`\${prefix}-action\`] ??
                    "Vacancy placed on hold pending review.",
                },
                \`\${prefix}-hold\`,
              )
            }
            className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-black text-amber-900"
          >
            Put on hold
          </button>
        ) : null}
        {["open", "on_hold", "draft"].includes(vacancy.status) ? (
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "vacancy_action",
                  vacancyId: vacancy.id,
                  action: "close",
                  note:
                    notes[\`\${prefix}-action\`] ??
                    "Vacancy closed because the staffing need changed.",
                },
                \`\${prefix}-close\`,
              )
            }
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-black text-slate-700"
          >
            Close vacancy
          </button>
        ) : null}
      </div>

      {vacancy.status === "open" ? (
        <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50 p-4">
          <p className="text-xs font-black text-brand-950">Add candidate application</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <input
              value={values[\`\${prefix}-candidate-name\`] ?? ""}
              onChange={(event) =>
                onValue(\`\${prefix}-candidate-name\`, event.target.value)
              }
              placeholder="Candidate full name"
              className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs"
            />
            <input
              value={values[\`\${prefix}-candidate-email\`] ?? ""}
              onChange={(event) =>
                onValue(\`\${prefix}-candidate-email\`, event.target.value)
              }
              placeholder="Candidate email"
              className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs"
            />
            <input
              value={values[\`\${prefix}-candidate-phone\`] ?? ""}
              onChange={(event) =>
                onValue(\`\${prefix}-candidate-phone\`, event.target.value)
              }
              placeholder="Phone (optional)"
              className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs"
            />
            <input
              value={values[\`\${prefix}-candidate-source\`] ?? ""}
              onChange={(event) =>
                onValue(\`\${prefix}-candidate-source\`, event.target.value)
              }
              placeholder="Source"
              className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "add_application",
                  vacancyId: vacancy.id,
                  fullName: values[\`\${prefix}-candidate-name\`] ?? "",
                  email: values[\`\${prefix}-candidate-email\`] ?? "",
                  phone: values[\`\${prefix}-candidate-phone\`] ?? null,
                  source: values[\`\${prefix}-candidate-source\`] ?? null,
                  applicationNote: "Application captured in the governed O13 recruitment pipeline.",
                },
                \`\${prefix}-candidate\`,
              )
            }
            className="mt-3 rounded-lg bg-brand-700 px-3 py-2 text-xs font-black text-white"
          >
            Add candidate
          </button>
        </div>
      ) : null}
    </article>
  );
}

function ApplicationCard({
  application,
  canManage,
  canEvaluate,
  busyId,
  notes,
  values,
  dates,
  selects,
  onNote,
  onValue,
  onDate,
  onSelect,
  submit,
}: {
  application: KhposOpsCandidateApplication;
  canManage: boolean;
  canEvaluate: boolean;
  busyId: string | null;
  notes: Record<string, string>;
  values: Record<string, string>;
  dates: Record<string, string>;
  selects: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onValue: (key: string, value: string) => void;
  onDate: (key: string, value: string) => void;
  onSelect: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const prefix = \`application-\${application.id}\`;
  const evalTypeDefault =
    application.stage === "interview" ? "interview" : "screening";
  const evaluationOpen = !["declined", "withdrawn", "appointed", "cleared"].includes(
    application.stage,
  );

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-500">
              {application.reference}
            </span>
            <span
              className={\`rounded-full border px-2.5 py-1 text-[11px] font-black capitalize \${statusClass(
                application.stage,
              )}\`}
            >
              {readable(application.stage)}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-black text-slate-950">
            {application.candidateName} · {application.roleTitle}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {application.candidateEmail}
            {application.candidatePhone ? \` · \${application.candidatePhone}\` : ""}
            {application.candidateSource ? \` · \${application.candidateSource}\` : ""}
          </p>
        </div>
      </div>

      {application.evaluations.length > 0 ? (
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {application.evaluations.map((evaluation) => (
            <div
              key={evaluation.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black capitalize text-slate-900">
                  {readable(evaluation.evaluationType)}
                </p>
                <span
                  className={\`rounded-full border px-2 py-0.5 text-[10px] font-black capitalize \${statusClass(
                    evaluation.recommendation,
                  )}\`}
                >
                  {readable(evaluation.recommendation)}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Competence: {evaluation.competenceEvidence}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Role fit: {evaluation.roleFitEvidence}
              </p>
              {evaluation.concernOrGap ? (
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  Concern/gap: {evaluation.concernOrGap}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {canEvaluate && evaluationOpen ? (
        <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-xs font-black text-violet-950">
            Add role-relevant evaluation evidence
          </p>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            <select
              value={selects[\`\${prefix}-eval-type\`] ?? evalTypeDefault}
              onChange={(event) =>
                onSelect(\`\${prefix}-eval-type\`, event.target.value)
              }
              className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs"
            >
              <option value="screening">Screening</option>
              <option value="interview">Interview</option>
              <option value="demonstration">Demonstration</option>
              <option value="reference_review">Reference review</option>
              <option value="other">Other</option>
            </select>
            <select
              value={selects[\`\${prefix}-recommendation\`] ?? "progress"}
              onChange={(event) =>
                onSelect(\`\${prefix}-recommendation\`, event.target.value)
              }
              className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs"
            >
              <option value="progress">Progress</option>
              <option value="needs_more_evidence">Needs more evidence</option>
              <option value="do_not_progress">Do not progress</option>
            </select>
            <textarea
              value={notes[\`\${prefix}-competence\`] ?? ""}
              onChange={(event) =>
                onNote(\`\${prefix}-competence\`, event.target.value)
              }
              placeholder="Specific competence evidence"
              rows={2}
              className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs"
            />
            <textarea
              value={notes[\`\${prefix}-fit\`] ?? ""}
              onChange={(event) =>
                onNote(\`\${prefix}-fit\`, event.target.value)
              }
              placeholder="Specific role-fit evidence"
              rows={2}
              className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs"
            />
            <textarea
              value={notes[\`\${prefix}-builder\`] ?? ""}
              onChange={(event) =>
                onNote(\`\${prefix}-builder\`, event.target.value)
              }
              placeholder="Builder philosophy evidence (optional)"
              rows={2}
              className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs"
            />
            <textarea
              value={notes[\`\${prefix}-gap\`] ?? ""}
              onChange={(event) => onNote(\`\${prefix}-gap\`, event.target.value)}
              placeholder="Concern/gap (optional)"
              rows={2}
              className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "add_evaluation",
                  applicationId: application.id,
                  evaluationType:
                    selects[\`\${prefix}-eval-type\`] ?? evalTypeDefault,
                  competenceEvidence: notes[\`\${prefix}-competence\`] ?? "",
                  roleFitEvidence: notes[\`\${prefix}-fit\`] ?? "",
                  builderPhilosophyEvidence:
                    notes[\`\${prefix}-builder\`] ?? null,
                  concernOrGap: notes[\`\${prefix}-gap\`] ?? null,
                  recommendation:
                    selects[\`\${prefix}-recommendation\`] ?? "progress",
                },
                \`\${prefix}-evaluation\`,
              )
            }
            disabled={busyId === \`\${prefix}-evaluation\`}
            className="mt-3 rounded-lg bg-violet-700 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
          >
            Add evaluation
          </button>
        </div>
      ) : null}

      {canManage ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {application.stage === "applied" ? (
            <ActionButton
              label="Start screening"
              onClick={() =>
                submit(
                  {
                    mode: "application_action",
                    applicationId: application.id,
                    action: "start_screening",
                    note: "Screening opened.",
                  },
                  \`\${prefix}-screening\`,
                )
              }
            />
          ) : null}
          {["applied", "screening"].includes(application.stage) ? (
            <ActionButton
              label="Invite interview"
              onClick={() =>
                submit(
                  {
                    mode: "application_action",
                    applicationId: application.id,
                    action: "invite_interview",
                    note: "Screening evidence supports interview progression.",
                  },
                  \`\${prefix}-interview\`,
                )
              }
            />
          ) : null}
          {application.stage === "interview" ? (
            <ActionButton
              label="Conditional selection"
              onClick={() =>
                submit(
                  {
                    mode: "application_action",
                    applicationId: application.id,
                    action: "conditional_select",
                    note:
                      notes[\`\${prefix}-decision\`] ??
                      "Interview/demonstration evidence supports conditional selection.",
                  },
                  \`\${prefix}-conditional\`,
                )
              }
            />
          ) : null}
          {application.stage === "conditional_selection" ? (
            <ActionButton
              label="Start safer clearance"
              onClick={() =>
                submit(
                  {
                    mode: "application_action",
                    applicationId: application.id,
                    action: "start_clearance",
                    note: "Conditional selection moved into safer-recruitment clearance.",
                  },
                  \`\${prefix}-clearance\`,
                )
              }
            />
          ) : null}
          {!["declined", "withdrawn", "appointed"].includes(application.stage) ? (
            <>
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "application_action",
                      applicationId: application.id,
                      action: "decline",
                      note:
                        notes[\`\${prefix}-decision\`] ??
                        "Candidate did not progress based on the recorded role-relevant evidence.",
                    },
                    \`\${prefix}-decline\`,
                  )
                }
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-700"
              >
                Decline
              </button>
              <input
                value={notes[\`\${prefix}-decision\`] ?? ""}
                onChange={(event) =>
                  onNote(\`\${prefix}-decision\`, event.target.value)
                }
                placeholder="Decision note when needed"
                className="min-w-64 rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </>
          ) : null}
        </div>
      ) : null}

      {canManage && application.stage === "clearance" ? (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Safer-recruitment clearance
          </p>
          {application.clearance.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {item.code} · {item.title}
                  </p>
                  <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-600">
                    {item.description}
                  </p>
                </div>
                <span
                  className={\`rounded-full border px-2.5 py-1 text-[10px] font-black capitalize \${statusClass(
                    item.status,
                  )}\`}
                >
                  {readable(item.status)}
                </span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <input
                  value={notes[\`clearance-note-\${item.id}\`] ?? ""}
                  onChange={(event) =>
                    onNote(\`clearance-note-\${item.id}\`, event.target.value)
                  }
                  placeholder="Outcome note"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                />
                <input
                  value={values[\`clearance-ref-\${item.id}\`] ?? ""}
                  onChange={(event) =>
                    onValue(\`clearance-ref-\${item.id}\`, event.target.value)
                  }
                  placeholder="Evidence reference"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                />
                <select
                  value={selects[\`clearance-action-\${item.id}\`] ?? "verify"}
                  onChange={(event) =>
                    onSelect(\`clearance-action-\${item.id}\`, event.target.value)
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                >
                  <option value="verify">Verify</option>
                  <option value="needs_review">Needs review</option>
                  <option value="not_clear">Not clear</option>
                  {item.waivable ? <option value="waive">Waive</option> : null}
                </select>
              </div>
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "clearance_action",
                      itemId: item.id,
                      action:
                        selects[\`clearance-action-\${item.id}\`] ?? "verify",
                      note: notes[\`clearance-note-\${item.id}\`] ?? "",
                      evidenceReference:
                        values[\`clearance-ref-\${item.id}\`] ?? null,
                    },
                    \`clearance-\${item.id}\`,
                  )
                }
                className="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white"
              >
                Record clearance outcome
              </button>
            </div>
          ))}
          <textarea
            value={notes[\`\${prefix}-clearance-final\`] ?? ""}
            onChange={(event) =>
              onNote(\`\${prefix}-clearance-final\`, event.target.value)
            }
            placeholder="Final clearance decision note"
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "complete_clearance",
                  applicationId: application.id,
                  note: notes[\`\${prefix}-clearance-final\`] ?? "",
                },
                \`\${prefix}-complete-clearance\`,
              )
            }
            className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white"
          >
            Complete clearance
          </button>
        </div>
      ) : null}

      {canManage && application.stage === "cleared" ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-black text-emerald-950">
            Cleared for appointment handoff
          </p>
          <p className="mt-1 text-xs leading-5 text-emerald-900">
            Appointment creates an O7 staff record in Onboarding. It does not
            activate the staff member or bypass onboarding/account linkage.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <input
              type="date"
              value={dates[\`\${prefix}-start\`] ?? ""}
              onChange={(event) =>
                onDate(\`\${prefix}-start\`, event.target.value)
              }
              className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs"
            />
            <input
              type="date"
              value={dates[\`\${prefix}-onboarding\`] ?? ""}
              onChange={(event) =>
                onDate(\`\${prefix}-onboarding\`, event.target.value)
              }
              className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs"
            />
            <input
              type="date"
              value={dates[\`\${prefix}-probation\`] ?? ""}
              onChange={(event) =>
                onDate(\`\${prefix}-probation\`, event.target.value)
              }
              className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "appoint_candidate",
                  applicationId: application.id,
                  startDate: dates[\`\${prefix}-start\`] ?? "",
                  onboardingDueDate:
                    dates[\`\${prefix}-onboarding\`] ?? null,
                  probationReviewDate:
                    dates[\`\${prefix}-probation\`] ?? null,
                },
                \`\${prefix}-appoint\`,
              )
            }
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white"
          >
            <BadgeCheck className="size-4" />
            Create O7 appointment record
          </button>
        </div>
      ) : null}
    </article>
  );
}

function ActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => Promise<boolean>;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className="rounded-xl bg-brand-700 px-3 py-2 text-xs font-black text-white"
    >
      {label}
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-700">{value}</p>
    </div>
  );
}
