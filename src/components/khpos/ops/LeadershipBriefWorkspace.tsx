"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  FileText,
  Gauge,
  Loader2,
  Target,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposLeadershipBrief } from "@/lib/khpos/ops/briefing";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function LeadershipBriefWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [brief, setBrief] = useState<KhposLeadershipBrief | null>(null);
  const [error, setError] = useState(supabase ? "" : "Sign-in is not configured. Please contact your school administrator.");

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
        `/api/khpos/ops/briefing/${organisationId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        brief?: KhposLeadershipBrief;
        error?: string;
      };
      if (!active) return;
      if (!response.ok || !body.ok || !body.brief) {
        setError(body.error ?? "Leadership brief could not be prepared.");
        return;
      }
      setBrief(body.brief);
      setError("");
    }).catch(() => {
      if (active) setError("The leadership brief could not be loaded. Check your connection and try again.");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  if (!brief && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <Loader2 className="size-9 animate-spin text-mint-300" />
      </main>
    );
  }

  if (!brief) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <CircleAlert className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Leadership brief unavailable</h1>
          <p className="mt-3 text-sm text-slate-300">{error}</p>
        </div>
      </main>
    );
  }

  const derived = brief.derivedPerformance;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-black text-mint-200">
              Generated from live institutional reality
            </span>
            <Link
              href={`/khpos/${organisationId}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black"
            >
              <ArrowLeft className="size-4" />
              Command Centre
            </Link>
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Leadership Brief
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100">
            Use the meeting to decide, unblock and improve. KHP-OS has already
            assembled what changed, what is failing, what needs authority and
            what is coming next.
          </p>
          <p className="mt-3 text-xs text-brand-200">
            Prepared {formatDate(brief.generatedAt)}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        <section>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
            Since the last seven days
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Work completed", value: brief.progress.workCompleted, icon: CheckCircle2 },
              { label: "Issues resolved", value: brief.progress.issuesResolved, icon: CircleAlert },
              { label: "Decisions implemented", value: brief.progress.decisionsImplemented, icon: Target },
              { label: "Reports / logs submitted", value: brief.progress.recordsSubmitted, icon: FileText },
            ].map((item) => {
              const ItemIcon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <ItemIcon className="size-5 text-brand-700" />
                  <p className="mt-4 text-xs font-black uppercase tracking-wide text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-1 text-3xl font-black">{item.value}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[30px] border border-red-100 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">
                Leadership attention
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {brief.attention.summary.actionRequired} action-required item
                {brief.attention.summary.actionRequired === 1 ? "" : "s"}
              </h2>
            </div>
            <Link
              href={`/khpos/${organisationId}/work`}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-xs font-black text-white"
            >
              Open Today
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {brief.attention.items.slice(0, 8).map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:border-brand-300"
              >
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                  {item.kind.replaceAll("_", " ")} · {item.severity}
                </p>
                <p className="mt-1 font-black">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {item.detail}
                </p>
              </Link>
            ))}
          </div>

          {!brief.attention.items.length && (
            <p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
              No current exception appears in your authorised attention queue.
            </p>
          )}
        </section>

        <section className="rounded-[30px] border border-brand-200 bg-brand-50 p-6 shadow-sm sm:p-7">
          <div className="flex items-center gap-3">
            <Gauge className="size-6 text-brand-700" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                Evidence-derived execution
              </p>
              <h2 className="mt-1 text-2xl font-black">Institutional operating signals</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Execution coverage", derived.executionCoverage.percent],
              ["Work completion", derived.workCompletionReliability.percent],
              ["On-time completion", derived.onTimeCompletion.percent],
              ["First-pass verification", derived.verificationFirstPass.percent],
              ["Issue closure", derived.issueClosure.percent],
              ["Decision action closure", derived.decisionActionClosure.percent],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl bg-white p-4">
                <p className="text-xs font-bold text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-black">
                  {value === null ? "—" : String(value) + "%"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Meeting preparation</p>
              <h2 className="mt-2 text-2xl font-black">Evidence and outcomes for the agenda</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Prioritised from your authorised attention queue. Review each source before recording an outcome.</p>
            </div>
            <Link href={`/khpos/${organisationId}/decisions`} className="rounded-full bg-slate-950 px-4 py-2.5 text-xs font-black text-white">Record a decision</Link>
          </div>
          <ol className="mt-5 space-y-3">
            {brief.meetingAgenda.items.map((item, index) => (
              <li key={item.sourceId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-brand-700">{index + 1}. {item.purpose} · {item.severity}</p>
                <h3 className="mt-2 font-black">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.evidence}</p>
                {item.dueAt && <p className="mt-2 text-xs font-semibold text-slate-500">Due {formatDate(item.dueAt)}</p>}
                <p className="mt-3 text-sm font-semibold leading-6">{item.requestedOutcome}</p>
                <Link href={item.href} className="mt-3 inline-flex items-center gap-2 text-sm font-black text-brand-700">Review source <ArrowRight className="size-4" /></Link>
              </li>
            ))}
          </ol>
          {!brief.meetingAgenda.items.length && <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Your attention queue has no items for this agenda. Use the operating signals and upcoming obligations to prepare improvement discussions.</p>}
          {brief.meetingAgenda.remainingCount > 0 && <p className="mt-4 text-sm text-slate-600">{brief.meetingAgenda.remainingCount} more items remain in your attention queue. <Link href={`/khpos/${organisationId}/work`} className="font-bold text-brand-700">Review Today</Link></p>}
          <p className="mt-4 text-xs leading-5 text-slate-500">Agenda prompts do not approve decisions or change work. Record conclusions in their source workspace so existing authority, evidence and verification controls apply.</p>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
            Meeting questions
          </p>
          <h2 className="mt-2 text-2xl font-black">
            Questions worth leadership time
          </h2>
          <ol className="mt-5 space-y-3">
            {brief.meetingQuestions.map((question, index) => (
              <li
                key={question}
                className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-950 text-xs font-black text-white">
                  {index + 1}
                </span>
                <p className="pt-1 text-sm font-semibold leading-6">{question}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Record actual leadership decisions in Decisions. Approved actions
            automatically become verified implementation work rather than meeting minutes.
          </p>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                Next on the institutional clock
              </p>
              <h2 className="mt-2 text-2xl font-black">Upcoming</h2>
            </div>
            <Link
              href={`/khpos/${organisationId}/calendar`}
              className="inline-flex items-center gap-2 text-sm font-black text-brand-700"
            >
              Full calendar
              <CalendarDays className="size-4" />
            </Link>
          </div>
          <div className="mt-5 space-y-2">
            {brief.upcoming.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-start gap-4 rounded-2xl border border-slate-200 p-4 hover:border-brand-300"
              >
                <span className="min-w-24 text-xs font-black text-brand-700">
                  {item.date}
                  {item.time ? " · " + item.time : ""}
                </span>
                <span>
                  <span className="block font-black">{item.title}</span>
                  <span className="mt-1 block text-sm text-slate-600">{item.detail}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
