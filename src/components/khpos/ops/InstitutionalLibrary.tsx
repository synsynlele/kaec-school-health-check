"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  FileText,
  LibraryBig,
  Loader2,
  Search,
  ShieldCheck,
  Wrench,
  Workflow,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsLibrary,
  KhposOpsPolicy,
} from "@/lib/khpos/ops/library";

type Tab = "policies" | "processes" | "tools";

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function SectionList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (!items.length) return null;
  return (
    <section>
      <h4 className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
        {title}
      </h4>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2">
            <CheckCircle2 className="mt-1 size-3.5 shrink-0 text-mint-700" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PolicyDocument({
  policy,
  busyVersionId,
  onAcknowledge,
}: {
  policy: KhposOpsPolicy;
  busyVersionId: string | null;
  onAcknowledge: (policy: KhposOpsPolicy) => void;
}) {
  const version = policy.activeVersion;

  return (
    <details className="group rounded-[28px] border border-slate-200 bg-white shadow-sm open:shadow-md">
      <summary className="cursor-pointer list-none p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-black text-brand-800">
                {policy.code}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase text-slate-600">
                {policy.priority}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold capitalize text-slate-600">
                {readable(policy.operatingSystem)}
              </span>
              {policy.requiredForMyRole && (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-800">
                  Required for my role
                </span>
              )}
            </div>
            <h3 className="mt-3 text-xl font-black text-slate-950">{policy.name}</h3>
            <p className="mt-2 text-sm text-slate-500">Steward: {policy.ownerLabel}</p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {version ? (
              <span className="rounded-full bg-mint-50 px-3 py-1.5 text-xs font-black text-mint-800">
                Active v{version.version}
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
                Registered · document pending
              </span>
            )}
            {policy.acknowledgedAt && (
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">
                Acknowledged
              </span>
            )}
          </div>
        </div>
      </summary>

      <div className="border-t border-slate-100 px-6 pb-8 pt-6 sm:px-7">
        {!version ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            This policy is already controlled in the Master Policy Register, but no approved document version is active yet. It must not be treated as adopted institutional policy until an approved version is published here.
          </div>
        ) : (
          <article className="space-y-7">
            <header className="rounded-3xl bg-slate-950 p-6 text-white">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-mint-300">
                Controlled Institutional Policy
              </p>
              <h3 className="mt-3 text-2xl font-black">{policy.name}</h3>
              <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
                <p><strong className="text-white">Policy:</strong> {policy.code}</p>
                <p><strong className="text-white">Version:</strong> {version.version}</p>
                <p><strong className="text-white">Effective:</strong> {version.effectiveDate ?? "On approval"}</p>
                <p><strong className="text-white">Review:</strong> {version.reviewDate ?? "Not scheduled"}</p>
              </div>
            </header>

            <div className="grid gap-7 lg:grid-cols-2">
              <section>
                <h4 className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">Purpose</h4>
                <p className="mt-3 text-sm leading-7 text-slate-700">{version.purpose}</p>
              </section>
              <section>
                <h4 className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">Scope</h4>
                <p className="mt-3 text-sm leading-7 text-slate-700">{version.scope}</p>
              </section>
            </div>

            <SectionList title="Principles" items={version.principles} />
            <SectionList title="Policy statements" items={version.policyStatements} />
            <SectionList title="Roles & responsibilities" items={version.rolesResponsibilities} />
            <SectionList title="Rules & requirements" items={version.rules} />
            <SectionList title="Exceptions" items={version.exceptions} />
            <SectionList title="Escalation & non-compliance" items={version.escalation} />
            <SectionList title="Records & evidence" items={version.recordsEvidence} />

            {policy.acknowledgementRequired && !policy.acknowledgedAt && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="font-black text-amber-950">Acknowledgement required</p>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  Confirm that you have read and understood this active policy version. A future material revision will require a fresh acknowledgement.
                </p>
                <button
                  type="button"
                  disabled={busyVersionId === version.id}
                  onClick={() => onAcknowledge(policy)}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
                >
                  {busyVersionId === version.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  Acknowledge policy
                </button>
              </div>
            )}
          </article>
        )}
      </div>
    </details>
  );
}

