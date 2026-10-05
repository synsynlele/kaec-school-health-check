"use client";

import {
  CheckCircle2,
  Clock3,
  FileCheck2,
  ShieldAlert,
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
}: {
  process: KhposOpsProcess;
  compact?: boolean;
  defaultOpen?: boolean;
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
          </article>
        )}
      </div>
    </details>
  );
}
