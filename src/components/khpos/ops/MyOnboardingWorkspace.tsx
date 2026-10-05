"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FileCheck2,
  Loader2,
  ShieldCheck,
  UsersRound,
  Workflow,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  KHPOS_PRACTICE_STEPS,
  type KhposMyOnboarding,
} from "@/lib/khpos/ops/onboarding";

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function statusClass(status: string) {
  if (["completed", "active", "ready"].includes(status)) {
    return "bg-emerald-50 text-emerald-800";
  }
  if (status === "submitted") return "bg-brand-50 text-brand-800";
  return "bg-amber-50 text-amber-900";
}

export function MyOnboardingWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [data, setData] = useState<KhposMyOnboarding | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sampleEvidence, setSampleEvidence] = useState("");

  const accessToken = useCallback(async () => {
    if (!supabase) throw new Error("KHP-OS sign-in is not configured.");
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.access_token) {
      throw new Error("Your session has ended. Sign in again.");
    }
    return session.session.access_token;
  }, [supabase]);

  const load = useCallback(async () => {
    const token = await accessToken();
    const response = await fetch(
      `/api/khpos/ops/onboarding/${organisationId}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    const body = (await response.json()) as {
      ok?: boolean;
      onboarding?: KhposMyOnboarding;
      error?: string;
    };
    if (!response.ok || !body.ok || !body.onboarding) {
      throw new Error(body.error ?? "My Onboarding could not be loaded.");
    }
    setData(body.onboarding);
  }, [accessToken, organisationId]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void load().catch((cause) => {
      if (active) {
        setError(
          cause instanceof Error
            ? cause.message
            : "My Onboarding could not be loaded.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, [load, supabase]);

  async function post(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setError("");
    try {
      const token = await accessToken();
      const response = await fetch(
        `/api/khpos/ops/onboarding/${organisationId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        onboarding?: KhposMyOnboarding;
        error?: string;
      };
      if (!response.ok || !body.ok || !body.onboarding) {
        throw new Error(body.error ?? "Onboarding action could not be saved.");
      }
      setData(body.onboarding);
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Onboarding action could not be saved.",
      );
      return false;
    } finally {
      setBusy("");
    }
  }

  async function completePracticeStep(code: string) {
    if (!data) return;
    if (code === "start_work" && answers[code] !== "today") {
      setError("In KHP-OS, controlled work starts from Today / My Work—not from an informal message.");
      return;
    }
    if (code === "complete_checklist" && answers[code] !== "before") {
      setError("Required checklist controls are completed before work is closed.");
      return;
    }
    if (code === "attach_evidence" && sampleEvidence.trim().length < 20) {
      setError("Write a short sample evidence note of at least 20 characters. It stays inside this simulation.");
      return;
    }
    if (code === "handle_return" && answers[code] !== "correct") {
      setError("Returned work should be corrected and resubmitted in the same controlled record.");
      return;
    }

    const next = Array.from(
      new Set([...data.practice.completedSteps, code]),
    );
    await post({ mode: "practice", completedSteps: next }, `practice-${code}`);
  }

  async function submitItem(
    item: KhposMyOnboarding["onboarding"][number],
  ) {
    const note = notes[item.id]?.trim() ?? "";
    const ref = evidence[item.id]?.trim() ?? "";
    if (item.evidenceRequired && !ref && !item.evidenceReference) {
      setError("This onboarding item requires an evidence reference.");
      return;
    }
    const ok = await post(
      {
        mode: "submit_item",
        itemId: item.id,
        note: note || null,
        evidenceReference: ref || null,
      },
      `item-${item.id}`,
    );
    if (ok) {
      setNotes((current) => ({ ...current, [item.id]: "" }));
      setEvidence((current) => ({ ...current, [item.id]: "" }));
    }
  }

  if (!data && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <Loader2 className="size-9 animate-spin text-mint-300" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <CircleAlert className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">My Onboarding unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
        </div>
      </main>
    );
  }

  const completedItems = data.onboarding.filter((item) =>
    ["completed", "waived"].includes(item.status),
  ).length;
  const practiceComplete = data.practice.status === "completed";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-black text-mint-200">
              Learn the role before carrying the role
            </span>
            <Link
              href={`/khpos/${organisationId}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black"
            >
              <ArrowLeft className="size-4" />
              Command Centre
            </Link>
          </div>
          <h1 className="mt-5 text-3xl font-black sm:text-5xl">My Onboarding</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100">
            Understand your role, required policies, operating processes and the
            KHP-OS workflow before you are expected to execute independently.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-bold text-brand-100">Role</p>
              <p className="mt-1 text-lg font-black">
                {data.role?.title ?? "Not assigned"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-bold text-brand-100">Staff status</p>
              <p className="mt-1 text-lg font-black capitalize">
                {data.staff?.status ? readable(data.staff.status) : "No staff record"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-bold text-brand-100">Onboarding</p>
              <p className="mt-1 text-2xl font-black">
                {completedItems}/{data.onboarding.length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-bold text-brand-100">Guided practice</p>
              <p className="mt-1 text-lg font-black">
                {practiceComplete ? "Completed" : "In progress"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}

        {data.charter && (
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <UsersRound className="size-6 text-brand-700" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
                  Active Role Charter
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  {data.role?.title}
                </h2>
              </div>
            </div>
            <p className="mt-5 rounded-2xl bg-slate-950 p-5 text-sm font-semibold leading-7 text-white">
              {data.charter.mission}
            </p>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {[
                ["Outcomes you own", data.charter.ownedOutcomes],
                ["Responsibilities", data.charter.responsibilities],
                ["Decision rights", data.charter.decisionRights],
                ["Escalation rules", data.charter.escalationRules],
                ["How your role is measured", data.charter.kpis],
              ].map(([title, values]) => (
                <div key={String(title)} className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    {String(title)}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                    {(values as string[]).map((value) => (
                      <li key={value} className="flex gap-2">
                        <CheckCircle2 className="mt-1 size-3.5 shrink-0 text-mint-700" />
                        <span>{value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-[30px] border border-brand-200 bg-brand-50 p-6 shadow-sm sm:p-7">
          <div className="flex items-center gap-3">
            <Workflow className="size-6 text-brand-700" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
                Safe practice environment
              </p>
              <h2 className="mt-1 text-2xl font-black">
                Practice the KHP-OS operating loop
              </h2>
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
            Nothing here creates production work, reports or evidence. Complete
            the five-step simulation to demonstrate that you understand the
            operating workflow.
          </p>

          <div className="mt-6 space-y-3">
            {KHPOS_PRACTICE_STEPS.map((step, index) => {
              const done = data.practice.completedSteps.includes(step.code);
              const priorDone =
                index === 0 ||
                data.practice.completedSteps.includes(
                  KHPOS_PRACTICE_STEPS[index - 1].code,
                );
              const disabled = done || !priorDone || busy.startsWith("practice-");

              return (
                <div
                  key={step.code}
                  className={`rounded-2xl border p-5 ${
                    done
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-brand-100 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-black ${
                        done
                          ? "bg-emerald-700 text-white"
                          : "bg-slate-950 text-white"
                      }`}
                    >
                      {done ? <CheckCircle2 className="size-4" /> : index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-black">{step.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {step.detail}
                      </p>

                      {!done && priorDone && (
                        <div className="mt-4">
                          {step.code === "find_process" && (
                            <Link
                              href={`/khpos/${organisationId}/library?tab=processes`}
                              className="inline-flex items-center gap-2 text-sm font-black text-brand-700"
                            >
                              <BookOpen className="size-4" />
                              Open the Process Library
                            </Link>
                          )}
                          {step.code === "start_work" && (
                            <select
                              value={answers[step.code] ?? ""}
                              onChange={(event) =>
                                setAnswers((current) => ({
                                  ...current,
                                  [step.code]: event.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                            >
                              <option value="">Where should controlled work start?</option>
                              <option value="message">A WhatsApp instruction</option>
                              <option value="today">Today / My Work</option>
                              <option value="memory">From memory without a process</option>
                            </select>
                          )}
                          {step.code === "complete_checklist" && (
                            <select
                              value={answers[step.code] ?? ""}
                              onChange={(event) =>
                                setAnswers((current) => ({
                                  ...current,
                                  [step.code]: event.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                            >
                              <option value="">When are required checklist controls completed?</option>
                              <option value="after">After closing the work</option>
                              <option value="before">Before the work can close</option>
                            </select>
                          )}
                          {step.code === "attach_evidence" && (
                            <textarea
                              rows={3}
                              value={sampleEvidence}
                              onChange={(event) => setSampleEvidence(event.target.value)}
                              placeholder="Write a sample evidence note. This stays in the simulation only."
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                            />
                          )}
                          {step.code === "handle_return" && (
                            <select
                              value={answers[step.code] ?? ""}
                              onChange={(event) =>
                                setAnswers((current) => ({
                                  ...current,
                                  [step.code]: event.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                            >
                              <option value="">What happens when verification returns work?</option>
                              <option value="duplicate">Create a fresh duplicate record</option>
                              <option value="ignore">Ignore it and move on</option>
                              <option value="correct">Correct the returned record and resubmit</option>
                            </select>
                          )}

                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => void completePracticeStep(step.code)}
                            className="mt-3 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                          >
                            {busy === `practice-${step.code}`
                              ? "Checking…"
                              : "Complete practice step"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {practiceComplete && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-100 p-4 text-sm text-emerald-950">
              <BadgeCheck className="mt-0.5 size-5 shrink-0" />
              <p>
                Guided practice completed. If you have a linked staff onboarding
                record, PEO-ONB-007 has been system-verified automatically.
              </p>
            </div>
          )}
        </section>

        {data.onboarding.length > 0 && (
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="size-6 text-brand-700" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
                  Appointment readiness
                </p>
                <h2 className="mt-1 text-2xl font-black">Your onboarding controls</h2>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {data.onboarding.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase text-brand-700">
                        {item.code} · {readable(item.category)}
                      </p>
                      <h3 className="mt-1 font-black">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {item.description}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase ${statusClass(item.status)}`}>
                      {readable(item.status)}
                    </span>
                  </div>

                  {item.status === "pending" && item.code !== "PEO-ONB-007" && (
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <textarea
                        rows={2}
                        value={notes[item.id] ?? ""}
                        onChange={(event) =>
                          setNotes((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        placeholder="What did you complete or understand?"
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {item.evidenceRequired && (
                        <input
                          value={evidence[item.id] ?? ""}
                          onChange={(event) =>
                            setEvidence((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          placeholder="Evidence reference"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      )}
                      <button
                        type="button"
                        disabled={busy === `item-${item.id}`}
                        onClick={() => void submitItem(item)}
                        className="w-fit rounded-full bg-brand-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                      >
                        Submit for verification
                      </button>
                    </div>
                  )}

                  {item.reviewNote && (
                    <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                      Review: {item.reviewNote}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-brand-700" />
              <h2 className="text-xl font-black">Policies required for your role</h2>
            </div>
            <div className="mt-4 space-y-2">
              {data.requiredPolicies.map((policy) => (
                <Link
                  key={policy.id}
                  href={`/khpos/${organisationId}/library?tab=policies&q=${encodeURIComponent(policy.code)}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 hover:border-brand-300"
                >
                  <span>
                    <span className="block text-xs font-black text-brand-700">{policy.code}</span>
                    <span className="mt-1 block text-sm font-bold">{policy.name}</span>
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                    policy.acknowledged
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-amber-50 text-amber-900"
                  }`}>
                    {policy.acknowledged ? "Acknowledged" : "Open"}
                  </span>
                </Link>
              ))}
              {!data.requiredPolicies.length && (
                <p className="text-sm text-slate-500">No role-specific policy list is active yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <FileCheck2 className="size-5 text-brand-700" />
              <h2 className="text-xl font-black">Processes you participate in</h2>
            </div>
            <div className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto">
              {data.relevantProcesses.map((process) => (
                <Link
                  key={process.id}
                  href={`/khpos/${organisationId}/library?tab=processes&q=${encodeURIComponent(process.code)}`}
                  className="block rounded-2xl border border-slate-200 p-4 hover:border-brand-300"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-black text-brand-700">{process.code}</span>
                    <span className="text-[10px] font-black uppercase text-slate-500">
                      {readable(process.participation)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold">{process.title}</p>
                  {!process.published && (
                    <p className="mt-1 text-xs text-amber-700">
                      Process document not yet published.
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
