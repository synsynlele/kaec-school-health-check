"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronDown,
  CircleAlert,
  Clock3,
  History,
  KeyRound,
  Loader2,
  Plus,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UsersRound,
  XCircle,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsEmploymentType,
  KhposOpsOnboardingAction,
  KhposOpsPeopleWorkspace,
  KhposOpsStaff,
} from "@/lib/khpos/ops/people";
import type { KhposPartnerSnapshot } from "@/lib/khpos/partnership";

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function statusClasses(status: KhposOpsStaff["status"]) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "ready") return "border-mint-200 bg-mint-50 text-mint-900";
  if (status === "onboarding") return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "exiting") return "border-orange-200 bg-orange-50 text-orange-800";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function onboardingStatusClasses(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-800";
  if (status === "submitted") return "bg-brand-50 text-brand-800";
  if (status === "waived") return "bg-slate-100 text-slate-700";
  return "bg-amber-50 text-amber-900";
}

export function PeopleWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const router = useRouter();
  const [workspace, setWorkspace] = useState<KhposOpsPeopleWorkspace | null>(
    null,
  );
  const [approvedSchools, setApprovedSchools] = useState<KhposPartnerSnapshot[]>([]);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [joinLinks, setJoinLinks] = useState<Record<string, string>>({});

  const [displayName, setDisplayName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [employmentType, setEmploymentType] =
    useState<KhposOpsEmploymentType>("employee");
  const [roleId, setRoleId] = useState("");
  const [campusId, setCampusId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [onboardingDueDate, setOnboardingDueDate] = useState("");
  const [probationReviewDate, setProbationReviewDate] = useState("");

  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [itemEvidence, setItemEvidence] = useState<Record<string, string>>({});

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
        `/api/khpos/ops/people/${organisationId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        people?: KhposOpsPeopleWorkspace;
        error?: string;
      };

      if (!active) return;

      if (!response.ok || !body.ok || !body.people) {
        setError(body.error ?? "People workspace could not be loaded.");
        return;
      }

      const people = body.people;
      setWorkspace(people);
      const defaultRole =
        people.roles.find((role) => role.code === "TEACHER") ??
        people.roles.find((role) => !(["VISION_CUSTODIAN", "SCHOOL_CUSTODIAN"].includes(role.code))) ??
        people.roles[0];
      setRoleId(defaultRole?.id || "");
      setCampusId("");
      setError("");

      // A staff appointment always belongs to one approved school workspace.
      // The school switcher changes the route before any staff data is entered.
      const accountResponse = await fetch("/api/account", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (!active || !accountResponse.ok) return;
      const account = (await accountResponse.json()) as {
        partnerships?: KhposPartnerSnapshot[];
      };
      if (active) {
        setApprovedSchools(
          (account.partnerships ?? []).filter((school) => school.partnerStatus === "active"),
        );
      }
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  const availableUnits = useMemo(() => {
    if (!workspace) return [];
    if (!campusId) return workspace.units.filter((unit) => !unit.campusId);
    return workspace.units.filter(
      (unit) => !unit.campusId || unit.campusId === campusId,
    );
  }, [workspace, campusId]);

  async function submit(payload: Record<string, unknown>, busyKey: string) {
    if (workspace?.organisation.id !== organisationId) return false;
    const accessToken = await token();
    if (!accessToken) {
      setError("Your session has ended. Sign in again to continue.");
      return false;
    }

    setBusyId(busyKey);
    setError("");

    const response = await fetch(
      `/api/khpos/ops/people/${organisationId}`,
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
      people?: KhposOpsPeopleWorkspace;
      error?: string;
    };

    setBusyId(null);

    if (!response.ok || !body.ok || !body.people) {
      setError(body.error ?? "People operation could not be completed.");
      return false;
    }

    setWorkspace(body.people);
    return true;
  }

  async function createStaff() {
    if (
      !displayName.trim() ||
      !accountEmail.trim() ||
      !roleId ||
      !startDate
    ) {
      setError(
        "Staff name, account email, operating role and start date are required.",
      );
      return;
    }

    if (workspace?.roles.find((role) => role.id === roleId)?.code === "SCHOOL_GUARDIAN" && !campusId) {
      setError("Choose the campus this School Guardian will lead.");
      return;
    }

    const ok = await submit(
      {
        mode: "create_staff",
        displayName: displayName.trim(),
        accountEmail: accountEmail.trim().toLowerCase(),
        employmentType,
        roleId,
        campusId: campusId || null,
        unitId: unitId || null,
        startDate,
        onboardingDueDate: onboardingDueDate || null,
        probationReviewDate: probationReviewDate || null,
      },
      "create",
    );

    if (ok) {
      setDisplayName("");
      setAccountEmail("");
      setStartDate("");
      setOnboardingDueDate("");
      setProbationReviewDate("");
      setUnitId("");
      setShowCreate(false);
    }
  }

  async function cancelAppointment(staff: KhposOpsStaff) {
    const reason = window.prompt(`Why is ${staff.displayName}'s appointment being cancelled? This removes the unactivated staff record, closes its joining link and removes their school access.`);
    if (!reason) return;
    if (reason.trim().length < 10) { setError("Please provide a reason of at least 10 characters."); return; }
    if (await submit({ mode: "cancel_appointment", staffId: staff.id, reason: reason.trim() }, `cancel-${staff.id}`)) {
      setJoinLinks((current) => {
        const updated = { ...current };
        delete updated[staff.id];
        return updated;
      });
    }
  }

  async function issueJoinLink(staff: KhposOpsStaff) {
    const accessToken = await token();
    if (!accessToken) { setError("Sign in to continue."); return; }
    setBusyId(`invite-${staff.id}`); setError("");
    try {
      const response = await fetch(`/api/khpos/ops/staff-access/${organisationId}`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ staffId: staff.id }) });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || "Could not create staff link.");
      setJoinLinks((current) => ({ ...current, [staff.id]: `${window.location.origin}/khpos/join/${body.token}` }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create staff link."); }
    finally { setBusyId(null); }
  }

  async function linkAccount(staff: KhposOpsStaff) {
    await submit(
      { mode: "link_account", staffId: staff.id },
      `link-${staff.id}`,
    );
  }

  async function onboardingAction(
    staff: KhposOpsStaff,
    itemId: string,
    action: KhposOpsOnboardingAction,
    evidenceRequired: boolean,
  ) {
    const note = itemNotes[itemId]?.trim() ?? "";
    const evidence = itemEvidence[itemId]?.trim() ?? "";

    if (action === "waive" || action === "reopen") {
      if (!note) {
        setError("Add the required reason before taking this action.");
        return;
      }
    }

    if (
      (action === "submit" || action === "verify") &&
      evidenceRequired &&
      !evidence
    ) {
      const existing = staff.onboarding.find(
        (item) => item.id === itemId,
      )?.evidenceReference;
      if (!existing) {
        setError("This onboarding requirement needs an evidence reference.");
        return;
      }
    }

    const ok = await submit(
      {
        mode: "onboarding_action",
        staffId: staff.id,
        itemId,
        action,
        note: note || null,
        evidenceReference: evidence || null,
      },
      `${action}-${itemId}`,
    );

    if (ok) {
      setItemNotes((current) => ({ ...current, [itemId]: "" }));
      setItemEvidence((current) => ({ ...current, [itemId]: "" }));
    }
  }

  async function activateStaff(staff: KhposOpsStaff) {
    await submit(
      { mode: "activate", staffId: staff.id },
      `activate-${staff.id}`,
    );
  }

  if ((!workspace || workspace.organisation.id !== organisationId) && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-mint-300" />
          <p className="mt-4 text-sm font-semibold text-slate-300">
            Loading people operations…
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
          <h1 className="mt-4 text-2xl font-black">People operations are unavailable</h1>
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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex items-center justify-between gap-4">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-bold text-mint-200">
              People & staff
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
                People & Staff
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
                Appoint and onboard a person before giving them an active school
                role. Their account, training and approvals must be ready first.
              </p>
            </div>

            {workspace.canManagePeople && (
              <button
                type="button"
                onClick={() => setShowCreate((value) => !value)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-mint-300 px-5 py-3 text-sm font-black text-slate-950"
              >
                <UserPlus className="size-4" />
                Add appointed staff
              </button>
            )}
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Staff records", workspace.summary.total],
              ["Onboarding", workspace.summary.onboarding],
              ["Ready", workspace.summary.ready],
              ["Active", workspace.summary.active],
              ["Overdue", workspace.summary.overdueOnboarding],
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

        <section className="rounded-[28px] border border-brand-200 bg-brand-50 p-5 text-brand-950">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-700" />
            <div>
              <p className="text-sm font-black">Minimal personnel data by design</p>
              <p className="mt-1 text-sm leading-6 text-brand-900/80">
                This workspace tracks operational identity, appointment,
                onboarding and deployment readiness. It is not a vault for
                salaries, health information, identity-document images, CVs or
                sensitive safer-recruitment case detail.
              </p>
            </div>
          </div>
        </section>

        {showCreate && workspace.canManagePeople && (
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                  Appointment → onboarding
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Create operational staff record
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  The account email may exist already or may be created later.
                  A login alone never activates the operating role.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500"
                aria-label="Close staff form"
              >
                <XCircle className="size-5" />
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-950">
              <p className="font-bold">School receiving this staff member</p>
              {approvedSchools.length > 1 ? (
                <select
                  aria-label="School receiving this staff member"
                  value={organisationId}
                  onChange={(event) => {
                    if (event.target.value !== organisationId) {
                      setShowCreate(false);
                      router.push(`/khpos/${event.target.value}/people`);
                    }
                  }}
                  className="mt-2 block w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 font-semibold"
                >
                  <option value={organisationId}>{workspace.organisation.name}</option>
                  {approvedSchools.filter((school) => school.organisationId !== organisationId).map((school) => (
                    <option key={school.organisationId} value={school.organisationId}>{school.name}</option>
                  ))}
                </select>
              ) : (
                <p className="mt-2 rounded-xl border border-brand-200 bg-white px-3 py-2.5 font-semibold">{workspace.organisation.name}</p>
              )}
              <p className="mt-2 leading-6 text-brand-900/80">
                Campus choices below belong to this approved school. Other schools appear after KAEC grants access. Each additional campus needs its own KSHC and KAEC approval.
                {approvedSchools.length < 2 && <> <Link href="/account" className="font-bold underline">View school partnerships</Link>.</>}
              </p>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="text-sm font-bold">
                Staff name
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={180}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                />
              </label>

              <label className="text-sm font-bold">
                KHP-OS account email
                <input
                  type="email"
                  value={accountEmail}
                  onChange={(event) => setAccountEmail(event.target.value)}
                  maxLength={320}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                  placeholder="Can be linked later if the account does not exist yet"
                />
              </label>

              <label className="text-sm font-bold">
                Engagement type
                <select
                  value={employmentType}
                  onChange={(event) =>
                    setEmploymentType(
                      event.target.value as KhposOpsEmploymentType,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                >
                  {[
                    "employee",
                    "facilitator",
                    "contractor",
                    "volunteer",
                    "intern",
                    "temporary",
                  ].map((value) => (
                    <option key={value} value={value}>
                      {readable(value)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-bold">
                Intended operating role
                <select
                  value={roleId}
                  onChange={(event) => setRoleId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                >
                  {workspace.roles.filter((role) => !["VISION_CUSTODIAN", "SCHOOL_CUSTODIAN"].includes(role.code)).map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-bold">
                Staff placement
                <select
                  value={campusId}
                  onChange={(event) => {
                    setCampusId(event.target.value);
                    setUnitId("");
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                >
                  <option value="">School-wide / assign campus later</option>
                  {workspace.campuses.map((campus) => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </select>
                <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">
                  School Guardians must lead a selected approved campus. A new campus requires its own KSHC and KAEC approval.
                </span>
              </label>

              <label className="text-sm font-bold">
                Unit / section
                <select
                  value={unitId}
                  onChange={(event) => setUnitId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                >
                  <option value="">Not yet fixed / role-wide</option>
                  {availableUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-bold">
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                />
              </label>

              <label className="text-sm font-bold">
                Onboarding due date
                <input
                  type="date"
                  value={onboardingDueDate}
                  onChange={(event) => setOnboardingDueDate(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Leave blank to use the start date.
                </span>
              </label>

              <label className="text-sm font-bold">
                Probation / review date
                <input
                  type="date"
                  value={probationReviewDate}
                  onChange={(event) => setProbationReviewDate(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-brand-400"
                />
              </label>
            </div>

            <button
              type="button"
              disabled={busyId === "create"}
              onClick={() => void createStaff()}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
            >
              {busyId === "create" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Create & begin onboarding
            </button>
          </section>
        )}

        {workspace.items.length === 0 ? (
          <section className="rounded-[30px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <UsersRound className="mx-auto size-10 text-brand-700" />
            <h2 className="mt-4 text-2xl font-black">
              No staff lifecycle records yet.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Appoint a staff member to begin their account access and
              onboarding for an approved school role.
            </p>
          </section>
        ) : (
          <section className="space-y-5">
            {workspace.items.map((staff) => {
              const blockers = [
                !staff.accountLinked ? "KHP-OS account not linked" : null,
                staff.accountLinked && !staff.accessMembershipActive
                  ? "Active organisation access missing"
                  : null,
                !staff.roleCharterActive ? "Active Role Charter missing" : null,
                staff.mandatoryOutstanding > 0
                  ? `${staff.mandatoryOutstanding} mandatory onboarding item${
                      staff.mandatoryOutstanding === 1 ? "" : "s"
                    } outstanding`
                  : null,
              ].filter(Boolean) as string[];

              const completed = staff.onboarding.filter((item) =>
                ["completed", "waived"].includes(item.status),
              ).length;

              return (
                <article
                  key={staff.id}
                  className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-white">
                          {staff.reference}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-black capitalize ${statusClasses(
                            staff.status,
                          )}`}
                        >
                          {readable(staff.status)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold capitalize text-slate-600">
                          {readable(staff.employmentType)}
                        </span>
                      </div>

                      <h2 className="mt-3 text-2xl font-black">
                        {staff.displayName}
                      </h2>
                      <p className="mt-1 text-sm font-bold text-brand-700">
                        {staff.role.title}
                        {staff.campus?.name ? ` · ${staff.campus.name}` : ""}
                        {staff.unit?.name ? ` · ${staff.unit.name}` : ""}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        {staff.accountEmail}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
                        <span>Starts {formatDate(staff.startDate)}</span>
                        <span>
                          Onboarding due {formatDate(staff.onboardingDueDate)}
                        </span>
                        {staff.probationReviewDate && (
                          <span>
                            Review {formatDate(staff.probationReviewDate)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="min-w-[230px] rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                        Readiness
                      </p>
                      <p className="mt-2 text-2xl font-black">
                        {completed}/{staff.onboarding.length}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        onboarding controls resolved
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      [
                        "Account",
                        staff.accountLinked ? "Linked" : "Not linked",
                        staff.accountLinked,
                      ],
                      [
                        "Organisation access",
                        staff.accessMembershipActive ? "Active" : "Missing",
                        staff.accessMembershipActive,
                      ],
                      [
                        "Role Charter",
                        staff.roleCharterActive ? "Active" : "Missing",
                        staff.roleCharterActive,
                      ],
                      [
                        "Mandatory onboarding",
                        staff.mandatoryOutstanding === 0
                          ? "Complete"
                          : `${staff.mandatoryOutstanding} open`,
                        staff.mandatoryOutstanding === 0,
                      ],
                    ].map(([label, value, good]) => (
                      <div
                        key={String(label)}
                        className={`rounded-2xl border p-4 ${
                          good
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-amber-200 bg-amber-50"
                        }`}
                      >
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                          {label}
                        </p>
                        <p className="mt-1 text-sm font-black">{String(value)}</p>
                      </div>
                    ))}
                  </div>

                  {blockers.length > 0 && staff.status !== "active" && (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-900">
                        Deployment blockers
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {blockers.map((blocker) => (
                          <span
                            key={blocker}
                            className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-900"
                          >
                            {blocker}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {staff.canManage && !staff.accessMembershipActive &&
                    ["onboarding", "ready"].includes(staff.status) &&
                    !["VISION_CUSTODIAN", "SCHOOL_CUSTODIAN"].includes(staff.role.code) && (
                      <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm">
                        <p className="font-bold">Give this person school access</p>
                        <p className="mt-1 text-slate-600">
                          Create a one-use, 7-day link and give it privately to {staff.displayName}.
                          They must sign in with {staff.accountEmail}. This grants organisation
                          access; role activation still requires onboarding.
                        </p>
                        <button
                          type="button"
                          disabled={busyId === `invite-${staff.id}`}
                          onClick={() => void issueJoinLink(staff)}
                          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-50"
                        >
                          {busyId === `invite-${staff.id}` ? "Creating…" : joinLinks[staff.id] ? "Replace joining link" : "Create joining link"}
                        </button>
                        {joinLinks[staff.id] && (
                          <div className="mt-3 space-y-2">
                            <label className="block font-semibold">
                              Private joining link
                              <input
                                readOnly
                                value={joinLinks[staff.id]}
                                onFocus={(event) => event.target.select()}
                                className="mt-1 w-full rounded-lg border border-brand-200 bg-white p-2 font-normal"
                              />
                            </label>
                            <button type="button" onClick={() => void navigator.clipboard.writeText(joinLinks[staff.id])} className="text-sm font-bold underline">Copy link</button>
                            <p className="text-xs text-slate-600">This link appears only now. Replacing it invalidates the previous link.</p>
                          </div>
                        )}
                      </div>
                    )}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {staff.canManage && ["onboarding", "ready"].includes(staff.status) && (
                      <button type="button" disabled={busyId === `cancel-${staff.id}`} onClick={() => void cancelAppointment(staff)} className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-black text-red-800 disabled:opacity-50">
                        <XCircle className="size-3.5" /> Cancel appointment
                      </button>
                    )}
                    {staff.canManage && !staff.accountLinked && (
                      <button
                        type="button"
                        disabled={busyId === `link-${staff.id}`}
                        onClick={() => void linkAccount(staff)}
                        className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-black text-brand-800 disabled:opacity-50"
                      >
                        {busyId === `link-${staff.id}` ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <KeyRound className="size-3.5" />
                        )}
                        Link matching account
                      </button>
                    )}

                    {staff.canManage && staff.status === "ready" && (
                      <button
                        type="button"
                        disabled={busyId === `activate-${staff.id}`}
                        onClick={() => void activateStaff(staff)}
                        className="inline-flex items-center gap-2 rounded-full bg-mint-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                      >
                        {busyId === `activate-${staff.id}` ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <UserCheck className="size-3.5" />
                        )}
                        Activate operating role
                      </button>
                    )}

                    {staff.status === "active" && (
                      <Link
                        href={`/khpos/${organisationId}/team`}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
                      >
                        <BadgeCheck className="size-3.5" />
                        View active role
                      </Link>
                    )}
                    {staff.status === "active" && staff.canManage && (
                      <Link href={`/khpos/${organisationId}/staff-transition`} className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-black text-orange-900">Manage exit & access</Link>
                    )}
                  </div>

                  <details className="mt-6 rounded-2xl border border-slate-200">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-black">
                      <span>
                        Onboarding certification · {completed}/
                        {staff.onboarding.length}
                      </span>
                      <ChevronDown className="size-4 text-slate-500" />
                    </summary>

                    <div className="space-y-3 border-t border-slate-100 p-4">
                      {staff.onboarding.map((item) => {
                        const busy =
                          busyId === `submit-${item.id}` ||
                          busyId === `verify-${item.id}` ||
                          busyId === `waive-${item.id}` ||
                          busyId === `reopen-${item.id}`;
                        const currentEvidence =
                          itemEvidence[item.id] ?? "";

                        return (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-slate-200 p-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] font-black text-slate-500">
                                    {item.code}
                                  </span>
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-[10px] font-black capitalize ${onboardingStatusClasses(
                                      item.status,
                                    )}`}
                                  >
                                    {readable(item.status)}
                                  </span>
                                  {item.evidenceRequired && (
                                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-800">
                                      Evidence required
                                    </span>
                                  )}
                                  {!item.waivable && (
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                                      Non-waivable
                                    </span>
                                  )}
                                </div>
                                <p className="mt-2 text-sm font-black">
                                  {item.title}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-slate-600">
                                  {item.description}
                                </p>
                              </div>
                            </div>

                            {(item.submissionNote ||
                              item.reviewNote ||
                              item.evidenceReference) && (
                              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                                {item.submissionNote && (
                                  <p>
                                    <strong>Submission:</strong>{" "}
                                    {item.submissionNote}
                                  </p>
                                )}
                                {item.reviewNote && (
                                  <p>
                                    <strong>Review:</strong> {item.reviewNote}
                                  </p>
                                )}
                                {item.evidenceReference && (
                                  <p>
                                    <strong>Evidence:</strong>{" "}
                                    {item.evidenceReference}
                                  </p>
                                )}
                              </div>
                            )}

                            {(staff.canSelfSubmit || staff.canReview) &&
                              item.status !== "completed" &&
                              item.status !== "waived" && (
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                  <input
                                    value={itemNotes[item.id] ?? ""}
                                    onChange={(event) =>
                                      setItemNotes((current) => ({
                                        ...current,
                                        [item.id]: event.target.value,
                                      }))
                                    }
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-400"
                                    placeholder="Note / verification context"
                                  />
                                  <input
                                    value={currentEvidence}
                                    onChange={(event) =>
                                      setItemEvidence((current) => ({
                                        ...current,
                                        [item.id]: event.target.value,
                                      }))
                                    }
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-400"
                                    placeholder={
                                      item.evidenceRequired
                                        ? "Evidence reference required"
                                        : "Evidence reference (optional)"
                                    }
                                  />
                                </div>
                              )}

                            <div className="mt-3 flex flex-wrap gap-2">
                              {staff.canSelfSubmit &&
                                ["pending", "submitted"].includes(item.status) && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      void onboardingAction(
                                        staff,
                                        item.id,
                                        "submit",
                                        item.evidenceRequired,
                                      )
                                    }
                                    className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[11px] font-black text-brand-800 disabled:opacity-50"
                                  >
                                    Submit
                                  </button>
                                )}

                              {staff.canReview &&
                                ["pending", "submitted"].includes(item.status) && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      void onboardingAction(
                                        staff,
                                        item.id,
                                        "verify",
                                        item.evidenceRequired,
                                      )
                                    }
                                    className="rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-50"
                                  >
                                    Verify complete
                                  </button>
                                )}

                              {staff.canManage &&
                                item.waivable &&
                                ["pending", "submitted"].includes(item.status) && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      void onboardingAction(
                                        staff,
                                        item.id,
                                        "waive",
                                        false,
                                      )
                                    }
                                    className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-black text-slate-700 disabled:opacity-50"
                                  >
                                    Waive
                                  </button>
                                )}

                              {staff.canReview &&
                                ["completed", "waived"].includes(item.status) && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      void onboardingAction(
                                        staff,
                                        item.id,
                                        "reopen",
                                        false,
                                      )
                                    }
                                    className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-900 disabled:opacity-50"
                                  >
                                    Reopen
                                  </button>
                                )}

                              {busy && (
                                <Loader2 className="mt-1 size-4 animate-spin text-brand-700" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>

                  <details className="mt-4 border-t border-slate-100 pt-4">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black text-slate-700">
                      <History className="size-4" />
                      Staff lifecycle history
                      <ChevronDown className="size-4" />
                    </summary>
                    <div className="mt-4 space-y-3">
                      {staff.history.map((event, index) => (
                        <div
                          key={`${event.createdAt}-${index}`}
                          className="rounded-2xl bg-slate-50 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-black capitalize text-slate-800">
                              {readable(event.eventType)}
                            </p>
                            <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                              <Clock3 className="size-3" />
                              {new Intl.DateTimeFormat(undefined, {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }).format(new Date(event.createdAt))}
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
