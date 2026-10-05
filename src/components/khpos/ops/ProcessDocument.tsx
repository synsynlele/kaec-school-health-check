"use client";

import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  ShieldAlert,
  UsersRound,
  Workflow,
} from "lucide-react";
import type { KhposOpsProcess } from "@/lib/khpos/ops/library";

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function ListSection({
  title,
  items,
  ordered = false,
}: {
  title: string;
  items: string[];
  ordered?: boolean;
}) {
  if (!items.length) return null;

  const List = ordered ? "ol" : "ul";
  return (
    <section>
      <h4 className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
        {title}
      </h4>
      <List className={`mt-3 space-y-2 text-sm leading-6 text-slate-700 ${ordered ? "list-decimal pl-5" : ""}`}>
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className={ordered ? "pl-1" : "flex gap-2"}>
            {!ordered && (
              <CheckCircle2 className="mt-1 size-3.5 shrink-0 text-mint-700" />
            )}
            <span>{item}</span>
          </li>
        ))}
      </List>
    </section>
  );
}

export function ProcessDocument({
  process,
  compact = false,
  defaultOpen = false,
  organisationId,
}: {
  process: KhposOpsProcess;
  compact?: boolean;
  defaultOpen?: boolean;
  organisationId?: string;
}) {
  const version = process.activeVersion;

  return (
    <details
      open={defaultOpen}
      className="group rounded-[24px] border border-slate-200 bg-white shadow-sm open:shadow-md"
    >
      <summary className={`cursor-pointer list-none ${compact ? "p-4" : "p-5 sm:p-6"}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-black text-brand-800">
                {process.code}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase text-slate-600">
                {process.criticality}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold capitalize text-slate-600">
                {readable(process.operatingSystem)}
              </span>
            </div>
            <h3 className={`mt-3 font-black text-slate-950 ${compact ? "text-base" : "text-lg sm:text-xl"}`}>
              {process.title}
            </h3>
            <p className="mt-1 text-xs text-slate-500">Owner: {process.ownerLabel}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-black ${
                version
                  ? "bg-mint-50 text-mint-800"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {version ? `Published v${version.version}` : "Registered"}
            </span>
            <span className="text-xs font-black text-brand-700 group-open:hidden">
              View process
            </span>
            <span className="hidden text-xs font-black text-brand-700 group-open:inline">
              Hide process
            </span>
          </div>
        </div>
      </summary>

      <div className={`border-t border-slate-100 ${compact ? "px-4 pb-5 pt-4" : "px-5 pb-7 pt-5 sm:px-6"}`}>
        {!version ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            This process is registered but has no approved published version yet. It must not be treated as the school&apos;s operating procedure until governance is complete.
          </div>
        ) : (
          <article className="space-y-6">
            <header className="rounded-2xl bg-slate-950 p-5 text-white">
              <div className="flex items-center gap-2 text-mint-300">
                <Workflow className="size-4" />
                <p className="text-xs font-black uppercase tracking-[0.16em]">
                  Controlled Operating Process
                </p>
              </div>
              <h3 className="mt-3 text-xl font-black">{process.title}</h3>
              <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
                <p><strong className="text-white">Process:</strong> {process.code}</p>
                <p><strong className="text-white">Version:</strong> {version.version}</p>
                <p><strong className="text-white">Effective:</strong> {version.effectiveDate ?? "On approval"}</p>
                <p><strong className="text-white">Owner:</strong> {process.ownerLabel}</p>
              </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-2">
              <section>
                <h4 className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">Purpose</h4>
                <p className="mt-3 text-sm leading-7 text-slate-700">{version.purpose}</p>
              </section>
              <section>
                <h4 className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">Trigger / frequency</h4>
                <p className="mt-3 text-sm leading-7 text-slate-700">{version.trigger}</p>
              </section>
            </div>

            <ListSection title="Inputs / prerequisites" items={version.inputs} />
            <ListSection title="Procedure" items={version.steps} ordered />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock3 className="size-4" />
                  <p className="text-xs font-black uppercase tracking-[0.12em]">SLA / deadline</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{version.sla ?? "No fixed SLA recorded."}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-slate-700">
                  <FileCheck2 className="size-4" />
                  <p className="text-xs font-black uppercase tracking-[0.12em]">Expected outcome</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{version.expectedOutcome}</p>
              </div>
            </div>

            <ListSection title="Required evidence / records" items={version.evidence} />
            <ListSection title="Exceptions / exception conditions" items={version.exceptionConditions} />
            <ListSection title="Escalation" items={version.escalation} />
            <ListSection title="KPIs / verification measures" items={version.kpis} />

            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-brand-700" />
                  <h4 className="text-xs font-black uppercase tracking-[0.12em] text-slate-700">Governing policy</h4>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {process.governingPolicyCodes.join(", ") || "No governing policy linked."}
                </p>
              </section>
              <section className="rounded-2xl border border-slate-200 p-4">
                <h4 className="text-xs font-black uppercase tracking-[0.12em] text-slate-700">Execution systems / tools</h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {process.technology.join(" · ") || "No execution technology assigned."}
                </p>
              </section>
            </div>

            {process.operatingMap && (
              <section className="rounded-[24px] border border-brand-200 bg-brand-50/60 p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-brand-800">
                      <Activity className="size-4" />
                      <h4 className="text-xs font-black uppercase tracking-[0.16em]">
                        Operating map
                      </h4>
                    </div>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
                      This connects the controlled procedure to the roles, execution control,
                      checklists, records and live work produced by the same process.
                    </p>
                  </div>
                  <span className="rounded-full border border-brand-200 bg-white px-3 py-1 text-[10px] font-black uppercase text-brand-800">
                    {process.operatingMap.scope === "institution"
                      ? "Institution view"
                      : "My role view"}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-brand-100 bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                      Execution control
                    </p>
                    {process.operatingMap.execution ? (
                      <>
                        <p className="mt-2 text-sm font-black capitalize text-slate-950">
                          {readable(process.operatingMap.execution.mode)}
                          {" · "}
                          {readable(process.operatingMap.execution.status)}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          Accountable role:{" "}
                          {process.operatingMap.execution.ownerRoleTitle ??
                            process.ownerLabel}
                        </p>
                        {process.operatingMap.execution.triggerSummary && (
                          <p className="mt-2 text-xs leading-5 text-slate-600">
                            {process.operatingMap.execution.triggerSummary}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {process.operatingMap.execution.evidenceRequired && (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-900">
                              Evidence required
                            </span>
                          )}
                          {process.operatingMap.execution.verificationRequired && (
                            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-800">
                              Independent verification
                            </span>
                          )}
                          {process.operatingMap.execution.escalationMinutes && (
                            <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black text-red-800">
                              Escalates after{" "}
                              {process.operatingMap.execution.escalationMinutes} min
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-amber-800">
                        Execution mapping has not been created yet.
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-brand-100 bg-white p-4">
                    <div className="flex items-center gap-2">
                      <UsersRound className="size-4 text-brand-700" />
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                        Participating roles
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {process.operatingMap.roles.length ? (
                        process.operatingMap.roles.map((role) => (
                          <span
                            key={role.code + role.participation}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700"
                          >
                            {role.title} · {readable(role.participation)}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">
                          No structured role participation is mapped yet.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-brand-100 bg-white p-4">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="size-4 text-brand-700" />
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                        Checklists
                      </p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {process.operatingMap.checklists.length ? (
                        process.operatingMap.checklists.map((item) => (
                          <div key={item.code} className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-black text-slate-800">
                              {item.code} · {item.name}
                            </p>
                            <p className="mt-1 text-[10px] font-bold uppercase text-slate-500">
                              {readable(item.status)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">
                          No checklist is attached to this process.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-brand-100 bg-white p-4">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="size-4 text-brand-700" />
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                        Controlled reports & logs
                      </p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {process.operatingMap.controlledRecords.length ? (
                        process.operatingMap.controlledRecords.map((item) => (
                          <div
                            key={item.label}
                            className="rounded-xl bg-slate-50 p-3"
                          >
                            <p className="text-xs font-black text-slate-800">
                              {item.label}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {item.toolCode} · {item.toolName}
                              {item.verificationRequired
                                ? " · verification required"
                                : ""}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">
                          No controlled report or log requirement is attached.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                  {[
                    ["Current work", process.operatingMap.currentWork],
                    ["Awaiting verification", process.operatingMap.awaitingVerification],
                    ["Completed · 30d", process.operatingMap.completedLast30Days],
                    ["Records · 30d", process.operatingMap.recordsLast30Days],
                    ["Versions", process.operatingMap.versionCount],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-2xl bg-white p-4">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                        {label}
                      </p>
                      <p className="mt-1 text-2xl font-black text-slate-950">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                {organisationId && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={`/khpos/${organisationId}/work`}
                      className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
                    >
                      Open Today
                    </Link>
                    <Link
                      href={`/khpos/${organisationId}/records`}
                      className="rounded-full border border-brand-200 bg-white px-4 py-2 text-xs font-black text-brand-800"
                    >
                      Records & Evidence
                    </Link>
                    <Link
                      href={`/khpos/${organisationId}/execution-control`}
                      className="rounded-full border border-brand-200 bg-white px-4 py-2 text-xs font-black text-brand-800"
                    >
                      Execution Control
                    </Link>
                  </div>
                )}
              </section>
            )}
          </article>
        )}
      </div>
    </details>
  );
}
