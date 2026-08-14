"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CloudOff,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CHAPTERS,
  QUESTIONS,
  RATING_OPTIONS,
  TOTAL_QUESTIONS,
  type ChapterKey,
} from "@/lib/questions";
import { cn } from "@/lib/utils";

const LS_ANSWERS = (id: string) => `kaec_answers_${id}`;
const SECONDS_PER_QUESTION = 11;

type SaveState = "saved" | "saving" | "offline";

const OPTION_STYLES: Record<number, { selected: string; dot: string }> = {
  1: { selected: "border-red-400 bg-red-50 ring-2 ring-red-200", dot: "bg-red-500 text-white" },
  2: { selected: "border-orange-400 bg-orange-50 ring-2 ring-orange-200", dot: "bg-orange-500 text-white" },
  3: { selected: "border-amber-400 bg-amber-50 ring-2 ring-amber-200", dot: "bg-amber-500 text-white" },
  4: { selected: "border-brand-400 bg-brand-50 ring-2 ring-brand-200", dot: "bg-brand-600 text-white" },
  5: { selected: "border-mint-500 bg-mint-50 ring-2 ring-mint-200", dot: "bg-mint-600 text-white" },
};

interface Props {
  assessmentId: string;
  initialAnswers: Record<string, number>;
  startIndex: number;
}

