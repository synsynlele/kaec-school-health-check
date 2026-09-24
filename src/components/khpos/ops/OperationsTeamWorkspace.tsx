"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  GitBranch,
  Loader2,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposOpsStructure } from "@/lib/khpos/ops/structure";

function readable(value: string) {
  return value.replaceAll("_", " ");
}

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
  }, [organisationId, supabase]);

  if (!structure && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-mint-300" />
          <p className="mt-4 text-sm font-semibold text-slate-300">
            Loading institutional structure…
          </p>
        </div>
      </main>
    );
  }

  if (error || !structure) {
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-bold text-mint-200">
              Operations · O1
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold capitalize text-slate-100">
              Workspace authority: {readable(structure.membershipRole)}
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-mint-300">
                Institutional Structure & Roles
              </p>
              <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
                {structure.organisation.name}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
                Authority, reporting lines and role expectations are defined independently from transformation permissions. The school can scale its operating structure without changing the existing KHP-OS transformation engine.
              </p>
            </div>

            <Link
              href={`/khpos/${organisationId}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/15"
            >
              <ArrowLeft className="size-4" />
              Command Centre
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <Building2 className="size-6 text-brand-700" />
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Campuses
            </p>
            <p className="mt-1 text-4xl font-black">{structure.summary.campusCount}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <GitBranch className="size-6 text-brand-700" />
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Units
            </p>
            <p className="mt-1 text-4xl font-black">{structure.summary.unitCount}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <UsersRound className="size-6 text-brand-700" />
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Operating roles
            </p>
            <p className="mt-1 text-4xl font-black">{structure.summary.roleCount}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <UserRoundCheck className="size-6 text-mint-700" />
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Assigned roles
            </p>
            <p className="mt-1 text-4xl font-black">{structure.summary.assignedRoleCount}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {structure.summary.unassignedRoleCount} role{structure.summary.unassignedRoleCount === 1 ? "" : "s"} awaiting assignment
            </p>
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                Campus structure
              </p>
              <h2 className="mt-2 text-2xl font-black">Where the institution operates</h2>
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
        </section>

        <section>
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
              Operating hierarchy
            </p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
              Every seat has a mission, authority and reporting line.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              These are institutional roles, not KHP-OS transformation permissions. Role assignments can change without rewriting the school operating model.
            </p>
          </div>

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
                      <ListBlock title="Owned outcomes" items={role.charter.ownedOutcomes} />
                      <ListBlock title="Responsibilities" items={role.charter.responsibilities} />
                      <ListBlock title="Decision rights" items={role.charter.decisionRights} />
                      <ListBlock title="Escalation rules" items={role.charter.escalationRules} />
                      <ListBlock title="Role KPIs" items={role.charter.kpis} />
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-slate-600">
                      This operating role is registered, but its active Role Charter has not yet been published.
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
