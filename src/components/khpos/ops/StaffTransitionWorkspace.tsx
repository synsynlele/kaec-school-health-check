"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  ClipboardCheck,
  DoorOpen,
  GitBranch,
  Loader2,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsExitCase,
  KhposOpsPromotionCase,
  KhposOpsStaffTransitionWorkspace,
  KhposOpsSuccessionPlan,
  KhposOpsTransitionItem,
} from "@/lib/khpos/ops/staff-transition";

function readable(value: string | null | undefined) {
  return (value ?? "—").replaceAll("_", " ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function statusClass(status: string) {
  if (["executed", "achieved", "verified", "closed"].includes(status))
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["approved", "ready_now", "ready_with_support"].includes(status))
    return "border-brand-200 bg-brand-50 text-brand-800";
  if (
    ["awaiting_acceptance", "clearance_in_progress", "external_governance_required"].includes(
      status,
    )
  )
    return "border-amber-200 bg-amber-50 text-amber-900";
  if (["cancelled", "declined", "withdrawn", "archived", "ended"].includes(status))
    return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-violet-200 bg-violet-50 text-violet-800";
}

function targetRoles(
  workspace: KhposOpsStaffTransitionWorkspace,
  staffId: string,
) {
  const staff = workspace.staff.find((item) => item.id === staffId);
  if (!staff) return [];

  const byId = new Map(workspace.roles.map((role) => [role.id, role]));
  const chain: KhposOpsStaffTransitionWorkspace["roles"] = [];
  let next = byId.get(staff.roleId)?.reportsToRoleId ?? null;

  while (next) {
    const role = byId.get(next);
    if (!role) break;
    chain.push(role);
    next = role.reportsToRoleId;
  }

  return chain;
}