export function QuestionStepper({ assessmentId, initialAnswers, startIndex }: Props) {
  const router = useRouter();
  const [idx, setIdx] = useState(startIndex);
  const [answers, setAnswers] = useState<Record<string, number>>(initialAnswers);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [direction, setDirection] = useState(1);
  const pendingRef = useRef<Set<string>>(new Set());
  const answersRef = useRef(answers);

  const question = QUESTIONS[idx];
  const answeredCount = useMemo(
    () => QUESTIONS.filter((q) => answers[q.id] !== undefined).length,
    [answers],
  );
  const progress = (answeredCount / TOTAL_QUESTIONS) * 100;
  const minutesLeft = Math.max(1, Math.ceil(((TOTAL_QUESTIONS - answeredCount) * SECONDS_PER_QUESTION) / 60));
  const chapterNumber = CHAPTERS.findIndex((c) => c.key === question.chapter) + 1;
  const chapterAnswered = QUESTIONS.filter(
    (q) => q.chapter === question.chapter && answers[q.id] !== undefined,
  ).length;

  /* ── persistence ─────────────────────────────────────────── */
  const flush = useCallback(
    async (ids?: string[]) => {
      const list = ids ?? Array.from(pendingRef.current);
      if (!list.length) return;
      setSaveState((s) => (s === "offline" ? "offline" : "saving"));
      try {
        const res = await fetch(`/api/assessments/${assessmentId}/answers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: list.map((questionId) => ({
              questionId,
              score: answersRef.current[questionId],
            })),
          }),
        });
        const json = await res.json().catch(() => ({ ok: false }));
        if (!res.ok || !json.ok) throw new Error("save failed");
        const next = new Set(pendingRef.current);
        for (const id of list) next.delete(id);
        pendingRef.current = next;
        setPending(next);
        setSaveState(next.size ? "saving" : "saved");
      } catch {
        setSaveState("offline");
      }
    },
    [assessmentId],
  );

  useEffect(() => {
    localStorage.setItem(LS_ANSWERS(assessmentId), JSON.stringify(answers));
  }, [answers, assessmentId]);

  /* Flush queue on reconnect, on an interval, and when leaving. */
  useEffect(() => {
    const onOnline = () => flush();
    const timer = window.setInterval(() => flush(), 5000);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [flush]);

  const select = useCallback(
    (qid: string, score: number) => {
      const nextAnswers = { ...answersRef.current, [qid]: score };
      answersRef.current = nextAnswers;
      setAnswers(nextAnswers);
      const next = new Set(pendingRef.current).add(qid);
      pendingRef.current = next;
      setPending(next);
      void flush([qid]);
      if (idx < QUESTIONS.length - 1) {
        window.setTimeout(() => {
          setDirection(1);
          setIdx((i) => Math.min(i + 1, QUESTIONS.length - 1));
        }, 340);
      }
    },
    [flush, idx],
  );

  const goTo = useCallback(
    (next: number) => {
      setDirection(next > idx ? 1 : -1);
      setIdx(Math.max(0, Math.min(next, QUESTIONS.length - 1)));
    },
    [idx],
  );

  const finish = useCallback(() => {
    const missing = QUESTIONS.findIndex((q) => answersRef.current[q.id] === undefined);
    if (missing !== -1) {
      goTo(missing);
      return;
    }
    void flush();
    router.push(`/analyzing/${assessmentId}`);
  }, [assessmentId, goTo, flush, router]);

  /* Keyboard shortcuts: 1–5 answer, arrows navigate, Enter continues. */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const n = Number(e.key);
      if (n >= 1 && n <= 5) select(QUESTIONS[idx].id, n);
      else if (e.key === "ArrowRight" && answersRef.current[QUESTIONS[idx].id] !== undefined) {
        idx === QUESTIONS.length - 1 ? finish() : goTo(idx + 1);
      } else if (e.key === "ArrowLeft") goTo(idx - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, select, goTo, finish]);

  const current = answers[question.id];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
      {/* status bar */}
      <div className="mb-6">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-[13px] font-medium text-slate-500">
          <span>
            Question <span className="font-bold text-slate-900">{idx + 1}</span> of {TOTAL_QUESTIONS}
          </span>
          <span className="flex items-center gap-3">
            <span aria-live="polite" className="inline-flex items-center gap-1.5">
              {saveState === "saving" && <><Loader2 className="size-3.5 animate-spin text-brand-500" /> Saving…</>}
              {saveState === "saved" && <><Check className="size-3.5 text-mint-600" /> Saved</>}
              {saveState === "offline" && (
                <><CloudOff className="size-3.5 text-amber-500" /> Offline — answers kept on this device</>
              )}
            </span>
            <span className="hidden text-slate-300 sm:inline">|</span>
            <span className="hidden sm:inline">~{minutesLeft} min left</span>
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* chapter tracker */}
      <div className="mb-6 flex flex-wrap gap-1.5" aria-label="Chapters">
        {CHAPTERS.map((c, i) => {
          const total = QUESTIONS.filter((q) => q.chapter === c.key).length;
          const done = QUESTIONS.filter(
            (q) => q.chapter === c.key && answers[q.id] !== undefined,
          ).length;
          const active = c.key === question.chapter;
          return (
            <span
              key={c.key}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                active
                  ? "bg-brand-700 text-white"
                  : done === total
                    ? "bg-mint-50 text-mint-700"
                    : done > 0
                      ? "bg-brand-50 text-brand-700"
                      : "bg-slate-100 text-slate-400",
              )}
              title={`${c.title} — ${done}/${total}`}
            >
              {i + 1}. {c.shortTitle}
            </span>
          );
        })}
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={question.id}
          custom={direction}
          initial={{ opacity: 0, x: 46 * direction }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -46 * direction }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card className="p-6 sm:p-9">
            <Badge variant="soft" className="mb-5">
              Chapter {chapterNumber} · {question.chapter ? CHAPTERS[chapterNumber - 1].title : ""} ·{" "}
              {chapterAnswered}/{QUESTIONS.filter((q) => q.chapter === question.chapter).length}
            </Badge>

            <h1 className="text-balance text-xl font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl">
              {question.text}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">{question.hint}</p>

            <fieldset className="mt-8">
              <legend className="sr-only">Rate this indicator from 1 (critical gap) to 5 (excellent)</legend>
              <div className="grid gap-2.5 sm:grid-cols-5">
                {RATING_OPTIONS.map((opt) => {
                  const selected = current === opt.value;
                  const style = OPTION_STYLES[opt.value];
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => select(question.id, opt.value)}
                      className={cn(
                        "group flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:flex-col sm:items-center sm:gap-2 sm:px-2 sm:py-5 sm:text-center",
                        selected && style.selected,
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-slate-50 text-sm font-extrabold text-slate-500 transition-colors group-hover:border-brand-300 group-hover:text-brand-700",
                          selected && style.dot,
                        )}
                      >
                        {opt.value}
                      </span>
                      <span className="min-w-0">
                        <span className={cn("block text-sm font-bold", selected ? "text-slate-900" : "text-slate-700")}>
                          {opt.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-slate-400 sm:hidden">
                          {opt.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 hidden text-center text-xs text-slate-400 sm:block">
                {current
                  ? RATING_OPTIONS.find((o) => o.value === current)?.description
                  : "Hover and pick the rating that best describes your school today — honesty beats optimism."}
              </p>
            </fieldset>

            <div className="mt-9 flex items-center justify-between gap-3 border-t border-slate-100 pt-6">
              <Button
                variant="ghost"
                onClick={() => goTo(idx - 1)}
                disabled={idx === 0}
                className="gap-1.5"
              >
                <ArrowLeft className="size-4" /> Previous
              </Button>
              <p className="hidden text-xs text-slate-400 md:block">
                Keys <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans">1–5</kbd> answer ·{" "}
                <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans">←</kbd>{" "}
                <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans">→</kbd> navigate
              </p>
              {idx === QUESTIONS.length - 1 ? (
                <Button variant="green" onClick={finish} disabled={current === undefined} className="gap-1.5">
                  Analyse My School <Sparkles className="size-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => goTo(idx + 1)}
                  disabled={current === undefined}
                  className="gap-1.5"
                >
                  Next <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
