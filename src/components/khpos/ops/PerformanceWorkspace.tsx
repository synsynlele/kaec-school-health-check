"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Gauge,
  Loader2,
  Plus,
  ShieldAlert,
  Target,
  UsersRound,
  XCircle,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsKpi,
  KhposOpsKpiDirection,
  KhposOpsKpiStatus,
  KhposOpsPerformanceWorkspace,
} from "@/lib/khpos/ops/performance";

const domainOptions = [
  ["learner_progress", "Learner progress"],
  ["human_potential", "Human potential"],
  ["culture_leadership", "Culture & leadership"],
  ["people", "People"],
  ["parent_trust", "Parent trust"],
  ["safety_welfare", "Safety & welfare"],
  ["operations", "Operational excellence"],
  ["finance", "Financial sustainability"],
  ["governance", "Governance"],
  ["other", "Other"],
] as const;

const systemOptions = [
  ["governance_decision", "01 · Governance & Decision"],
  ["people_staff", "02 · People & Staff"],
  ["academic_execution", "03 · Academic Execution"],
  ["learner_progress_intervention", "04 · Learner Progress & Intervention"],
  ["human_potential_development", "05 · Human Potential Development"],
  ["student_culture_leadership", "06 · Student Culture, Behaviour & Leadership"],
  ["safeguarding_welfare_emergency", "07 · Safeguarding, Welfare & Emergency"],
  ["parent_experience_partnership", "08 · Parent Experience & Partnership"],
  ["finance_governance_commercial", "09 · Finance Governance & Commercial Control"],
  ["campus_asset_daily_operations", "10 · Campus, Asset & Daily Operations"],
  ["events_special_programmes", "11 · Events & Special Programmes"],
  ["institutional_performance_accountability", "12 · Institutional Performance & Accountability"],
] as const;

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function statusClasses(status: KhposOpsKpiStatus | null) {
  if (status === "green") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "amber") return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "red") return "border-red-200 bg-red-50 text-red-800";
  if (status === "critical") return "border-red-300 bg-red-100 text-red-950";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function formatValue(value: number, unit: KhposOpsKpi["unit"]) {
  if (unit === "percent") return `${value}%`;
  if (unit === "currency")
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(value);
  if (unit === "boolean") return value === 1 ? "Yes" : "No";
  if (unit === "days") return `${value} days`;
  if (unit === "hours") return `${value} hrs`;
  if (unit === "minutes") return `${value} mins`;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function trendFor(kpi: KhposOpsKpi) {
  if (!kpi.latest || !kpi.previous) return null;
  const delta = kpi.latest.value - kpi.previous.value;
  if (delta === 0) return { label: "No numeric change", icon: ArrowRight };
  return delta > 0
    ? { label: `Up ${Math.abs(delta).toFixed(1)}`, icon: ArrowUp }
    : { label: `Down ${Math.abs(delta).toFixed(1)}`, icon: ArrowDown };
}

function targetLabel(kpi: KhposOpsKpi) {
  if (kpi.direction === "baseline_only") return "Baseline only · no target locked";
  if (kpi.direction === "binary_control")
    return `Success = ${String(kpi.targetConfig.successValue ?? "configured value")}`;
  if (kpi.direction === "higher_is_better")
    return `Green ≥ ${String(kpi.targetConfig.greenMin ?? "—")} · Amber ≥ ${String(kpi.targetConfig.amberMin ?? "—")} · Red ≥ ${String(kpi.targetConfig.redMin ?? "—")}`;
  return `Green ≤ ${String(kpi.targetConfig.greenMax ?? "—")} · Amber ≤ ${String(kpi.targetConfig.amberMax ?? "—")} · Red ≤ ${String(kpi.targetConfig.redMax ?? "—")}`;
}

export function PerformanceWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] = useState<KhposOpsPerformanceWorkspace | null>(
    null,
  );
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("operations");
  const [definition, setDefinition] = useState("");
  const [ownerRoleId, setOwnerRoleId] = useState("");
  const [scopeType, setScopeType] = useState<
    "role" | "team" | "system" | "campus" | "institution"
  >("institution");
  const [scopeRoleId, setScopeRoleId] = useState("");
  const [campusId, setCampusId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [systemCode, setSystemCode] = useState<string>(systemOptions[0][0]);
  const [indicatorType, setIndicatorType] = useState<
    "outcome" | "process" | "risk"
  >("outcome");
  const [unit, setUnit] = useState<KhposOpsKpi["unit"]>("number");
  const [cadence, setCadence] = useState<KhposOpsKpi["cadence"]>("monthly");
  const [sourceType, setSourceType] =
    useState<KhposOpsKpi["sourceType"]>("manual");
  const [sourceKey, setSourceKey] = useState("");
  const [criticalControl, setCriticalControl] = useState(false);

  const [measureValues, setMeasureValues] = useState<Record<string, string>>({});
  const [measureStart, setMeasureStart] = useState<Record<string, string>>({});
  const [measureEnd, setMeasureEnd] = useState<Record<string, string>>({});
  const [measureNotes, setMeasureNotes] = useState<Record<string, string>>({});
  const [measureEvidence, setMeasureEvidence] = useState<Record<string, string>>({});

  const [targetDirection, setTargetDirection] = useState<
    Record<string, KhposOpsKpiDirection>
  >({});
  const [targetA, setTargetA] = useState<Record<string, string>>({});
  const [targetB, setTargetB] = useState<Record<string, string>>({});
  const [targetC, setTargetC] = useState<Record<string, string>>({});
  const [targetNotes, setTargetNotes] = useState<Record<string, string>>({});
  const [retireNotes, setRetireNotes] = useState<Record<string, string>>({});

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
        `/api/khpos/ops/performance/${organisationId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        performance?: KhposOpsPerformanceWorkspace;
        error?: string;
      };

      if (!active) return;
      if (!response.ok || !body.ok || !body.performance) {
        setError(body.error ?? "Performance workspace could not be loaded.");
        return;
      }

      const performance = body.performance;
      setWorkspace(performance);
      setOwnerRoleId((current) => current || performance.roles[0]?.id || "");
      setScopeRoleId((current) => current || performance.roles[0]?.id || "");
      setCampusId((current) => current || performance.campuses[0]?.id || "");
      setUnitId((current) => current || performance.units[0]?.id || "");
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
      `/api/khpos/ops/performance/${organisationId}`,
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
      performance?: KhposOpsPerformanceWorkspace;
      error?: string;
    };

    setBusyId(null);
    if (!response.ok || !body.ok || !body.performance) {
      setError(body.error ?? "Performance operation could not be completed.");
      return false;
    }

    setWorkspace(body.performance);
    return true;
  }

  async function createKpi() {
    if (
      !code.trim() ||
      !name.trim() ||
      !definition.trim() ||
      !ownerRoleId
    ) {
      setError("KPI code, name, definition and owner role are required.");
      return;
    }

    if (scopeType === "role" && !scopeRoleId) {
      setError("Choose the role this scorecard applies to.");
      return;
    }
    if (scopeType === "team" && !unitId) {
      setError("Choose the team/unit this scorecard applies to.");
      return;
    }
    if (scopeType === "campus" && !campusId) {
      setError("Choose the campus this scorecard applies to.");
      return;
    }

    const ok = await submit(
      {
        mode: "create_kpi",
        kpi: {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          domain,
          definition: definition.trim(),
          ownerRoleId,
          scopeType,
          scopeRoleId: scopeType === "role" ? scopeRoleId : null,
          campusId: scopeType === "campus" ? campusId : null,
          unitId: scopeType === "team" ? unitId : null,
          systemCode: scopeType === "system" ? systemCode : null,
          indicatorType,
          unit,
          direction: "baseline_only",
          cadence,
          sourceType,
          sourceKey: sourceKey.trim() || null,
          targetConfig: {},
          criticalControl,
        },
      },
      "create",
    );

    if (ok) {
      setCode("");
      setName("");
      setDefinition("");
      setSourceKey("");
      setCriticalControl(false);
      setShowCreate(false);
    }
  }

  async function recordMeasurement(kpi: KhposOpsKpi) {
    const raw = measureValues[kpi.id];
    const start = measureStart[kpi.id];
    const end = measureEnd[kpi.id];
    const value = Number(raw);

    if (!raw?.trim() || !Number.isFinite(value) || !start || !end) {
      setError("Measurement value, period start and period end are required.");
      return;
    }

    const ok = await submit(
      {
        mode: "record_measurement",
        kpiId: kpi.id,
        periodStart: start,
        periodEnd: end,
        value,
        note: measureNotes[kpi.id]?.trim() || null,
        evidenceReference: measureEvidence[kpi.id]?.trim() || null,
      },
      `measure-${kpi.id}`,
    );

    if (ok) {
      setMeasureValues((current) => ({ ...current, [kpi.id]: "" }));
      setMeasureNotes((current) => ({ ...current, [kpi.id]: "" }));
      setMeasureEvidence((current) => ({ ...current, [kpi.id]: "" }));
    }
  }

  function targetConfigFor(kpi: KhposOpsKpi) {
    const direction = targetDirection[kpi.id] ?? "higher_is_better";
    const a = Number(targetA[kpi.id]);
    const b = Number(targetB[kpi.id]);
    const c = Number(targetC[kpi.id]);

    if (direction === "baseline_only") return {};
    if (direction === "binary_control") {
      if (!Number.isFinite(a)) throw new Error("Enter the numeric success value.");
      return { successValue: a };
    }

    if (![a, b, c].every(Number.isFinite)) {
      throw new Error("Enter all three target thresholds.");
    }

    return direction === "higher_is_better"
      ? { greenMin: a, amberMin: b, redMin: c }
      : { greenMax: a, amberMax: b, redMax: c };
  }

  async function configureTarget(kpi: KhposOpsKpi) {
    try {
      const direction = targetDirection[kpi.id] ?? "higher_is_better";
      if (direction !== "baseline_only" && !targetNotes[kpi.id]?.trim()) {
        throw new Error(
          "Explain the baseline evidence or institutional basis for this target.",
        );
      }
      const targetConfig = targetConfigFor(kpi);
      await submit(
        {
          mode: "configure_target",
          kpiId: kpi.id,
          direction,
          targetConfig,
          note: targetNotes[kpi.id]?.trim() || null,
        },
        `target-${kpi.id}`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Target is invalid.");
    }
  }

  async function retireKpi(kpi: KhposOpsKpi) {
    const note = retireNotes[kpi.id]?.trim();
    if (!note) {
      setError("Add a retirement reason first.");
      return;
    }
    await submit(
      { mode: "retire", kpiId: kpi.id, note },
      `retire-${kpi.id}`,
    );
  }

  if (!workspace && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-mint-300" />
          <p className="mt-4 text-sm font-semibold text-slate-300">
            Loading performance…
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
          <h1 className="mt-4 text-2xl font-black">Performance is unavailable</h1>
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

  const pulse = workspace.operationalPulse;
  const summary = workspace.scorecardSummary;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex items-center justify-between gap-4">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-bold text-mint-200">
              Operations · O6
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
                Performance & Scorecards
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
                See operating reality first, then compare governed KPIs against
                evidence-based targets. KHP-OS never invents a single overall
                school score that can hide a critical failure.
              </p>
            </div>
            {workspace.canGovernKpis && (
              <button
                type="button"
                onClick={() => setShowCreate((value) => !value)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-mint-300 px-5 py-3 text-sm font-black text-slate-950"
              >
                <Plus className="size-4" />
                Define KPI
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                Live operating pulse
              </p>
              <h2 className="mt-2 text-2xl font-black">What is true right now</h2>
            </div>
            <p className="hidden max-w-xl text-right text-xs leading-5 text-slate-500 md:block">
              These are factual counts from Operations, not scored KPIs. They
              require no invented target.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Open work",
                value: pulse.work.open,
                detail: `${pulse.work.overdue} overdue · ${pulse.work.blocked} blocked`,
                icon: Activity,
              },
              {
                label: "Open issues",
                value: pulse.issues.open,
                detail: `${pulse.issues.p1} P1 · ${pulse.issues.p2} P2 · ${pulse.issues.overdue} overdue`,
                icon: AlertTriangle,
              },
              {
                label: "Pending decisions",
                value: pulse.decisions.pending,
                detail: `${pulse.decisions.overdue} overdue`,
                icon: Target,
              },
              {
                label: "Role coverage",
                value: `${pulse.roles.assigned}/${pulse.roles.total}`,
                detail: `${pulse.roles.unassigned} roles currently unassigned`,
                icon: UsersRound,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <Icon className="size-5 text-brand-700" />
                  <p className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-1 text-3xl font-black">{item.value}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {item.detail}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
            Controlled process coverage:{" "}
            <strong className="text-slate-950">
              {pulse.processes.active}/{pulse.processes.total}
            </strong>{" "}
            published · {pulse.processes.notPublished} still registered/not
            published.
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                Governed scorecards
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Never average away a critical control
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                KPI status is shown individually. A strong result elsewhere
                cannot cancel a critical safety, safeguarding or other
                designated control failure.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
              {[
                ["KPIs", summary.activeKpis],
                ["Baseline", summary.unbaselined],
                ["Green", summary.green],
                ["Amber", summary.amber],
                ["Red", summary.red],
                ["Critical", summary.critical],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 text-xl font-black">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {summary.criticalControlsFailing > 0 && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <ShieldAlert className="mt-0.5 size-5 shrink-0" />
              <p>
                <strong>{summary.criticalControlsFailing} critical control(s)</strong>{" "}
                currently show red/critical evidence. They remain visible
                regardless of performance elsewhere.
              </p>
            </div>
          )}
        </section>

        {showCreate && workspace.canGovernKpis && (
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                  KPI governance
                </p>
                <h2 className="mt-2 text-2xl font-black">Define a KPI</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  New KPIs start in baseline mode. Record real evidence first;
                  configure performance thresholds later only when KNS has a
                  defensible basis for them.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500"
                aria-label="Close KPI form"
              >
                <XCircle className="size-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="text-sm font-bold">
                KPI code
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  maxLength={40}
                  placeholder="e.g. ACA-DELIVERY"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal uppercase outline-none focus:border-brand-400"
                />
              </label>

              <label className="text-sm font-bold">
                KPI name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={180}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                />
              </label>

              <label className="text-sm font-bold lg:col-span-2">
                Exact definition
                <textarea
                  value={definition}
                  onChange={(event) => setDefinition(event.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder="Define exactly what is measured so the meaning cannot drift from one review to another."
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                />
              </label>

              <label className="text-sm font-bold">
                Outcome domain
                <select
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                >
                  {domainOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-bold">
                Owner role
                <select
                  value={ownerRoleId}
                  onChange={(event) => setOwnerRoleId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                >
                  {workspace.roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.title}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-bold">
                Scorecard scope
                <select
                  value={scopeType}
                  onChange={(event) =>
                    setScopeType(
                      event.target.value as
                        | "role"
                        | "team"
                        | "system"
                        | "campus"
                        | "institution",
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                >
                  <option value="institution">Institution</option>
                  <option value="campus">Campus</option>
                  <option value="system">Operating system</option>
                  <option value="team">Section / team</option>
                  <option value="role">Role</option>
                </select>
              </label>

              {scopeType === "role" && (
                <label className="text-sm font-bold">
                  Role scope
                  <select
                    value={scopeRoleId}
                    onChange={(event) => setScopeRoleId(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                  >
                    {workspace.roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.title}</option>
                    ))}
                  </select>
                </label>
              )}

              {scopeType === "team" && (
                <label className="text-sm font-bold">
                  Team / unit
                  <select
                    value={unitId}
                    onChange={(event) => setUnitId(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                  >
                    {workspace.units.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
              )}

              {scopeType === "campus" && (
                <label className="text-sm font-bold">
                  Campus
                  <select
                    value={campusId}
                    onChange={(event) => setCampusId(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                  >
                    {workspace.campuses.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
              )}

              {scopeType === "system" && (
                <label className="text-sm font-bold">
                  Operating system
                  <select
                    value={systemCode}
                    onChange={(event) => setSystemCode(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                  >
                    {systemOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              )}

              <label className="text-sm font-bold">
                Indicator type
                <select
                  value={indicatorType}
                  onChange={(event) =>
                    setIndicatorType(
                      event.target.value as "outcome" | "process" | "risk",
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                >
                  <option value="outcome">Outcome</option>
                  <option value="process">Process</option>
                  <option value="risk">Risk</option>
                </select>
              </label>

              <label className="text-sm font-bold">
                Unit
                <select
                  value={unit}
                  onChange={(event) =>
                    setUnit(event.target.value as KhposOpsKpi["unit"])
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                >
                  {["number","percent","currency","days","hours","minutes","boolean","ratio"].map((value) => (
                    <option key={value} value={value}>{readable(value)}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-bold">
                Review cadence
                <select
                  value={cadence}
                  onChange={(event) =>
                    setCadence(event.target.value as KhposOpsKpi["cadence"])
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                >
                  {["weekly","monthly","termly","quarterly","annual","ad_hoc"].map((value) => (
                    <option key={value} value={value}>{readable(value)}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-bold">
                Source
                <select
                  value={sourceType}
                  onChange={(event) =>
                    setSourceType(event.target.value as KhposOpsKpi["sourceType"])
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                >
                  <option value="manual">Manual verified entry</option>
                  <option value="operational_engine">KHP-OS operational engine</option>
                  <option value="third_party">Third-party school software</option>
                  <option value="ksi">KSI</option>
                  <option value="pipupath">PipuPath</option>
                </select>
              </label>

              <label className="text-sm font-bold">
                Source key / reference
                <input
                  value={sourceKey}
                  onChange={(event) => setSourceKey(event.target.value)}
                  placeholder="Optional dataset/report/source identifier"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                />
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold lg:col-span-2">
                <input
                  type="checkbox"
                  checked={criticalControl}
                  onChange={(event) => setCriticalControl(event.target.checked)}
                  className="mt-1 size-4"
                />
                <span>
                  Critical control
                  <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                    Use only when failure must remain visible and must never be
                    averaged away by good performance elsewhere.
                  </span>
                </span>
              </label>
            </div>

            <button
              type="button"
              disabled={busyId === "create"}
              onClick={() => void createKpi()}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
            >
              {busyId === "create" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <BarChart3 className="size-4" />
              )}
              Create baseline KPI
            </button>
          </section>
        )}

        {workspace.items.length === 0 ? (
          <section className="rounded-[30px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Gauge className="mx-auto size-10 text-brand-700" />
            <h2 className="mt-4 text-2xl font-black">No governed KPIs yet.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              That is preferable to invented targets. KHP-OS is already showing
              the factual operating pulse above; School Guardian or Vision
              Custodian can define the first evidence-based scorecards when
              ready.
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            {workspace.items.map((kpi) => {
              const trend = trendFor(kpi);
              const TrendIcon = trend?.icon;
              const targetDirectionValue =
                targetDirection[kpi.id] ?? "higher_is_better";

              return (
                <article
                  key={kpi.id}
                  className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-white">
                          {kpi.code}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold capitalize text-slate-600">
                          {readable(kpi.indicatorType)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold capitalize text-slate-600">
                          {readable(kpi.scopeType)}
                        </span>
                        {kpi.criticalControl && (
                          <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-black text-red-800">
                            Critical control
                          </span>
                        )}
                      </div>

                      <h2 className="mt-3 text-xl font-black">{kpi.name}</h2>
                      <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                        {kpi.definition}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
                        <span>Owner: {kpi.ownerRoleTitle}</span>
                        <span>
                          Scope:{" "}
                          {kpi.scopeRoleTitle ??
                            kpi.unitName ??
                            kpi.campusName ??
                            (kpi.systemCode
                              ? readable(kpi.systemCode)
                              : "Institution")}
                        </span>
                        <span className="capitalize">{readable(kpi.cadence)}</span>
                        <span>v{kpi.version}</span>
                      </div>
                    </div>

                    <div className="min-w-[220px] rounded-2xl bg-slate-50 p-4">
                      {kpi.latest ? (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                                Latest
                              </p>
                              <p className="mt-1 text-3xl font-black">
                                {formatValue(kpi.latest.value, kpi.unit)}
                              </p>
                            </div>
                            <span
                              className={`rounded-full border px-3 py-1 text-[11px] font-black capitalize ${statusClasses(
                                kpi.latest.status,
                              )}`}
                            >
                              {readable(kpi.latest.status)}
                            </span>
                          </div>
                          <p className="mt-2 text-xs font-semibold text-slate-500">
                            {kpi.latest.periodStart} → {kpi.latest.periodEnd}
                          </p>
                          {trend && TrendIcon && (
                            <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-slate-600">
                              <TrendIcon className="size-3.5" />
                              {trend.label}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                            No measurement yet
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            Record the first baseline observation before judging
                            performance.
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                      Target rule
                    </p>
                    <p className="mt-2 text-sm font-bold text-slate-800">
                      {targetLabel(kpi)}
                    </p>
                  </div>

                  {kpi.canRecord && (
                    <details className="mt-5 rounded-2xl border border-slate-200 p-4">
                      <summary className="cursor-pointer text-sm font-black text-slate-800">
                        Record measurement
                      </summary>
                      <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        <label className="text-xs font-black">
                          Value
                          <input
                            type="number"
                            step="any"
                            value={measureValues[kpi.id] ?? ""}
                            onChange={(event) =>
                              setMeasureValues((current) => ({
                                ...current,
                                [kpi.id]: event.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                          />
                        </label>
                        <label className="text-xs font-black">
                          Period start
                          <input
                            type="date"
                            value={measureStart[kpi.id] ?? ""}
                            onChange={(event) =>
                              setMeasureStart((current) => ({
                                ...current,
                                [kpi.id]: event.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                          />
                        </label>
                        <label className="text-xs font-black">
                          Period end
                          <input
                            type="date"
                            value={measureEnd[kpi.id] ?? ""}
                            onChange={(event) =>
                              setMeasureEnd((current) => ({
                                ...current,
                                [kpi.id]: event.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                          />
                        </label>
                        <label className="text-xs font-black lg:col-span-2">
                          Evidence / note
                          <input
                            value={measureNotes[kpi.id] ?? ""}
                            onChange={(event) =>
                              setMeasureNotes((current) => ({
                                ...current,
                                [kpi.id]: event.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                            placeholder="What evidence supports this value?"
                          />
                        </label>
                        <label className="text-xs font-black">
                          Evidence reference
                          <input
                            value={measureEvidence[kpi.id] ?? ""}
                            onChange={(event) =>
                              setMeasureEvidence((current) => ({
                                ...current,
                                [kpi.id]: event.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                            placeholder="Optional report/system reference"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        disabled={busyId === `measure-${kpi.id}`}
                        onClick={() => void recordMeasurement(kpi)}
                        className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                      >
                        {busyId === `measure-${kpi.id}` && (
                          <Loader2 className="size-3.5 animate-spin" />
                        )}
                        Save measurement
                      </button>
                    </details>
                  )}

                  {workspace.canGovernKpis && (
                    <details className="mt-4 rounded-2xl border border-slate-200 p-4">
                      <summary className="cursor-pointer text-sm font-black text-slate-800">
                        Govern KPI target
                      </summary>
                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        Configure thresholds only after baseline evidence makes
                        them defensible. Saving creates a new KPI definition
                        version; earlier measurements stay historically intact.
                      </p>

                      <div className="mt-4 grid gap-3 lg:grid-cols-4">
                        <label className="text-xs font-black">
                          Direction
                          <select
                            value={targetDirectionValue}
                            onChange={(event) =>
                              setTargetDirection((current) => ({
                                ...current,
                                [kpi.id]:
                                  event.target.value as KhposOpsKpiDirection,
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                          >
                            <option value="baseline_only">Baseline only</option>
                            <option value="higher_is_better">Higher is better</option>
                            <option value="lower_is_better">Lower is better</option>
                            <option value="binary_control">Binary control</option>
                          </select>
                        </label>

                        {targetDirectionValue === "binary_control" ? (
                          <label className="text-xs font-black">
                            Success value
                            <input
                              type="number"
                              step="any"
                              value={targetA[kpi.id] ?? ""}
                              onChange={(event) =>
                                setTargetA((current) => ({
                                  ...current,
                                  [kpi.id]: event.target.value,
                                }))
                              }
                              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                            />
                          </label>
                        ) : targetDirectionValue !== "baseline_only" ? (
                          <>
                            <label className="text-xs font-black">
                              Green {targetDirectionValue === "higher_is_better" ? "min" : "max"}
                              <input
                                type="number"
                                step="any"
                                value={targetA[kpi.id] ?? ""}
                                onChange={(event) =>
                                  setTargetA((current) => ({
                                    ...current,
                                    [kpi.id]: event.target.value,
                                  }))
                                }
                                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                              />
                            </label>
                            <label className="text-xs font-black">
                              Amber {targetDirectionValue === "higher_is_better" ? "min" : "max"}
                              <input
                                type="number"
                                step="any"
                                value={targetB[kpi.id] ?? ""}
                                onChange={(event) =>
                                  setTargetB((current) => ({
                                    ...current,
                                    [kpi.id]: event.target.value,
                                  }))
                                }
                                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                              />
                            </label>
                            <label className="text-xs font-black">
                              Red {targetDirectionValue === "higher_is_better" ? "min" : "max"}
                              <input
                                type="number"
                                step="any"
                                value={targetC[kpi.id] ?? ""}
                                onChange={(event) =>
                                  setTargetC((current) => ({
                                    ...current,
                                    [kpi.id]: event.target.value,
                                  }))
                                }
                                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                              />
                            </label>
                          </>
                        ) : null}

                        <label className="text-xs font-black lg:col-span-4">
                          Governance note
                          <input
                            value={targetNotes[kpi.id] ?? ""}
                            onChange={(event) =>
                              setTargetNotes((current) => ({
                                ...current,
                                [kpi.id]: event.target.value,
                              }))
                            }
                            placeholder="Why is this target now defensible?"
                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                          />
                        </label>
                      </div>

                      <button
                        type="button"
                        disabled={busyId === `target-${kpi.id}`}
                        onClick={() => void configureTarget(kpi)}
                        className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                      >
                        {busyId === `target-${kpi.id}` && (
                          <Loader2 className="size-3.5 animate-spin" />
                        )}
                        Save new target version
                      </button>

                      <div className="mt-5 border-t border-slate-100 pt-4">
                        <label className="text-xs font-black text-red-800">
                          Retirement reason
                          <input
                            value={retireNotes[kpi.id] ?? ""}
                            onChange={(event) =>
                              setRetireNotes((current) => ({
                                ...current,
                                [kpi.id]: event.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-red-200 px-3 py-2.5 font-normal text-slate-900 outline-none focus:border-red-400"
                            placeholder="Why should this KPI stop being active?"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={busyId === `retire-${kpi.id}`}
                          onClick={() => void retireKpi(kpi)}
                          className="mt-3 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-black text-red-800 disabled:opacity-50"
                        >
                          Retire KPI
                        </button>
                      </div>
                    </details>
                  )}
                </article>
              );
            })}
          </section>
        )}

        <section className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white sm:p-7">
          <CheckCircle2 className="size-6 text-mint-300" />
          <h2 className="mt-3 text-xl font-black">How O6 feeds leadership</h2>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-300">
            O3 supplies work execution, O4 supplies exceptions, O5 supplies
            decisions, and O6 supplies governed performance evidence. The
            existing weekly School Performance Review and monthly Institutional
            Review can now focus on red/amber trends, critical controls and
            decisions instead of rebuilding reports by hand.
          </p>
        </section>
      </div>
    </main>
  );
}
