"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Link2,
  Loader2,
  Search,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOperationalRecordsWorkspace,
  OperationalChecklistRun,
  OperationalEvidenceRecord,
  OperationalSubmittedRecord,
} from "@/lib/khpos/ops/records";

type Tab = "records" | "checklists" | "evidence";

function readable(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
}

function formatDate(value: string | null) {
  if (!value) return "Not completed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusClasses(status: string) {
  if (status === "verified" || status === "completed") {
    return "bg-emerald-50 text-emerald-800";
  }
  if (status === "returned" || status === "rejected") {
    return "bg-amber-50 text-amber-900";
  }
  return "bg-brand-50 text-brand-800";
}

function RecordCard({ item }: { item: OperationalSubmittedRecord }) {
  return (
    <details className="group rounded-3xl border border-slate-200 bg-white shadow-sm open:shadow-md">
      <summary className="cursor-pointer list-none p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {item.processCode && (
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-black text-brand-800">
                  {item.processCode}
                </span>
              )}
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase text-slate-600">
                {readable(item.toolType)}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${statusClasses(
                  item.status,
                )}`}
              >
                {item.status}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-black text-slate-950">
              {item.requirementLabel}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {item.workTitle} · {item.roleTitle}
              {item.campusName ? ` · ${item.campusName}` : ""}
            </p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-slate-500">
            {formatDate(item.submittedAt)}
          </span>
        </div>
      </summary>
      <div className="border-t border-slate-100 px-5 pb-6 pt-5 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(item.payload).map(([key, value]) => (
            <div key={key} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                {readable(key)}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {String(value)}
              </p>
            </div>
          ))}
        </div>
        {item.reviewNote && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Reviewer note: {item.reviewNote}
          </div>
        )}
      </div>
    </details>
  );
}

function ChecklistCard({ item }: { item: OperationalChecklistRun }) {
  return (
    <details className="group rounded-3xl border border-slate-200 bg-white shadow-sm open:shadow-md">
      <summary className="cursor-pointer list-none p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {item.processCode && (
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-black text-brand-800">
                  {item.processCode}
                </span>
              )}
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
                {item.checklistCode}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${statusClasses(
                  item.workStatus,
                )}`}
              >
                {readable(item.workStatus)}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-black">{item.checklistName}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {item.workTitle} · {item.roleTitle}
              {item.campusName ? ` · ${item.campusName}` : ""}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {formatDate(item.completedAt)}
          </span>
        </div>
      </summary>
      <div className="border-t border-slate-100 px-5 pb-6 pt-5 sm:px-6">
        <div className="space-y-2">
          {item.items.map((entry) => (
            <div
              key={entry.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2
                  className={`mt-0.5 size-4 shrink-0 ${
                    entry.response === null ? "text-slate-300" : "text-emerald-700"
                  }`}
                />
                <div>
                  <p className="text-sm font-bold">{entry.label}</p>
                  {entry.guidance && (
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {entry.guidance}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-slate-700">
                    {entry.response === null
                      ? "No response"
                      : typeof entry.response === "boolean"
                        ? entry.response
                          ? "Yes"
                          : "No"
                        : String(entry.response)}
                  </p>
                  {entry.note && (
                    <p className="mt-1 text-xs text-slate-500">{entry.note}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function EvidenceCard({ item }: { item: OperationalEvidenceRecord }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {item.processCode && (
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-black text-brand-800">
              {item.processCode}
            </span>
          )}
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase text-slate-600">
            {readable(item.evidenceType)}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${statusClasses(
              item.verificationStatus,
            )}`}
          >
            {readable(item.verificationStatus)}
          </span>
        </div>
        <span className="text-xs text-slate-500">{formatDate(item.submittedAt)}</span>
      </div>
      <h3 className="mt-3 font-black">{item.workTitle}</h3>
      <p className="mt-1 text-xs text-slate-500">
        {item.roleTitle}
        {item.campusName ? ` · ${item.campusName}` : ""}
      </p>
      {item.note && (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {item.note}
        </p>
      )}
      {item.externalUrl && (
        <a
          href={item.externalUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-sm font-black text-brand-700"
        >
          <Link2 className="size-4" />
          Open evidence reference
        </a>
      )}
      {item.storageReference && (
        <p className="mt-4 break-all rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          {item.storageReference}
        </p>
      )}
    </article>
  );
}

export function OperationalRecordsWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] =
    useState<KhposOperationalRecordsWorkspace | null>(null);
  const [tab, setTab] = useState<Tab>("records");
  const [query, setQuery] = useState("");
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const token = data.session?.access_token;
      if (!token) {
        setError("Your session has ended. Sign in again to continue.");
        return;
      }

      const response = await fetch(
        `/api/khpos/ops/records/${organisationId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        records?: KhposOperationalRecordsWorkspace;
        error?: string;
      };

      if (!active) return;
      if (!response.ok || !body.ok || !body.records) {
        setError(body.error ?? "Records & Evidence could not be loaded.");
        return;
      }

      setWorkspace(body.records);
      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  if (!workspace && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-mint-300" />
          <p className="mt-4 text-sm font-semibold text-slate-300">
            Loading institutional records…
          </p>
        </div>
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <FileCheck2 className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Records & Evidence unavailable</h1>
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

  const needle = query.trim().toLowerCase();
  const records = workspace.records.filter((item) =>
    !needle ||
    `${item.workTitle} ${item.processCode ?? ""} ${item.requirementLabel} ${item.toolCode} ${item.roleTitle} ${item.campusName ?? ""}`
      .toLowerCase()
      .includes(needle),
  );
  const checklists = workspace.checklists.filter((item) =>
    !needle ||
    `${item.workTitle} ${item.processCode ?? ""} ${item.checklistCode} ${item.checklistName} ${item.roleTitle} ${item.campusName ?? ""}`
      .toLowerCase()
      .includes(needle),
  );
  const evidence = workspace.evidence.filter((item) =>
    !needle ||
    `${item.workTitle} ${item.processCode ?? ""} ${item.evidenceType} ${item.roleTitle} ${item.campusName ?? ""} ${item.note ?? ""}`
      .toLowerCase()
      .includes(needle),
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex items-center justify-between gap-4">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-bold text-mint-200">
              Operations · Institutional record
            </span>
            <Link
              href={`/khpos/${organisationId}/work`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black"
            >
              <ArrowLeft className="size-4" />
              My Work
            </Link>
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
            Records & Evidence
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
            Work is where people execute and submit. This is the institutional
            record of the reports, logs, checklists and evidence produced while
            operating the school.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Reports & logs", workspace.summary.reportsAndLogs],
              ["Checklist runs", workspace.summary.checklistRuns],
              ["Evidence records", workspace.summary.evidenceRecords],
              ["Awaiting verification", workspace.summary.awaitingVerification],
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

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
            {([
              ["records", "Reports & logs", FileText],
              ["checklists", "Checklists", ClipboardCheck],
              ["evidence", "Evidence", FileCheck2],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition sm:text-sm ${
                  tab === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>

          <label className="relative block min-w-0 lg:w-96">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search process, record, role or campus"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-brand-400"
            />
          </label>
        </section>

        {tab === "records" && (
          <section className="space-y-4">
            {records.length ? (
              records.map((item) => <RecordCard key={item.id} item={item} />)
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
                No report or log matches this view.
              </div>
            )}
          </section>
        )}

        {tab === "checklists" && (
          <section className="space-y-4">
            {checklists.length ? (
              checklists.map((item) => (
                <ChecklistCard key={item.workItemId} item={item} />
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
                No completed checklist matches this view.
              </div>
            )}
          </section>
        )}

        {tab === "evidence" && (
          <section className="grid gap-4 lg:grid-cols-2">
            {evidence.length ? (
              evidence.map((item) => <EvidenceCard key={item.id} item={item} />)
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600 lg:col-span-2">
                No supporting evidence matches this view.
              </div>
            )}
          </section>
        )}

        <section className="rounded-3xl border border-brand-200 bg-brand-50 p-5 text-sm leading-6 text-brand-950">
          <p className="font-black">One-source rule</p>
          <p className="mt-1">
            Records are created from controlled work. They are not separate
            documents staff upload later to make the system look complete.
            Sensitive safeguarding case material remains in the protected
            Safeguarding workspace and is not exposed here.
          </p>
        </section>
      </div>
    </main>
  );
}
