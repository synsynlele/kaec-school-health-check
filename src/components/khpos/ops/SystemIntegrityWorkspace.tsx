"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Loader2,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposIntegrityFinding,
  KhposIntegritySnapshot,
} from "@/lib/khpos/ops/integrity";

function severityClasses(severity: KhposIntegrityFinding["severity"]) {
  if (severity === "critical") return "border-red-200 bg-red-50 text-red-900";
  if (severity === "high") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-brand-200 bg-brand-50 text-brand-950";
}

function readable(value: string) {
  return value.replaceAll("_", " ");
}

export function SystemIntegrityWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [snapshot, setSnapshot] = useState<KhposIntegritySnapshot | null>(null);
  const [error, setError] = useState("");

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
        `/api/khpos/ops/integrity/${organisationId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        integrity?: KhposIntegritySnapshot;
        error?: string;
      };

      if (!active) return;
      if (!response.ok || !body.ok || !body.integrity) {
        setError(body.error ?? "System Integrity could not be loaded.");
        return;
      }

      setSnapshot(body.integrity);
      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  if (!snapshot && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <Loader2 className="size-9 animate-spin text-mint-300" />
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <CircleAlert className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">System Integrity unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
        </div>
      </main>
    );
  }

  const clean = snapshot.findings.length === 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-black text-mint-200">
              Leadership-only institutional control
            </span>
            <Link
              href={`/khpos/${organisationId}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black"
            >
              <ArrowLeft className="size-4" />
              Command Centre
            </Link>
          </div>

          <div className="mt-6 flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-mint-300 text-slate-950">
              <ShieldCheck className="size-6" />
            </span>
            <div>
              <h1 className="text-3xl font-black sm:text-5xl">System Integrity</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100">
                Detect contradictions before they become institutional failure:
                broken access, orphan authority, overdue controls, automation
                ownership gaps, stale verification and governance debt.
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total integrity gaps", snapshot.summary.total],
              ["Critical", snapshot.summary.critical],
              ["High", snapshot.summary.high],
              ["Medium", snapshot.summary.medium],
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

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6">
        {clean ? (
          <section className="rounded-[30px] border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto size-10 text-emerald-700" />
            <h2 className="mt-4 text-2xl font-black text-emerald-950">
              No integrity gaps detected by the current control set.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-emerald-900">
              This does not replace human oversight. It means the system has not
              detected a structural contradiction in the checks it currently runs.
            </p>
          </section>
        ) : (
          snapshot.findings.map((finding) => (
            <article
              key={finding.id}
              className={`rounded-[28px] border p-5 shadow-sm sm:p-6 ${severityClasses(
                finding.severity,
              )}`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-black uppercase">
                      {finding.severity}
                    </span>
                    <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-black uppercase">
                      {readable(finding.category)}
                    </span>
                    <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-black">
                      {finding.count}
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl font-black">{finding.title}</h2>
                  <p className="mt-2 text-sm leading-6 opacity-90">
                    {finding.detail}
                  </p>
                </div>

                <Link
                  href={finding.href}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-xs font-black text-white"
                >
                  Resolve at source
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>

              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-black/5 bg-white/70 p-4">
                <Wrench className="mt-0.5 size-4 shrink-0" />
                <p className="text-xs font-semibold leading-5">
                  {finding.remediation}
                </p>
              </div>
            </article>
          ))
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm">
          <p className="font-black text-slate-950">Control boundary</p>
          <p className="mt-1">
            System Integrity detects and routes structural gaps; it does not
            silently mutate staff authority, governance documents or institutional
            records. Corrections remain in their controlled source workflows.
          </p>
        </section>
      </div>
    </main>
  );
}
