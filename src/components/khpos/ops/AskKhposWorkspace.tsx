"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CircleAlert,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposAskAnswer } from "@/lib/khpos/ops/ask";

const examples = [
  "What is our process for a missed lesson?",
  "What currently needs my attention?",
  "Which decisions still need implementation?",
  "What does our evidence say about execution reliability?",
] as const;

function readable(value: string) {
  return value.replaceAll("_", " ");
}

export function AskKhposWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<KhposAskAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function ask(value?: string) {
    const next = (value ?? question).trim();
    if (!next || !supabase) return;

    setQuestion(next);
    setBusy(true);
    setError("");

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
        body: JSON.stringify({ question: next }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        answer?: KhposAskAnswer;
        error?: string;
      };

      if (!response.ok || !body.ok || !body.answer) {
        throw new Error(body.error ?? "Ask KHP-OS could not answer.");
      }

      setAnswer(body.answer);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ask KHP-OS could not answer.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask();
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-black text-mint-200">
              <BrainCircuit className="size-3.5" />
              Governed institutional intelligence
            </span>
            <Link
              href={`/khpos/${organisationId}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black"
            >
              <ArrowLeft className="size-4" />
              Command Centre
            </Link>
          </div>

          <h1 className="mt-6 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
            Ask KHP-OS
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100 sm:text-base">
            Ask about the school&apos;s approved policies, processes, current work,
            issues, decisions and evidence-derived performance. Answers are grounded
            in records your role is authorised to see.
          </p>

          <form onSubmit={submit} className="mt-7 max-w-4xl">
            <div className="rounded-[26px] border border-white/15 bg-white/10 p-2 backdrop-blur">
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative min-w-0 flex-1">
                  <Search className="absolute left-4 top-4 size-5 text-brand-200" />
                  <textarea
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    maxLength={700}
                    rows={3}
                    placeholder="Ask a question about how the school should operate or what is happening now…"
                    className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/50 py-3.5 pl-12 pr-4 text-sm leading-6 text-white outline-none placeholder:text-brand-200/70 focus:border-mint-300"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy || question.trim().length < 4}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-mint-300 px-6 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Ask
                </button>
              </div>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {examples.map((item) => (
              <button
                key={item}
                type="button"
                disabled={busy}
                onClick={() => void ask(item)}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-left text-xs font-semibold text-brand-100 hover:bg-white/10"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <CircleAlert className="mt-0.5 size-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {!answer && !busy && (
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <ShieldCheck className="size-6 text-brand-700" />
              <h2 className="mt-4 font-black">Grounded, not imaginative</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                If KHP-OS has no governed evidence for an answer, it says so instead
                of inventing institutional rules.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <BookOpen className="size-6 text-brand-700" />
              <h2 className="mt-4 font-black">Source-backed</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Every response exposes the policies, processes or current operating
                records used to form the answer.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <BrainCircuit className="size-6 text-brand-700" />
              <h2 className="mt-4 font-black">Authority remains human</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Ask KHP-OS can explain and surface evidence; it cannot approve,
                override or make institutional decisions for authorised leaders.
              </p>
            </div>
          </section>
        )}

        {busy && (
          <section className="rounded-[30px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto size-8 animate-spin text-brand-700" />
            <p className="mt-4 text-sm font-bold text-slate-600">
              Retrieving authorised KHP-OS evidence…
            </p>
          </section>
        )}

        {answer && !busy && (
          <>
            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                    KHP-OS answer
                  </p>
                  <h2 className="mt-2 text-xl font-black">{question}</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
                  {answer.usedAi ? "Grounded AI" : "Source retrieval"}
                </span>
              </div>

              <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-700 sm:text-base">
                {answer.answer}
              </div>

              <p className="mt-6 text-xs font-semibold text-slate-400">
                {answer.remainingToday} Ask KHP-OS request
                {answer.remainingToday === 1 ? "" : "s"} remaining today.
              </p>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                Governed sources
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Evidence used for this answer
              </h2>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {answer.sources.map((item, index) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-950 text-xs font-black text-white">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wide text-brand-700">
                            {readable(item.type)}
                          </span>
                          {item.current && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-900">
                              current
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block font-black text-slate-950">
                          {item.label}
                        </span>
                        <span className="mt-2 line-clamp-3 block text-xs leading-5 text-slate-500">
                          {item.excerpt}
                        </span>
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-brand-700">
                          Open source
                          <ArrowRight className="size-3.5" />
                        </span>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
