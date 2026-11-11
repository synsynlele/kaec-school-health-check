"use client";

import { LoadingScreen } from "@/components/navigation/LoadingScreen";

import { ActionFeedback } from "./ActionFeedback";
import { plainLabel } from "@/lib/khpos/plain-language";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LearningSectionsPanel, LEARNING_SECTIONS_CHANGED } from "@/components/khpos/LearningSectionsPanel";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  GitBranch,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposOpsStructure } from "@/lib/khpos/ops/structure";

function readable(value: string) { return plainLabel(value); }

function ListBlock({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (!items.length) return null;

  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2 text-sm leading-6 text-slate-700">
            <CheckCircle2 className="mt-1 size-3.5 shrink-0 text-mint-700" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OperationsTeamWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [structureRevision, setStructureRevision] = useState(0);
  useEffect(() => {
    const refresh = (event: Event) => { if ((event as CustomEvent<{organisationId:string}>).detail?.organisationId === organisationId) setStructureRevision(value => value + 1); };
    window.addEventListener(LEARNING_SECTIONS_CHANGED, refresh);
    return () => window.removeEventListener(LEARNING_SECTIONS_CHANGED, refresh);
  }, [organisationId]);
  const [structure, setStructure] = useState<KhposOpsStructure | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );

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
        `/api/khpos/ops/structure/${organisationId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        },
      );

      const body = (await response.json()) as {
        ok?: boolean;
        structure?: KhposOpsStructure;
        error?: string;
      };

      if (!active) return;

      if (!response.ok || !body.ok || !body.structure) {
        setError(body.error ?? "Institutional structure could not be loaded.");
        return;
      }

      setStructure(body.structure);
      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase, structureRevision]);

  const [savingTitle, setSavingTitle] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [titleNotice, setTitleNotice] = useState("");

  async function saveRoleTitle(roleId: string, previous: string, title: string) {
    if (savingTitle) return;
    setSavingTitle(true);
    setTitleError("");
    setTitleNotice("");
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) throw new Error("Sign in again to continue.");
      const response = await fetch(`/api/khpos/ops/structure/${organisationId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ roleId, previous, title }),
      });
      const body = await response.json();
      if (!response.ok || !body.structure) throw new Error(body.error ?? "Could not save the title.");
      setStructure(body.structure);
      setTitleNotice("Role title updated.");
    } catch (error) {
      setTitleError(error instanceof Error ? error.message : "Could not save the title.");
    } finally { setSavingTitle(false); }
  }

  if (!structure && !error) {
    return <LoadingScreen />;
  }

  if (!structure) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <ShieldCheck className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">
            Operations structure is not available
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <Link
            href={`/khpos/${organisationId}`}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950"
          >
            <ArrowLeft className="size-4" />
            School overview
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="khpos-hero bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-bold text-mint-200">
              School operations
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold capitalize text-slate-100">
              Your school access: {readable(structure.membershipRole)}
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-mint-300">
                Staff roles & reporting lines
              </p>
              <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
                {structure.organisation.name}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
                See each position, who holds it, who they report to and what they are responsible for. Assigning a school position does not automatically give access to school improvement decisions.
              </p>
            </div>

            <Link
              href={`/khpos/${organisationId}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/15"
            >
              <ArrowLeft className="size-4" />
              School overview
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <a href="#campus-structure" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-600">
            <Building2 className="size-6 text-brand-700" />
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Campuses
            </p>
            <p className="mt-1 text-4xl font-black">{structure.summary.campusCount}</p>
          </a>
          <a href="#campus-structure" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-600">
            <GitBranch className="size-6 text-brand-700" />
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Units
            </p>
            <p className="mt-1 text-4xl font-black">{structure.summary.unitCount}</p>
          </a>
          <a href="#operating-roles" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-600">
            <UsersRound className="size-6 text-brand-700" />
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Operating roles
            </p>
            <p className="mt-1 text-4xl font-black">{structure.summary.roleCount}</p>
          </a>
          <a href="#operating-roles" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-600">
            <UserRoundCheck className="size-6 text-mint-700" />
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Assigned roles
            </p>
            <p className="mt-1 text-4xl font-black">{structure.summary.assignedRoleCount}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {structure.summary.unassignedRoleCount} role{structure.summary.unassignedRoleCount === 1 ? "" : "s"} awaiting assignment
            </p>
          </a>
        </section>

        {structure.summary.unassignedRoleCount > 0 && (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
            <p className="text-sm font-black text-amber-950">Operating seats still need active people.</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900/80">
              Staff & roles defines the structure; Staff is where a person is appointed, onboarded and activated into that structure.
            </p>
            <Link
              href={`/khpos/${organisationId}/people`}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-xs font-black text-white"
            >
              Open Staff
              <ChevronRight className="size-4" />
            </Link>
          </section>
        )}

        <section id="campus-structure" className="scroll-mt-24 rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                Campus structure
              </p>
              <h2 className="mt-2 text-2xl font-black">Schools, campuses and sections</h2>
            </div>
            <Building2 className="size-7 text-brand-700" />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {structure.campuses.map((campus) => {
              const units = structure.units.filter((unit) => unit.campusId === campus.id);
              return (
                <div key={campus.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black">{campus.name}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                        {campus.code} · {readable(campus.status)}
                      </p>
                    </div>
                    <span className="rounded-full bg-mint-50 px-3 py-1 text-xs font-black text-mint-800">
                      {units.length} unit{units.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {units.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {units.map((unit) => (
                        <span
                          key={unit.id}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700"
                        >
                          {unit.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-sm leading-6 text-slate-600">Each additional campus needs its own school health check and KAEC partnership approval before it receives a KHP-OS workspace. The School Custodian is the school owner who holds its vision and appoints its School Guardian; this is a leadership seat, not a facilities role. <Link href="/assessment" className="font-bold text-brand-700 underline">Start a campus health check</Link>.</p>
        </section>

        <LearningSectionsPanel organisationId={organisationId} />

        <section id="operating-roles" className="scroll-mt-24">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
              Operating hierarchy
            </p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
              Every seat has a mission, authority and reporting line.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              These are school positions and reporting lines. Access to school improvement decisions is managed separately.
            </p>
          </div>

          <ActionFeedback busy={savingTitle} error={titleError} notice={titleNotice}
            onDismiss={() => { setTitleError(""); setTitleNotice(""); }} />
          <div className="mt-6 space-y-4">
            {structure.roles.map((role) => (
              <details
                key={role.id}
                className="group rounded-[28px] border border-slate-200 bg-white shadow-sm open:shadow-md"
              >
                <summary className="cursor-pointer list-none p-6 sm:p-7">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-4">
                      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-sm font-black text-brand-700">
                        {role.level}
                      </span>
                      <div>
                        <p className="text-xl font-black">{role.title}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          {role.reportsToTitle
                            ? `Reports to ${role.reportsToTitle}`
                            : "Institutional strategic authority"}
                        </p>
                        {role.charter?.mission && (
                          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                            {role.charter.mission}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-black ${
                          role.assignments.length
                            ? "bg-mint-50 text-mint-800"
                            : "bg-amber-50 text-amber-800"
                        }`}
                      >
                        {role.assignments.length
                          ? `${role.assignments.length} assigned`
                          : "Unassigned"}
                      </span>
                      <ChevronRight className="size-5 text-slate-400 transition group-open:rotate-90" />
                    </div>
                  </div>
                </summary>

                <div className="border-t border-slate-100 px-6 pb-7 pt-6 sm:px-7">
                  {structure.canRenameRoles && role.status === "active" && (
                    <form key={role.title} className="mb-6 space-y-2" onSubmit={event => {
                      event.preventDefault();
                      const title = String(new FormData(event.currentTarget).get("title") ?? "");
                      void saveRoleTitle(role.id, role.title, title);
                    }}>
                      <label className="grid gap-1 text-sm font-bold">
                        Role title used by your school
                        <input name="title" defaultValue={role.title} required maxLength={80}
                          className="max-w-sm rounded-xl border border-slate-300 px-3 py-2" />
                      </label>
                      <p className="text-sm text-slate-600">This changes the title staff see. The role keeps its responsibilities and permissions.</p>
                      <button type="submit" disabled={savingTitle} className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save role title</button>
                    </form>
                  )}
                  {role.assignments.length > 0 && (
                    <div className="mb-6">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Current assignment
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {role.assignments.map((assignment) => (
                          <span
                            key={assignment.id}
                            className="rounded-full border border-mint-200 bg-mint-50 px-3 py-1.5 text-sm font-bold text-mint-900"
                          >
                            {assignment.displayName}
                            {assignment.campusName ? ` · ${assignment.campusName}` : ""}
                            {assignment.unitName ? ` · ${assignment.unitName}` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {role.charter ? (
                    <div className="grid gap-7 lg:grid-cols-2">
                      <ListBlock title="Expected results" items={role.charter.ownedOutcomes} />
                      <ListBlock title="Responsibilities" items={role.charter.responsibilities} />
                      <ListBlock title="Decisions this role can make" items={role.charter.decisionRights} />
                      <ListBlock title="When to ask for help" items={role.charter.escalationRules} />
                      <ListBlock title="Role Measures" items={role.charter.kpis} />
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-slate-600">
                      This position has been added, but its responsibilities have not yet been approved and published.
                    </p>
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
