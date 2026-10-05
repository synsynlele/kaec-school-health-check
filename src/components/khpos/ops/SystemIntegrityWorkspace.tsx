"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Loader2,
  ShieldCheck,
  Siren,
  Wrench,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposIntegritySnapshot } from "@/lib/khpos/ops/integrity";

function severityClasses(value: string) {
  if (value === "critical") return "border-red-200 bg-red-50 text-red-900";
  if (value === "high") return "border-amber-200 bg-amber-50 text-amber-950";
  if (value === "medium") return "border-brand-200 bg-brand-50 text-brand-950";
  return "border-slate-200 bg-slate-50 text-slate-700";
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
          <Link
            href={`/khpos/${organisationId}`}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950"
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-black text-mint-200">
              <ShieldCheck className="size-3.5" />
              Institutional health inspector
            </span>
            <Link
              href={`/khpos/${organisationId}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black"
            >
              <ArrowLeft className="size-4" />
              Command Centre
            </Link>
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">System Integrity</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
            KHP-OS checks whether institutional controls are actually connected:
            people to roles, approved processes to execution, schedules to owners,
            work to verification, decisions to outcomes and campuses to safeguards.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-bold text-brand-100">Overall</p>
              <p className="mt-2 text-xl font-black">
                {snapshot.healthy ? "Healthy" : "Attention required"}
              </p>
            </div>
            {[
              ["Critical", snapshot.summary.critical],
              ["High", snapshot.summary.high],
              ["Medium", snapshot.summary.medium],
              ["Patterns", snapshot.summary.patterns],
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

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {snapshot.findings.length === 0 ? (
          <section className="rounded-[30px] border border-emerald-200 bg-emerald-50 p-8 text-center">
            <CheckCircle2 className="mx-auto size-10 text-emerald-700" />
            <h2 className="mt-4 text-2xl font-black text-emerald-950">
              No structural integrity gaps detected.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-emerald-900">
              KHP-OS found no current high-confidence break in the operating links
              it knows how to inspect.
            </p>
          </section>
        ) : (
          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                  Control gaps
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Fix the system, not the symptom
                </h2>
              </div>
              <Wrench className="size-6 text-brand-700" />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {snapshot.findings.map((finding) => (
                <Link
                  key={finding.key}
                  href={finding.href}
                  className={`rounded-3xl border p-5 transition hover:-translate-y-0.5 hover:shadow-md ${severityClasses(
                    finding.severity,
                  )}`}
                >
                  <div className="flex items-start gap-4">
                    <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-white/70">
                      {finding.severity === "critical" ? (
                        <Siren className="size-5" />
                      ) : (
                        <AlertTriangle className="size-5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wide">
                          {finding.severity} · {readable(finding.category)}
                        </span>
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black">
                          {finding.count}
                        </span>
                      </span>
                      <span className="mt-2 block text-lg font-black">
                        {finding.title}
                      </span>
                      <span className="mt-2 block text-sm leading-6 opacity-80">
                        {finding.detail}
                      </span>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-black">
                        Fix this
                        <ArrowRight className="size-3.5" />
                      </span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <Activity className="size-6 text-brand-700" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                Pattern intelligence
              </p>
              <h2 className="mt-1 text-2xl font-black">
                Repetition that deserves root-cause review
              </h2>
            </div>
          </div>

          {snapshot.patterns.length ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {snapshot.patterns.map((pattern) => (
                <Link
                  key={pattern.key}
                  href={pattern.href}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-brand-300"
                >
                  <p className="text-[10px] font-black uppercase tracking-wide text-brand-700">
                    {pattern.severity} · {pattern.evidenceCount} signals
                  </p>
                  <p className="mt-2 font-black">{pattern.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {pattern.detail}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">
              No repeated failure pattern currently crosses the detection threshold.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
