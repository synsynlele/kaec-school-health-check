"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposAskResult } from "@/lib/khpos/ops/assistant";

const quickQuestions = [
  "What needs my attention today?",
  "What is our process for missed lessons?",
  "Which decisions are waiting for action?",
  "How is our execution performance doing?",
  "What is coming up in the next 30 days?",
];

export function AskKhposWorkspace({ organisationId }: { organisationId: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<KhposAskResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(value?: string) {
    const clean = (value ?? question).trim();
    if (!clean || !supabase) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session has ended. Sign in again.");

      const response = await fetch(`/api/khpos/ops/ask/${organisationId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: clean }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        result?: KhposAskResult;
        error?: string;
      };
      if (!response.ok || !body.ok || !body.result) {
        throw new Error(body.error ?? "Ask KHP-OS could not answer this question.");
      }
      setQuestion(clean);
      setResult(body.result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ask KHP-OS could not answer this question.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-black text-mint-200">
              Grounded institutional intelligence
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
              <BrainCircuit className="size-6" />
            </span>
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Ask KHP-OS</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
                Ask about approved processes, policies, your current work, authorised decisions,
                performance and the institutional calendar. Answers are grounded only in the
                KHP-OS evidence your role is allowed to see.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <label className="block text-sm font-black">
            What do you need to understand?
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void ask();
                    }
                  }}
                  maxLength={700}
                  placeholder="e.g. What should happen when a lesson is missed?"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-base font-normal outline-none focus:border-brand-400"
                />
              </div>
              <button
                type="button"
                disabled={busy || question.trim().length < 3}
                onClick={() => void ask()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Ask
              </button>
            </div>
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            {quickQuestions.map((item) => (
              <button
                key={item}
                type="button"
                disabled={busy}
                onClick={() => {
                  setQuestion(item);
                  void ask(item);
                }}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:border-brand-300"
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}

        {result && (
          <section className="rounded-[30px] border border-brand-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-50 px-3 py-1 text-[11px] font-black uppercase text-brand-800">
                {result.intent}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase text-slate-600">
                {result.engine === "openai" ? "AI + governed sources" : "governed source engine"}
              </span>
            </div>

            <div className="mt-5 whitespace-pre-wrap text-[15px] leading-7 text-slate-800">
              {result.answer}
            </div>

            {result.sources.length > 0 && (
              <div className="mt-7 border-t border-slate-100 pt-5">
                <div className="flex items-center gap-2 text-slate-700">
                  <BookOpen className="size-4" />
                  <p className="text-xs font-black uppercase tracking-[0.16em]">Open the source</p>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {result.sources.map((source) => (
                    <Link
                      key={source.id}
                      href={source.href}
                      className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:border-brand-300"
                    >
                      <p className="text-[10px] font-black uppercase tracking-wide text-brand-700">
                        {source.category}
                      </p>
                      <p className="mt-1 font-black">{source.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                        {source.detail}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-brand-700">
                        Open
                        <ArrowRight className="size-3.5" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <p>{result.disclaimer}</p>
            </div>
          </section>
        )}

        {!result && !busy && !error && (
          <section className="grid gap-4 sm:grid-cols-3">
            {[
              [BookOpen, "Governed knowledge", "Approved policies and processes remain the source of truth."],
              [ShieldCheck, "Role-aware", "You only receive institutional evidence your active role may access."],
              [CalendarDays, "Operational", "Ask about what is due, blocked, awaiting authority or coming next."],
            ].map(([Icon, title, detail]) => {
              const CardIcon = Icon as typeof BookOpen;
              return (
                <div key={String(title)} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <CardIcon className="size-5 text-brand-700" />
                  <h2 className="mt-4 font-black">{String(title)}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{String(detail)}</p>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