export function InstitutionalLibrary({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [library, setLibrary] = useState<KhposOpsLibrary | null>(null);
  const [tab, setTab] = useState<Tab>("policies");
  const [query, setQuery] = useState("");
  const [busyVersionId, setBusyVersionId] = useState<string | null>(null);
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

      const response = await fetch(`/api/khpos/ops/library/${organisationId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = (await response.json()) as {
        ok?: boolean;
        library?: KhposOpsLibrary;
        error?: string;
      };

      if (!active) return;
      if (!response.ok || !body.ok || !body.library) {
        setError(body.error ?? "Institutional library could not be loaded.");
        return;
      }

      setLibrary(body.library);
      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  async function acknowledge(policy: KhposOpsPolicy) {
    if (!supabase || !policy.activeVersion) return;
    setBusyVersionId(policy.activeVersion.id);
    setError("");

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setBusyVersionId(null);
      setError("Your session has ended. Sign in again to continue.");
      return;
    }

    const response = await fetch(`/api/khpos/ops/library/${organisationId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "acknowledge_policy",
        policyVersionId: policy.activeVersion.id,
      }),
    });

    const body = (await response.json()) as {
      ok?: boolean;
      library?: KhposOpsLibrary;
      error?: string;
    };

    setBusyVersionId(null);

    if (!response.ok || !body.ok || !body.library) {
      setError(body.error ?? "Policy acknowledgement could not be recorded.");
      return;
    }

    setLibrary(body.library);
  }

  if (!library && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-mint-300" />
          <p className="mt-4 text-sm font-semibold text-slate-300">
            Loading the Institutional Control Library…
          </p>
        </div>
      </main>
    );
  }

  if (error && !library) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <LibraryBig className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Institutional Library unavailable</h1>
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

  if (!library) return null;

  const needle = query.trim().toLowerCase();
  const policies = library.policies.filter((item) =>
    !needle ||
    `${item.code} ${item.name} ${item.operatingSystem} ${item.ownerLabel}`
      .toLowerCase()
      .includes(needle),
  );
  const processes = library.processes.filter((item) =>
    !needle ||
    `${item.code} ${item.title} ${item.operatingSystem} ${item.ownerLabel}`
      .toLowerCase()
      .includes(needle),
  );
  const tools = library.tools.filter((item) =>
    !needle ||
    `${item.code} ${item.name} ${item.toolType} ${item.purpose}`
      .toLowerCase()
      .includes(needle),
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex items-center justify-between gap-4">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-bold text-mint-200">
              Operations · O2
            </span>
            <Link
              href={`/khpos/${organisationId}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black text-white"
            >
              <ArrowLeft className="size-4" />
              Command Centre
            </Link>
          </div>

          <h1 className="mt-5 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
            Institutional Control Library
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
            One controlled source for what KNS requires, how work should happen and the tools people use to execute it. Registered items are visible without being falsely treated as adopted documents.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-bold text-brand-100">Policy register</p>
              <p className="mt-1 text-3xl font-black">{library.summary.policyCount}</p>
              <p className="mt-1 text-xs text-brand-100">{library.summary.activePolicyDocuments} approved documents</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-bold text-brand-100">Required for me</p>
              <p className="mt-1 text-3xl font-black">{library.summary.requiredPolicyCount}</p>
              <p className="mt-1 text-xs text-brand-100">{library.summary.unacknowledgedRequiredPolicies} acknowledgement(s) open</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-bold text-brand-100">Process register</p>
              <p className="mt-1 text-3xl font-black">{library.summary.processCount}</p>
              <p className="mt-1 text-xs text-brand-100">{library.summary.activeProcessDocuments} fully published processes</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-bold text-brand-100">Reusable tools</p>
              <p className="mt-1 text-3xl font-black">{library.summary.toolCount}</p>
              <p className="mt-1 text-xs text-brand-100">Shared execution instruments</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
            {([
              ["policies", "Policies", FileText],
              ["processes", "Processes", Workflow],
              ["tools", "Tools", Wrench],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${
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
              placeholder="Search code, title, system or owner"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
            />
          </label>
        </section>

        {tab === "policies" && (
          <section className="space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Policy Register</p>
              <h2 className="mt-2 text-2xl font-black">What KNS requires</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Only an approved active version is authoritative. Registered policies without an active version remain visible so nobody mistakes “not yet written” for “does not exist.”
              </p>
            </div>

            {policies.map((policy) => (
              <PolicyDocument
                key={policy.id}
                policy={policy}
                busyVersionId={busyVersionId}
                onAcknowledge={acknowledge}
              />
            ))}
          </section>
        )}

        {tab === "processes" && (
          <section>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Process Register</p>
              <h2 className="mt-2 text-2xl font-black">How KNS operates</h2>
            </div>

            <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className="px-4 py-3 font-black">Code</th>
                      <th className="px-4 py-3 font-black">Process</th>
                      <th className="px-4 py-3 font-black">System</th>
                      <th className="px-4 py-3 font-black">Owner</th>
                      <th className="px-4 py-3 font-black">Policy</th>
                      <th className="px-4 py-3 font-black">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processes.map((process) => (
                      <tr key={process.id} className="border-t border-slate-100 align-top">
                        <td className="px-4 py-4 font-black text-brand-700">{process.code}</td>
                        <td className="px-4 py-4">
                          <p className="font-black text-slate-950">{process.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {process.technology.join(" · ") || "Execution technology not assigned"}
                          </p>
                        </td>
                        <td className="px-4 py-4 capitalize text-slate-600">{readable(process.operatingSystem)}</td>
                        <td className="px-4 py-4 text-slate-600">{process.ownerLabel}</td>
                        <td className="px-4 py-4 text-slate-600">{process.governingPolicyCodes.join(", ") || "—"}</td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                            process.activeVersion ? "bg-mint-50 text-mint-800" : "bg-slate-100 text-slate-600"
                          }`}>
                            {process.activeVersion ? `Published v${process.activeVersion.version}` : "Registered"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {tab === "tools" && (
          <section>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Tools Registry</p>
              <h2 className="mt-2 text-2xl font-black">What people use to execute work</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Reusable tools prevent KNS from creating a different form for every process. The same Issue, Approval, Checklist, Evidence and Review primitives can serve many operating systems.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {tools.map((tool) => (
                <div key={tool.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-800">{tool.code}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-600">{readable(tool.toolType)}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-black">{tool.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{tool.purpose}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <BookOpen className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-black">Transformation Playbooks remain intact</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                The existing KHP-OS transformation playbooks still guide institutional change. This new Library governs normal institutional operations; it does not replace the transformation workspace.
              </p>
              <Link
                href={`/khpos/${organisationId}/playbooks`}
                className="mt-4 inline-flex items-center gap-2 text-sm font-black text-brand-700"
              >
                Open Transformation Playbooks →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
