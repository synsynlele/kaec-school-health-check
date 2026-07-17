"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  BookOpenText,
  Calculator,
  Check,
  ClipboardList,
  FileCheck2,
  Lightbulb,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { TOTAL_QUESTIONS } from "@/lib/questions";
import { cn } from "@/lib/utils";

const STAGES = [
  { icon: BookOpenText, label: `Reading all ${TOTAL_QUESTIONS} responses…` },
  { icon: ClipboardList, label: "Benchmarking your school against best practice…" },
  { icon: Calculator, label: "Calculating health score across 11 departments…" },
  { icon: BarChart3, label: "Identifying your strengths and weaknesses…" },
  { icon: Lightbulb, label: "Generating recommendations and your 90-day plan…" },
  { icon: FileCheck2, label: "Preparing your professional report…" },
];

const MIN_SCREEN_MS = 8200;

export function Analyzer({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const startedAt = Date.now();
    let cancelled = false;
    let raf = 0;

    const tick = () => {
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      // ease toward 92% over ~26 seconds while the AI works
      const t = Math.min(1, elapsed / 26000);
      const eased = 92 * (1 - Math.pow(1 - t, 2.2));
      setProgress((p) => (doneRef.current ? p : Math.max(p, eased)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    (async () => {
      try {
        const res = await fetch(`/api/assessments/${assessmentId}/analyze`, {
          method: "POST",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          if (json?.answered !== undefined) {
            router.replace("/assessment");
            return;
          }
          throw new Error(json?.error || "Analysis failed");
        }
        doneRef.current = true;
        const wait = Math.max(0, MIN_SCREEN_MS - (Date.now() - startedAt));
        window.setTimeout(() => {
          if (cancelled) return;
          setProgress(100);
          window.setTimeout(() => {
            router.replace(json.reportUrl ?? `/report/${assessmentId}`);
          }, 700);
        }, wait);
      } catch (err) {
        if (cancelled) return;
        cancelAnimationFrame(raf);
        setError(
          err instanceof Error && err.message
            ? err.message
            : "The analysis was interrupted. Your answers are safe.",
        );
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [assessmentId, router, retryKey]);

  const stageIndex = Math.min(STAGES.length - 1, Math.floor((progress / 100) * STAGES.length));

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-gradient-to-b from-brand-50/70 via-white to-white px-4 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-100/50 blur-3xl" />
      </div>

      <div className="relative w-full max-w-xl">
        <div className="mb-10 flex justify-center">
          <Logo />
        </div>

        {!error ? (
          <>
            {/* pulsing core */}
            <div className="relative mx-auto mb-10 grid size-28 place-items-center">
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-50" />
              <span className="absolute inset-3 rounded-full border border-brand-100 bg-white shadow-soft" />
              <motion.span
                key={stageIndex}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="relative grid size-12 place-items-center rounded-2xl bg-brand-700 text-white shadow-[0_8px_20px_rgb(15_79_216/0.35)]"
              >
                {(() => {
                  const Icon = STAGES[stageIndex].icon;
                  return <Icon className="size-6" />;
                })()}
              </motion.span>
            </div>

            <h1 className="text-center text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Analysing your school…
            </h1>
            <p className="mt-2 text-center text-sm text-slate-500">
              KAEC&apos;s AI is reviewing every answer you gave. This takes a few seconds.
            </p>

            {/* progress */}
            <div className="mx-auto mt-8 max-w-md">
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-600 via-brand-500 to-mint-500 transition-[width] duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-right text-xs font-bold tabular-nums text-brand-700">
                {Math.round(progress)}%
              </p>
            </div>

            {/* stage list */}
            <ul className="mx-auto mt-6 max-w-md space-y-2.5" aria-live="polite">
              {STAGES.map((s, i) => {
                const state = i < stageIndex ? "done" : i === stageIndex ? "active" : "todo";
                return (
                  <motion.li
                    key={s.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: state === "todo" ? 0.45 : 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
                      state === "done" && "border-mint-100 bg-mint-50/60 text-mint-800",
                      state === "active" && "border-brand-200 bg-white text-slate-900 shadow-soft",
                      state === "todo" && "border-slate-100 bg-white/60 text-slate-400",
                    )}
                  >
                    {state === "done" ? (
                      <Check className="size-4.5 shrink-0 text-mint-600" />
                    ) : state === "active" ? (
                      <Loader2 className="size-4.5 shrink-0 animate-spin text-brand-600" />
                    ) : (
                      <span className="size-4.5 shrink-0 rounded-full border border-slate-200" />
                    )}
                    {s.label}
                  </motion.li>
                );
              })}
            </ul>
          </>
        ) : (
          <div className="rounded-3xl border border-red-100 bg-white p-8 text-center shadow-soft">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-red-50">
              <TriangleAlert className="size-6 text-red-500" />
            </span>
            <h1 className="mt-4 text-xl font-bold text-slate-900">Analysis interrupted</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{error}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={() => { setError(""); setProgress(0); doneRef.current = false; setRetryKey((k) => k + 1); }}>
                Try again
              </Button>
              <Button variant="outline" onClick={() => router.replace("/assessment")}>
                Back to assessment
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
