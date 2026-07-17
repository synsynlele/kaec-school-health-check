"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Logo } from "@/components/site/Logo";
import {
  COUNTRIES,
  NIGERIAN_STATES,
  POPULATION_RANGES,
  SCHOOL_LEVELS,
  SCHOOL_TYPES,
} from "@/lib/questions";
import { QuestionStepper } from "./QuestionStepper";

const LS_ID = "kaec_assessment_id";

type Stage = "checking" | "details" | "questions";

export function AssessmentFlow() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("checking");
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [initialAnswers, setInitialAnswers] = useState<Record<string, number>>({});
  const [resumeIndex, setResumeIndex] = useState(0);
  const [resumed, setResumed] = useState(false);
  const [resumeVisible, setResumeVisible] = useState(false);

  /* On mount: look for an in-progress assessment on this device. */
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const stored = localStorage.getItem(LS_ID);
      if (!stored) {
        setStage("details");
        return;
      }
      try {
        const res = await fetch(`/api/assessments/${stored}`, { cache: "no-store" });
        if (!res.ok) throw new Error("gone");
        const data = await res.json();
        if (cancelled) return;
        if (!data.ok) throw new Error("gone");
        if (data.completed || data.hasReport) {
          localStorage.removeItem(LS_ID);
          router.replace(`/report/${stored}`);
          return;
        }
        const map: Record<string, number> = {};
        let firstMissing = -1;
        for (const a of data.answers as { questionId: string; score: number }[]) {
          map[a.questionId] = a.score;
        }
        const { QUESTIONS } = await import("@/lib/questions");
        for (let i = 0; i < QUESTIONS.length; i++) {
          if (map[QUESTIONS[i].id] === undefined) {
            firstMissing = i;
            break;
          }
        }
        setAssessmentId(stored);
        setInitialAnswers(map);
        setResumeIndex(firstMissing === -1 ? QUESTIONS.length - 1 : firstMissing);
        setResumed(Object.keys(map).length > 0);
        setResumeVisible(Object.keys(map).length > 0);
        setStage("questions");
      } catch {
        localStorage.removeItem(LS_ID);
        if (!cancelled) setStage("details");
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleCreated = useCallback((id: string) => {
    localStorage.setItem(LS_ID, id);
    setAssessmentId(id);
    setStage("questions");
  }, []);

  const startOver = useCallback(() => {
    localStorage.removeItem(LS_ID);
    setAssessmentId(null);
    setInitialAnswers({});
    setResumed(false);
    setResumeVisible(false);
    setStage("details");
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/60 via-white to-white">
      {/* wizard chrome */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <span className="hidden items-center gap-1.5 rounded-full bg-mint-50 px-3 py-1 text-xs font-semibold text-mint-700 sm:inline-flex">
          <Sparkles className="size-3.5" /> Free · no login · autosaves
        </span>
      </header>

      <AnimatePresence mode="wait">
        {stage === "checking" && (
          <motion.div
            key="checking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid min-h-[50vh] place-items-center"
          >
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="size-7 animate-spin text-brand-600" />
              <p className="text-sm font-medium">Preparing your assessment…</p>
            </div>
          </motion.div>
        )}

        {stage === "details" && (
          <motion.div
            key="details"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <SchoolDetailsForm onCreated={handleCreated} />
          </motion.div>
        )}

        {stage === "questions" && assessmentId && (
          <motion.div
            key="questions"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <AnimatePresence>
              {resumed && resumeVisible && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mx-auto mb-6 max-w-3xl px-4 sm:px-6"
                >
                  <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3.5">
                    <CheckCircle2 className="size-5 shrink-0 text-brand-700" />
                    <p className="grow text-sm font-medium text-brand-800">
                      Welcome back — your answers were saved. Picking up right where you stopped.
                    </p>
                    <button
                      type="button"
                      onClick={startOver}
                      className="hidden text-xs font-bold text-brand-700 underline-offset-2 hover:underline sm:block"
                    >
                      Start over
                    </button>
                    <button
                      type="button"
                      onClick={() => setResumeVisible(false)}
                      aria-label="Dismiss"
                      className="text-brand-400 hover:text-brand-700"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <QuestionStepper
              assessmentId={assessmentId}
              initialAnswers={initialAnswers}
              startIndex={resumeIndex}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Field({
  id,
  label,
  required = true,
  children,
  hint,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {required && <span className="text-brand-600">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function SchoolDetailsForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: data.get("schoolName"),
          contactName: data.get("contactName"),
          email: data.get("email"),
          phone: data.get("phone") ?? "",
          country: data.get("country"),
          state: data.get("state"),
          schoolType: data.get("schoolType"),
          schoolLevel: data.get("schoolLevel"),
          studentPopulation: data.get("studentPopulation"),
          staffPopulation: data.get("staffPopulation"),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Could not start the assessment.");
      onCreated(json.assessmentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Step 1 of 2</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          First, tell us about your school
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-slate-500">
          One minute. This personalises your report — and it is the only form you will fill.
          The assessment itself starts immediately after.
        </p>
      </div>

      <Card className="mt-10 p-6 sm:p-9">
        <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
          <Field id="schoolName" label="School name">
            <Input id="schoolName" name="schoolName" required maxLength={140} placeholder="e.g. Bright Futures Academy" autoComplete="organization" />
          </Field>
          <Field id="contactName" label="Your name">
            <Input id="contactName" name="contactName" required maxLength={140} placeholder="e.g. Adaeze Okafor" autoComplete="name" />
          </Field>
          <Field id="email" label="Email" hint="Your report is sent here automatically.">
            <Input id="email" name="email" type="email" required maxLength={160} placeholder="you@school.com" autoComplete="email" />
          </Field>
          <Field id="phone" label="Phone / WhatsApp" required={false}>
            <Input id="phone" name="phone" type="tel" maxLength={40} placeholder="+234 ..." autoComplete="tel" />
          </Field>
          <Field id="country" label="Country">
            <Select id="country" name="country" required defaultValue="Nigeria">
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field id="state" label="State / region">
            <Input id="state" name="state" required maxLength={80} placeholder="e.g. Lagos" list="states" />
            <datalist id="states">
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field id="schoolType" label="School type">
            <Select id="schoolType" name="schoolType" required defaultValue="">
              <option value="" disabled>Select type…</option>
              {SCHOOL_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field id="schoolLevel" label="School level">
            <Select id="schoolLevel" name="schoolLevel" required defaultValue="">
              <option value="" disabled>Select level…</option>
              {SCHOOL_LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </Select>
          </Field>
          <Field id="studentPopulation" label="Student population">
            <Select id="studentPopulation" name="studentPopulation" required defaultValue="">
              <option value="" disabled>Select range…</option>
              {POPULATION_RANGES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field id="staffPopulation" label="Staff population">
            <Select id="staffPopulation" name="staffPopulation" required defaultValue="">
              <option value="" disabled>Select range…</option>
              {POPULATION_RANGES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </Field>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:col-span-2">
              {error}
            </p>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" size="xl" className="group w-full" loading={busy}>
              Start Assessment
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
            <p className="mt-3 text-center text-xs text-slate-400">
              Your details are only used to generate and send your report. No account is created.
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
}