export function StaffTransitionWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] =
    useState<KhposOpsStaffTransitionWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const [successionStaffId, setSuccessionStaffId] = useState("");
  const [successionTargetRoleId, setSuccessionTargetRoleId] = useState("");
  const [successionReadiness, setSuccessionReadiness] = useState("developing");
  const [successionSummary, setSuccessionSummary] = useState("");
  const [successionPriorities, setSuccessionPriorities] = useState("");
  const [successionHorizon, setSuccessionHorizon] = useState("");

  const [promotionStaffId, setPromotionStaffId] = useState("");
  const [promotionTargetRoleId, setPromotionTargetRoleId] = useState("");
  const [promotionEffectiveDate, setPromotionEffectiveDate] = useState("");
  const [promotionJustification, setPromotionJustification] = useState("");
  const [promotionReadiness, setPromotionReadiness] = useState("");
  const [promotionSuccessionPlanId, setPromotionSuccessionPlanId] = useState("");

  const [exitStaffId, setExitStaffId] = useState("");
  const [exitType, setExitType] = useState("resignation");
  const [exitLastDay, setExitLastDay] = useState("");
  const [exitBasis, setExitBasis] = useState("");
  const [exitReason, setExitReason] = useState("");
  const [exitAuthorityReference, setExitAuthorityReference] = useState("");
  const [exitSourceAccountabilityCaseId, setExitSourceAccountabilityCaseId] =
    useState("");

  const [selfExitType, setSelfExitType] = useState("resignation");
  const [selfExitLastDay, setSelfExitLastDay] = useState("");
  const [selfExitBasis, setSelfExitBasis] = useState("");
  const [selfExitReason, setSelfExitReason] = useState("");

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [references, setReferences] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [states, setStates] = useState<Record<string, string>>({});
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
        `/api/khpos/ops/staff-transition/${organisationId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        transition?: KhposOpsStaffTransitionWorkspace;
        error?: string;
      };

      if (!active) return;
      if (!response.ok || !body.ok || !body.transition) {
        setError(body.error ?? "Progression & Exit could not be loaded.");
        return;
      }

      const next = body.transition;
      setWorkspace(next);
      const manageable = next.staff.find((staff) => staff.canManage);
      setSuccessionStaffId((current) => current || manageable?.id || "");
      setPromotionStaffId((current) => current || manageable?.id || "");
      setExitStaffId((current) => current || manageable?.id || "");
      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  const successionRoleOptions = useMemo(() => {
    if (!workspace) return [];
    return targetRoles(workspace, successionStaffId);
  }, [workspace, successionStaffId]);

  const promotionRoleOptions = useMemo(() => {
    if (!workspace) return [];
    return targetRoles(workspace, promotionStaffId);
  }, [workspace, promotionStaffId]);

  const effectiveSuccessionTargetRoleId =
    successionRoleOptions.some((role) => role.id === successionTargetRoleId)
      ? successionTargetRoleId
      : successionRoleOptions[0]?.id ?? "";

  const effectivePromotionTargetRoleId =
    promotionRoleOptions.some((role) => role.id === promotionTargetRoleId)
      ? promotionTargetRoleId
      : promotionRoleOptions[0]?.id ?? "";

  async function submit(payload: Record<string, unknown>, busyKey: string) {
    const accessToken = await token();
    if (!accessToken) {
      setError("Your session has ended. Sign in again to continue.");
      return false;
    }

    setBusyId(busyKey);
    setError("");

    const response = await fetch(
      `/api/khpos/ops/staff-transition/${organisationId}`,
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
      transition?: KhposOpsStaffTransitionWorkspace;
      error?: string;
    };

    setBusyId(null);
    if (!response.ok || !body.ok || !body.transition) {
      setError(body.error ?? "Staff-transition operation could not be completed.");
      return false;
    }

    setWorkspace(body.transition);
    return true;
  }

  async function createSuccession() {
    if (
      !successionStaffId ||
      !effectiveSuccessionTargetRoleId ||
      !successionSummary.trim()
    ) {
      setError("Choose staff and target role, then record the readiness summary.");
      return;
    }

    const ok = await submit(
      {
        mode: "create_succession",
        staffId: successionStaffId,
        targetRoleId: effectiveSuccessionTargetRoleId,
        readinessState: successionReadiness,
        readinessSummary: successionSummary.trim(),
        developmentPriorities: successionPriorities.trim() || null,
        targetHorizon: successionHorizon || null,
      },
      "create-succession",
    );

    if (ok) {
      setSuccessionSummary("");
      setSuccessionPriorities("");
      setSuccessionHorizon("");
    }
  }

  async function createPromotion() {
    if (
      !promotionStaffId ||
      !effectivePromotionTargetRoleId ||
      !promotionEffectiveDate ||
      !promotionJustification.trim() ||
      !promotionReadiness.trim()
    ) {
      setError(
        "Promotion requires staff, target role, effective date, justification and readiness summary.",
      );
      return;
    }

    const staff = workspace?.staff.find((item) => item.id === promotionStaffId);
    const ok = await submit(
      {
        mode: "create_promotion",
        staffId: promotionStaffId,
        targetRoleId: effectivePromotionTargetRoleId,
        targetCampusId: staff?.campusId ?? null,
        targetUnitId: staff?.unitId ?? null,
        proposedEffectiveDate: promotionEffectiveDate,
        justification: promotionJustification.trim(),
        readinessSummary: promotionReadiness.trim(),
        sourceSuccessionPlanId: promotionSuccessionPlanId || null,
      },
      "create-promotion",
    );

    if (ok) {
      setPromotionEffectiveDate("");
      setPromotionJustification("");
      setPromotionReadiness("");
      setPromotionSuccessionPlanId("");
    }
  }

  async function createExit(
    staffId: string,
    kind: string,
    lastDay: string,
    basis: string,
    reason: string,
    authorityReference?: string,
    sourceAccountabilityCaseId?: string,
    key = "create-exit",
  ) {
    if (!staffId || !lastDay || !basis.trim()) {
      setError("Exit record requires staff, proposed last day and basis reference.");
      return;
    }

    const ok = await submit(
      {
        mode: "create_exit",
        staffId,
        exitType: kind,
        proposedLastDay: lastDay,
        basisReference: basis.trim(),
        reasonNote: reason.trim() || null,
        authorityReviewReference: authorityReference?.trim() || null,
        sourceAccountabilityCaseId: sourceAccountabilityCaseId?.trim() || null,
        replacementRequired: true,
      },
      key,
    );

    if (ok && key === "create-exit") {
      setExitLastDay("");
      setExitBasis("");
      setExitReason("");
      setExitAuthorityReference("");
      setExitSourceAccountabilityCaseId("");
    }
    if (ok && key === "self-exit") {
      setSelfExitLastDay("");
      setSelfExitBasis("");
      setSelfExitReason("");
    }
  }

  if (!workspace && !error) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-7 animate-spin text-brand-600" />
      </div>
    );
  }

  const self = workspace?.staff.find((staff) => staff.isSelf) ?? null;
  const manageableStaff = workspace?.staff.filter((staff) => staff.canManage) ?? [];
  const activeSuccession =
    workspace?.successionPlans.filter((plan) => plan.status === "active") ?? [];
  const openSelfExit =
    workspace?.exitCases.find(
      (item) => item.isSelf && !["ended", "cancelled", "closed"].includes(item.status),
    ) ?? null;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/khpos/${organisationId}/people`}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="size-3.5" />
            People & Staff
          </Link>
          <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-brand-600">
            Operations · O11
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Progression, Succession & Exit
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Develop future leaders, execute accepted promotions and transfer
            responsibility cleanly when people change role or leave.
          </p>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-xs font-bold text-brand-900">
          PEO-014 · PEO-015 · PEO-P07
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
                label: "Succession plans",
                value: workspace.summary.activeSuccession,
                icon: GitBranch,
              },
              {
                label: "Ready now",
                value: workspace.summary.readyNow,
                icon: UserRoundCheck,
              },
              {
                label: "Open promotions",
                value: workspace.summary.openPromotions,
                icon: ArrowUpRight,
              },
              {
                label: "Open exits",
                value: workspace.summary.openExits,
                icon: DoorOpen,
              },
            ].map(({ label, value, icon: Icon }) => (
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

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                <div>
                  <h2 className="text-sm font-black text-slate-950">
                    Continuity principle
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {workspace.principle}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-amber-700" />
                <div>
                  <h2 className="text-sm font-black text-amber-950">
                    Employment-action boundary
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-amber-900">
                    {workspace.legalBoundary}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {workspace.staff.length === 0 ? (
            <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <UsersRound className="mx-auto size-8 text-slate-400" />
              <h2 className="mt-3 text-lg font-black text-slate-950">
                No deployed staff yet
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                O11 intentionally starts empty. Create, onboard and activate real
                staff in People & Staff before succession, promotion or exit can
                begin.
              </p>
              <Link
                href={`/khpos/${organisationId}/people`}
                className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white"
              >
                Open People & Staff
              </Link>
            </section>
          ) : null}

          {workspace.canManagePeople && manageableStaff.length > 0 ? (
            <section className="grid gap-5 xl:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-600">
                  Succession bench
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-950">
                  Develop the next owner before the vacancy
                </h2>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Succession is a development hypothesis, not a promotion promise.
                </p>
                <div className="mt-4 space-y-3">
                  <select
                    value={successionStaffId}
                    onChange={(event) => setSuccessionStaffId(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    {manageableStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.displayName} · {staff.roleTitle}
                      </option>
                    ))}
                  </select>
                  <select
                    value={effectiveSuccessionTargetRoleId}
                    onChange={(event) =>
                      setSuccessionTargetRoleId(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    {successionRoleOptions.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={successionReadiness}
                    onChange={(event) => setSuccessionReadiness(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="exploring">Exploring</option>
                    <option value="developing">Developing</option>
                    <option value="ready_with_support">Ready with support</option>
                    <option value="ready_now">Ready now</option>
                    <option value="not_ready">Not ready</option>
                  </select>
                  <textarea
                    value={successionSummary}
                    onChange={(event) => setSuccessionSummary(event.target.value)}
                    placeholder="What specific evidence supports this readiness state?"
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <textarea
                    value={successionPriorities}
                    onChange={(event) =>
                      setSuccessionPriorities(event.target.value)
                    }
                    placeholder="Development priorities"
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <input
                    type="date"
                    value={successionHorizon}
                    onChange={(event) => setSuccessionHorizon(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void createSuccession()}
                    disabled={busyId === "create-succession"}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
                  >
                    {busyId === "create-succession" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <GitBranch className="size-4" />
                    )}
                    Add succession plan
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-600">
                  Promotion transition
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-950">
                  Propose greater responsibility
                </h2>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  No score promotes a person. Evidence, acceptance, authority and
                  handover are required.
                </p>
                <div className="mt-4 space-y-3">
                  <select
                    value={promotionStaffId}
                    onChange={(event) => setPromotionStaffId(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    {manageableStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.displayName} · {staff.roleTitle}
                      </option>
                    ))}
                  </select>
                  <select
                    value={effectivePromotionTargetRoleId}
                    onChange={(event) =>
                      setPromotionTargetRoleId(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    {promotionRoleOptions.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={promotionSuccessionPlanId}
                    onChange={(event) =>
                      setPromotionSuccessionPlanId(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="">No linked succession plan</option>
                    {activeSuccession
                      .filter(
                        (plan) =>
                          plan.staffId === promotionStaffId &&
                          plan.targetRoleId === effectivePromotionTargetRoleId,
                      )
                      .map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.reference} · {readable(plan.readinessState)}
                        </option>
                      ))}
                  </select>
                  <input
                    type="date"
                    value={promotionEffectiveDate}
                    onChange={(event) =>
                      setPromotionEffectiveDate(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <textarea
                    value={promotionJustification}
                    onChange={(event) =>
                      setPromotionJustification(event.target.value)
                    }
                    placeholder="Why is this move institutionally needed?"
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <textarea
                    value={promotionReadiness}
                    onChange={(event) => setPromotionReadiness(event.target.value)}
                    placeholder="Why is this person ready for the target role?"
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void createPromotion()}
                    disabled={busyId === "create-promotion"}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
                  >
                    {busyId === "create-promotion" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowUpRight className="size-4" />
                    )}
                    Open promotion case
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-600">
                  Exit & handover
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-950">
                  Record an institutional exit
                </h2>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  KHP-OS records the basis and clearance. It does not invent
                  notice, final-pay or entitlement rules.
                </p>
                <div className="mt-4 space-y-3">
                  <select
                    value={exitStaffId}
                    onChange={(event) => setExitStaffId(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    {manageableStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.displayName} · {staff.roleTitle}
                      </option>
                    ))}
                  </select>
                  <select
                    value={exitType}
                    onChange={(event) => setExitType(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="resignation">Resignation</option>
                    <option value="retirement">Retirement</option>
                    <option value="contract_end">Contract end</option>
                    <option value="mutual_agreement">Mutual agreement</option>
                    <option value="redundancy">Redundancy</option>
                    <option value="termination">Termination</option>
                    <option value="dismissal">Dismissal</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    type="date"
                    value={exitLastDay}
                    onChange={(event) => setExitLastDay(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <input
                    value={exitBasis}
                    onChange={(event) => setExitBasis(event.target.value)}
                    placeholder="Notice / contract / agreement basis reference"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <input
                    value={exitAuthorityReference}
                    onChange={(event) =>
                      setExitAuthorityReference(event.target.value)
                    }
                    placeholder="Authority / legal review reference if required"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <input
                    value={exitSourceAccountabilityCaseId}
                    onChange={(event) =>
                      setExitSourceAccountabilityCaseId(event.target.value)
                    }
                    placeholder="O10 case UUID for dismissal only"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <textarea
                    value={exitReason}
                    onChange={(event) => setExitReason(event.target.value)}
                    placeholder="Context / reason note"
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void createExit(
                        exitStaffId,
                        exitType,
                        exitLastDay,
                        exitBasis,
                        exitReason,
                        exitAuthorityReference,
                        exitSourceAccountabilityCaseId,
                      )
                    }
                    disabled={busyId === "create-exit"}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
                  >
                    {busyId === "create-exit" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <DoorOpen className="size-4" />
                    )}
                    Open exit case
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {self &&
          self.roleCode !== "VISION_CUSTODIAN" &&
          !openSelfExit ? (
            <section className="rounded-3xl border border-orange-200 bg-orange-50 p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-700">
                My exit notice
              </p>
              <h2 className="mt-1 text-lg font-black text-orange-950">
                Submit resignation or retirement notice
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-orange-900">
                This records your notice and proposed last day. It does not
                calculate the legal notice period or final financial entitlement.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <select
                  value={selfExitType}
                  onChange={(event) => setSelfExitType(event.target.value)}
                  className="rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="resignation">Resignation</option>
                  <option value="retirement">Retirement</option>
                </select>
                <input
                  type="date"
                  value={selfExitLastDay}
                  onChange={(event) => setSelfExitLastDay(event.target.value)}
                  className="rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm"
                />
                <input
                  value={selfExitBasis}
                  onChange={(event) => setSelfExitBasis(event.target.value)}
                  placeholder="Notice / contract reference"
                  className="rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm"
                />
                <input
                  value={selfExitReason}
                  onChange={(event) => setSelfExitReason(event.target.value)}
                  placeholder="Optional context"
                  className="rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  void createExit(
                    self.id,
                    selfExitType,
                    selfExitLastDay,
                    selfExitBasis,
                    selfExitReason,
                    undefined,
                    undefined,
                    "self-exit",
                  )
                }
                disabled={busyId === "self-exit"}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-orange-800 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
              >
                {busyId === "self-exit" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <DoorOpen className="size-4" />
                )}
                Submit notice
              </button>
            </section>
          ) : null}

          <section className="space-y-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-600">
                Succession bench
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                Who is being developed for greater responsibility?
              </h2>
            </div>
            {workspace.successionPlans.length === 0 ? (
              <Empty text="No succession plan has been opened." />
            ) : (
              workspace.successionPlans.map((plan) => (
                <SuccessionCard
                  key={plan.id}
                  plan={plan}
                  busyId={busyId}
                  notes={notes}
                  references={references}
                  states={states}
                  onNote={(key, value) =>
                    setNotes((current) => ({ ...current, [key]: value }))
                  }
                  onReference={(key, value) =>
                    setReferences((current) => ({ ...current, [key]: value }))
                  }
                  onState={(key, value) =>
                    setStates((current) => ({ ...current, [key]: value }))
                  }
                  submit={submit}
                />
              ))
            )}
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-600">
                Promotion transitions
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                Evidence → acceptance → authority → handover → role change
              </h2>
            </div>
            {workspace.promotionCases.length === 0 ? (
              <Empty text="No promotion transition has been opened." />
            ) : (
              workspace.promotionCases.map((promotion) => (
                <PromotionCard
                  key={promotion.id}
                  promotion={promotion}
                  workspace={workspace}
                  busyId={busyId}
                  notes={notes}
                  references={references}
                  selects={selects}
                  onNote={(key, value) =>
                    setNotes((current) => ({ ...current, [key]: value }))
                  }
                  onReference={(key, value) =>
                    setReferences((current) => ({ ...current, [key]: value }))
                  }
                  onSelect={(key, value) =>
                    setSelects((current) => ({ ...current, [key]: value }))
                  }
                  submit={submit}
                />
              ))
            )}
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-600">
                Exit & handover
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                No departure without continuity, clearance and access closure
              </h2>
            </div>
            {workspace.exitCases.length === 0 ? (
              <Empty text="No exit case has been opened." />
            ) : (
              workspace.exitCases.map((exitCase) => (
                <ExitCard
                  key={exitCase.id}
                  exitCase={exitCase}
                  workspace={workspace}
                  busyId={busyId}
                  notes={notes}
                  references={references}
                  dates={dates}
                  selects={selects}
                  onNote={(key, value) =>
                    setNotes((current) => ({ ...current, [key]: value }))
                  }
                  onReference={(key, value) =>
                    setReferences((current) => ({ ...current, [key]: value }))
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

function SuccessionCard({
  plan,
  busyId,
  notes,
  references,
  states,
  onNote,
  onReference,
  onState,
  submit,
}: {
  plan: KhposOpsSuccessionPlan;
  busyId: string | null;
  notes: Record<string, string>;
  references: Record<string, string>;
  states: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  onState: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const evidenceTitleKey = `suc-title-${plan.id}`;
  const evidenceNoteKey = `suc-evidence-${plan.id}`;
  const evidenceReferenceKey = `suc-reference-${plan.id}`;
  const readinessKey = `suc-state-${plan.id}`;
  const reviewKey = `suc-review-${plan.id}`;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-500">
              {plan.reference}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-black capitalize ${statusClass(
                plan.readinessState,
              )}`}
            >
              {readable(plan.readinessState)}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-black capitalize ${statusClass(
                plan.status,
              )}`}
            >
              {readable(plan.status)}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-black text-slate-950">
            {plan.staffName}: {plan.currentRoleTitle} → {plan.targetRoleTitle}
          </h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            {plan.readinessSummary}
          </p>
          {plan.developmentPriorities ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Development: {plan.developmentPriorities}
            </p>
          ) : null}
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Target horizon: {formatDate(plan.targetHorizon)}
          </p>
        </div>
        {plan.externalGovernanceRequired ? (
          <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900">
            External governance required
          </span>
        ) : null}
      </div>

      {plan.evidence.length > 0 ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {plan.evidence.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <p className="text-xs font-black text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{item.note}</p>
            </div>
          ))}
        </div>
      ) : null}

      {plan.canManage && plan.status === "active" ? (
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-2xl bg-slate-50 p-3">
            <p className="text-xs font-black text-slate-800">
              Add specific readiness evidence
            </p>
            <input
              value={references[evidenceTitleKey] ?? ""}
              onChange={(event) =>
                onReference(evidenceTitleKey, event.target.value)
              }
              placeholder="Evidence title"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
            />
            <textarea
              value={notes[evidenceNoteKey] ?? ""}
              onChange={(event) => onNote(evidenceNoteKey, event.target.value)}
              placeholder="What happened and what does it show?"
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
            />
            <input
              value={references[evidenceReferenceKey] ?? ""}
              onChange={(event) =>
                onReference(evidenceReferenceKey, event.target.value)
              }
              placeholder="Optional evidence reference"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
            />
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "add_progression_evidence",
                    parentType: "succession",
                    parentId: plan.id,
                    evidenceType: "role_outcome",
                    title: references[evidenceTitleKey] ?? "",
                    note: notes[evidenceNoteKey] ?? "",
                    evidenceReference:
                      references[evidenceReferenceKey] ?? null,
                  },
                  `succession-evidence-${plan.id}`,
                )
              }
              disabled={busyId === `succession-evidence-${plan.id}`}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
            >
              Add evidence
            </button>
          </div>

          <div className="space-y-2 rounded-2xl bg-slate-50 p-3">
            <p className="text-xs font-black text-slate-800">
              Review readiness
            </p>
            <select
              value={states[readinessKey] ?? plan.readinessState}
              onChange={(event) => onState(readinessKey, event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
            >
              <option value="exploring">Exploring</option>
              <option value="developing">Developing</option>
              <option value="ready_with_support">Ready with support</option>
              <option value="ready_now">Ready now</option>
              <option value="not_ready">Not ready</option>
            </select>
            <textarea
              value={notes[reviewKey] ?? ""}
              onChange={(event) => onNote(reviewKey, event.target.value)}
              placeholder="Updated readiness summary / review note"
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "update_succession",
                      planId: plan.id,
                      readinessState:
                        states[readinessKey] ?? plan.readinessState,
                      readinessSummary:
                        notes[reviewKey]?.trim() || plan.readinessSummary,
                      developmentPriorities: plan.developmentPriorities,
                      targetHorizon: plan.targetHorizon,
                      reviewNote: notes[reviewKey] ?? null,
                    },
                    `succession-review-${plan.id}`,
                  )
                }
                disabled={busyId === `succession-review-${plan.id}`}
                className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
              >
                Save review
              </button>
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "succession_action",
                      planId: plan.id,
                      action: "withdraw",
                      note: notes[reviewKey] ?? "",
                    },
                    `succession-withdraw-${plan.id}`,
                  )
                }
                disabled={busyId === `succession-withdraw-${plan.id}`}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-60"
              >
                Withdraw plan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function PromotionCard({
  promotion,
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
  promotion: KhposOpsPromotionCase;
  workspace: KhposOpsStaffTransitionWorkspace;
  busyId: string | null;
  notes: Record<string, string>;
  references: Record<string, string>;
  selects: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  onSelect: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const responseKey = `promotion-response-${promotion.id}`;
  const evidenceTitleKey = `promotion-title-${promotion.id}`;
  const evidenceNoteKey = `promotion-evidence-${promotion.id}`;
  const evidenceReferenceKey = `promotion-reference-${promotion.id}`;
  const continuityKey = `promotion-continuity-${promotion.id}`;
  const supervisorKey = `promotion-supervisor-${promotion.id}`;
  const approvalKey = `promotion-approval-${promotion.id}`;

  const targetRole = workspace.roles.find(
    (role) => role.id === promotion.targetRoleId,
  );
  const supervisorAssignments = workspace.assignments.filter(
    (assignment) => assignment.roleId === targetRole?.reportsToRoleId,
  );
  const staffUserId =
    workspace.staff.find((staff) => staff.id === promotion.staffId)?.userId ??
    null;
  const continuityAssignments = workspace.assignments.filter(
    (assignment) => assignment.userId !== staffUserId,
  );

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-500">
              {promotion.reference}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-black capitalize ${statusClass(
                promotion.status,
              )}`}
            >
              {readable(promotion.status)}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-700">
              Staff: {readable(promotion.staffAcceptanceState)}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-black text-slate-950">
            {promotion.staffName}: {promotion.fromRoleTitle} →{" "}
            {promotion.targetRoleTitle}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {promotion.justification}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Proposed effective date: {formatDate(promotion.proposedEffectiveDate)}
          </p>
        </div>
        {promotion.externalGovernanceRequired ? (
          <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900">
            External governance required
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          Readiness rationale
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {promotion.readinessSummary}
        </p>
      </div>

      {promotion.isSelf &&
      promotion.status === "awaiting_acceptance" &&
      promotion.staffAcceptanceState === "pending" ? (
        <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-black text-brand-950">
            Your acceptance is required
          </p>
          <p className="mt-1 text-xs leading-5 text-brand-900">
            Acceptance means you accept consideration for the target role and
            its governed transition. It does not bypass approval or handover.
          </p>
          <textarea
            value={notes[responseKey] ?? ""}
            onChange={(event) => onNote(responseKey, event.target.value)}
            placeholder="Optional response note"
            rows={2}
            className="mt-3 w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "promotion_response",
                    promotionCaseId: promotion.id,
                    response: "accept",
                    note: notes[responseKey] ?? null,
                  },
                  `promotion-accept-${promotion.id}`,
                )
              }
              className="rounded-xl bg-brand-700 px-4 py-2 text-xs font-black text-white"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "promotion_response",
                    promotionCaseId: promotion.id,
                    response: "decline",
                    note: notes[responseKey] ?? null,
                  },
                  `promotion-decline-${promotion.id}`,
                )
              }
              className="rounded-xl border border-brand-300 px-4 py-2 text-xs font-black text-brand-900"
            >
              Decline
            </button>
          </div>
        </div>
      ) : null}

      {promotion.canManage &&
      ["under_review", "approved"].includes(promotion.status) ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-black text-slate-800">
              Promotion-specific evidence
            </p>
            <input
              value={references[evidenceTitleKey] ?? ""}
              onChange={(event) =>
                onReference(evidenceTitleKey, event.target.value)
              }
              placeholder="Evidence title"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
            />
            <textarea
              value={notes[evidenceNoteKey] ?? ""}
              onChange={(event) => onNote(evidenceNoteKey, event.target.value)}
              placeholder="Specific readiness evidence"
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              value={references[evidenceReferenceKey] ?? ""}
              onChange={(event) =>
                onReference(evidenceReferenceKey, event.target.value)
              }
              placeholder="Optional evidence reference"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
            />
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "add_progression_evidence",
                    parentType: "promotion",
                    parentId: promotion.id,
                    evidenceType: "role_outcome",
                    title: references[evidenceTitleKey] ?? "",
                    note: notes[evidenceNoteKey] ?? "",
                    evidenceReference:
                      references[evidenceReferenceKey] ?? null,
                  },
                  `promotion-evidence-${promotion.id}`,
                )
              }
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white"
            >
              Add evidence
            </button>
          </div>

          {promotion.status === "under_review" &&
          !promotion.externalGovernanceRequired ? (
            <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-black text-slate-800">
                Authority approval + continuity
              </p>
              <select
                value={selects[continuityKey] ?? ""}
                onChange={(event) => onSelect(continuityKey, event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                <option value="">Continuity recipient for old role</option>
                {continuityAssignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.roleTitle} · {assignment.id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <select
                value={selects[supervisorKey] ?? ""}
                onChange={(event) => onSelect(supervisorKey, event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                <option value="">Target-role supervisor</option>
                {supervisorAssignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.roleTitle} · {assignment.id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <textarea
                value={notes[approvalKey] ?? ""}
                onChange={(event) => onNote(approvalKey, event.target.value)}
                placeholder="Reasoned approval note"
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "approve_promotion",
                      promotionCaseId: promotion.id,
                      continuityRecipientAssignmentId:
                        selects[continuityKey] ?? "",
                      targetSupervisorAssignmentId:
                        selects[supervisorKey] ?? "",
                      approvalNote: notes[approvalKey] ?? "",
                    },
                    `promotion-approve-${promotion.id}`,
                  )
                }
                className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-black text-white"
              >
                Approve transition
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {promotion.evidence.length > 0 ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {promotion.evidence.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <p className="text-xs font-black text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{item.note}</p>
            </div>
          ))}
        </div>
      ) : null}

      {promotion.items.length > 0 ? (
        <TransitionItems
          items={promotion.items}
          parentKey={promotion.id}
          busyId={busyId}
          notes={notes}
          references={references}
          onNote={onNote}
          onReference={onReference}
          submit={submit}
        />
      ) : null}

      {promotion.canManage && promotion.status === "approved" ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() =>
              void submit(
                { mode: "execute_promotion", promotionCaseId: promotion.id },
                `promotion-execute-${promotion.id}`,
              )
            }
            disabled={busyId === `promotion-execute-${promotion.id}`}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-60"
          >
            Execute approved promotion
          </button>
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "promotion_action",
                  promotionCaseId: promotion.id,
                  action: "cancel",
                  note:
                    notes[`promotion-cancel-${promotion.id}`] ??
                    "Promotion transition cancelled by competent authority.",
                },
                `promotion-cancel-${promotion.id}`,
              )
            }
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-black text-slate-700"
          >
            Cancel case
          </button>
        </div>
      ) : null}
    </article>
  );
}

function ExitCard({
  exitCase,
  workspace,
  busyId,
  notes,
  references,
  dates,
  selects,
  onNote,
  onReference,
  onDate,
  onSelect,
  submit,
}: {
  exitCase: KhposOpsExitCase;
  workspace: KhposOpsStaffTransitionWorkspace;
  busyId: string | null;
  notes: Record<string, string>;
  references: Record<string, string>;
  dates: Record<string, string>;
  selects: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  onDate: (key: string, value: string) => void;
  onSelect: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  const continuityKey = `exit-continuity-${exitCase.id}`;
  const dateKey = `exit-date-${exitCase.id}`;
  const basisKey = `exit-basis-${exitCase.id}`;
  const authorityKey = `exit-authority-${exitCase.id}`;
  const noteKey = `exit-note-${exitCase.id}`;
  const cancellationReferenceKey = `exit-cancel-ref-${exitCase.id}`;

  const exitingUserId =
    workspace.staff.find((staff) => staff.id === exitCase.staffId)?.userId ?? null;
  const continuityAssignments = workspace.assignments.filter(
    (assignment) => assignment.userId !== exitingUserId,
  );

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-500">
              {exitCase.reference}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-black capitalize ${statusClass(
                exitCase.status,
              )}`}
            >
              {readable(exitCase.status)}
            </span>
            <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-black capitalize text-orange-800">
              {readable(exitCase.exitType)}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-black text-slate-950">
            {exitCase.staffName} · {exitCase.roleTitle}
          </h3>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Recorded last day: {formatDate(exitCase.proposedLastDay)}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Basis: {exitCase.basisReference}
          </p>
          {exitCase.reasonNote ? (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {exitCase.reasonNote}
            </p>
          ) : null}
        </div>
        {exitCase.replacementRequired ? (
          <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">
            Replacement signal active
          </span>
        ) : null}
      </div>

      {exitCase.canManage && exitCase.status === "open" ? (
        <div className="mt-4 grid gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-black text-orange-950">
              Start continuity clearance
            </p>
            <select
              value={selects[continuityKey] ?? ""}
              onChange={(event) => onSelect(continuityKey, event.target.value)}
              className="mt-2 w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs"
            >
              <option value="">Choose continuity recipient</option>
              {continuityAssignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.roleTitle} · {assignment.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "start_exit_clearance",
                    exitCaseId: exitCase.id,
                    continuityRecipientAssignmentId:
                      selects[continuityKey] ?? "",
                  },
                  `exit-start-${exitCase.id}`,
                )
              }
              className="mt-2 rounded-lg bg-orange-800 px-3 py-2 text-xs font-black text-white"
            >
              Acknowledge & start clearance
            </button>
          </div>
          <div>
            <p className="text-xs font-black text-orange-950">
              Revise recorded schedule/basis
            </p>
            <div className="mt-2 space-y-2">
              <input
                type="date"
                value={dates[dateKey] ?? exitCase.proposedLastDay}
                onChange={(event) => onDate(dateKey, event.target.value)}
                className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs"
              />
              <input
                value={references[basisKey] ?? exitCase.basisReference}
                onChange={(event) => onReference(basisKey, event.target.value)}
                className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs"
              />
              <input
                value={
                  references[authorityKey] ??
                  exitCase.authorityReviewReference ??
                  ""
                }
                onChange={(event) =>
                  onReference(authorityKey, event.target.value)
                }
                placeholder="Authority/legal reference if applicable"
                className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={() =>
                  void submit(
                    {
                      mode: "update_exit_schedule",
                      exitCaseId: exitCase.id,
                      proposedLastDay:
                        dates[dateKey] ?? exitCase.proposedLastDay,
                      basisReference:
                        references[basisKey] ?? exitCase.basisReference,
                      authorityReviewReference:
                        references[authorityKey] ??
                        exitCase.authorityReviewReference,
                      note: notes[noteKey] ?? null,
                    },
                    `exit-update-${exitCase.id}`,
                  )
                }
                className="rounded-lg border border-orange-300 bg-white px-3 py-2 text-xs font-black text-orange-900"
              >
                Save revision
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {exitCase.items.length > 0 ? (
        <TransitionItems
          items={exitCase.items}
          parentKey={exitCase.id}
          busyId={busyId}
          notes={notes}
          references={references}
          onNote={onNote}
          onReference={onReference}
          submit={submit}
        />
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {exitCase.canManage && exitCase.status === "clearance_in_progress" ? (
          <button
            type="button"
            onClick={() =>
              void submit(
                { mode: "finalize_exit", exitCaseId: exitCase.id },
                `exit-finalize-${exitCase.id}`,
              )
            }
            disabled={busyId === `exit-finalize-${exitCase.id}`}
            className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-60"
          >
            Finalize exit & close KNS access
          </button>
        ) : null}

        {exitCase.isSelf &&
        exitCase.initiatedByStaff &&
        exitCase.status === "open" ? (
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "exit_action",
                  exitCaseId: exitCase.id,
                  action: "withdraw_request",
                  note:
                    notes[noteKey] ??
                    "Staff withdrew the unacknowledged exit request.",
                },
                `exit-withdraw-${exitCase.id}`,
              )
            }
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-black text-slate-700"
          >
            Withdraw my request
          </button>
        ) : null}

        {exitCase.canManage &&
        ["open", "clearance_in_progress"].includes(exitCase.status) ? (
          <>
            <input
              value={references[cancellationReferenceKey] ?? ""}
              onChange={(event) =>
                onReference(cancellationReferenceKey, event.target.value)
              }
              placeholder="Cancellation agreement/authority ref"
              className="min-w-56 rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <button
              type="button"
              onClick={() =>
                void submit(
                  {
                    mode: "exit_action",
                    exitCaseId: exitCase.id,
                    action: "cancel",
                    note:
                      notes[noteKey] ??
                      "Exit case cancelled by competent authority.",
                    reference: references[cancellationReferenceKey] ?? "",
                  },
                  `exit-cancel-${exitCase.id}`,
                )
              }
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-black text-slate-700"
            >
              Cancel exit case
            </button>
          </>
        ) : null}

        {exitCase.canManage && exitCase.status === "ended" ? (
          <button
            type="button"
            onClick={() =>
              void submit(
                {
                  mode: "exit_action",
                  exitCaseId: exitCase.id,
                  action: "close",
                },
                `exit-close-${exitCase.id}`,
              )
            }
            className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white"
          >
            Close administrative record
          </button>
        ) : null}
      </div>
    </article>
  );
}

function TransitionItems({
  items,
  parentKey,
  busyId,
  notes,
  references,
  onNote,
  onReference,
  submit,
}: {
  items: KhposOpsTransitionItem[];
  parentKey: string;
  busyId: string | null;
  notes: Record<string, string>;
  references: Record<string, string>;
  onNote: (key: string, value: string) => void;
  onReference: (key: string, value: string) => void;
  submit: (payload: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
  return (
    <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
        Transition controls
      </p>
      {items.map((item) => {
        const noteKey = `item-note-${item.id}`;
        const referenceKey = `item-reference-${item.id}`;
        const busyKey = `item-${parentKey}-${item.id}`;

        return (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-black text-slate-900">{item.title}</p>
                <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-600">
                  {item.description}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                  Due {formatDate(item.dueDate)} ·{" "}
                  {item.mandatory ? "Mandatory" : "Optional"} ·{" "}
                  {readable(item.completionPhase)}
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

            {item.completionPhase === "pre_execute" &&
            item.isOwner &&
            ["pending", "in_progress"].includes(item.status) ? (
              <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <input
                  value={notes[noteKey] ?? ""}
                  onChange={(event) => onNote(noteKey, event.target.value)}
                  placeholder="Completion note"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                />
                <input
                  value={references[referenceKey] ?? ""}
                  onChange={(event) =>
                    onReference(referenceKey, event.target.value)
                  }
                  placeholder="Evidence reference"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={() =>
                    void submit(
                      {
                        mode: "transition_item_action",
                        itemId: item.id,
                        action: "submit_evidence",
                        note: notes[noteKey] ?? "",
                        evidenceReference: references[referenceKey] ?? "",
                      },
                      busyKey,
                    )
                  }
                  disabled={busyId === busyKey}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
                >
                  Submit
                </button>
              </div>
            ) : null}

            {item.canVerify && item.status === "evidence_submitted" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void submit(
                      {
                        mode: "transition_item_action",
                        itemId: item.id,
                        action: "verify",
                      },
                      `${busyKey}-verify`,
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
                        mode: "transition_item_action",
                        itemId: item.id,
                        action: "reopen",
                        note:
                          notes[noteKey] ??
                          "Evidence needs correction before transition completion.",
                      },
                      `${busyKey}-reopen`,
                    )
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700"
                >
                  Reopen
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
