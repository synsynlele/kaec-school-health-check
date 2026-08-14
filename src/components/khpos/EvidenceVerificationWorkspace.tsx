"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FileCheck2,
  FileUp,
  Loader2,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposEvidenceWorkspace } from "@/lib/khpos/evidence";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.txt";

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function requirementTone(status: string) {
  if (status === "accepted") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "needs_clarification") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function assessmentTone(state: string | undefined) {
  if (state === "accepted") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (state === "rejected") return "border-red-200 bg-red-50 text-red-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export function EvidenceVerificationWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] = useState<KhposEvidenceWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyPlanId, setBusyPlanId] = useState("");
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const token = data.session?.access_token;
      if (!token) {
        setError("Your session has ended. Return to the Command Centre and sign in again.");
        return;
      }

      const response = await fetch(`/api/khpos/evidence/${organisationId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = (await response.json()) as {
        ok?: boolean;
        workspace?: KhposEvidenceWorkspace;
        error?: string;
      };
      if (!active) return;
      if (!response.ok || !body.ok || !body.workspace) {
        setError(body.error ?? "The evidence workspace could not be loaded.");
        return;
      }
      setWorkspace(body.workspace);
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  async function submitEvidence(planId: string) {
    const file = files[planId];
    if (!supabase || !file) {
      setError("Choose an evidence file first.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Evidence files must be 8 MB or smaller.");
      return;
    }

    setBusyPlanId(planId);
    setError("");

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setBusyPlanId("");
      setError("Your session has ended. Sign in again to continue.");
      return;
    }

    try {
      const prepareResponse = await fetch(`/api/khpos/evidence/${organisationId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "prepare_upload",
          planId,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });
      const prepared = (await prepareResponse.json()) as {
        ok?: boolean;
        upload?: { submissionId: string; bucket: string; path: string; token: string };
        error?: string;
      };
      if (!prepareResponse.ok || !prepared.ok || !prepared.upload) {
        throw new Error(prepared.error ?? "Secure upload could not be prepared.");
      }

      const { error: uploadError } = await supabase.storage
        .from(prepared.upload.bucket)
        .uploadToSignedUrl(prepared.upload.path, prepared.upload.token, file, {
          contentType: file.type,
          cacheControl: "0",
        });
      if (uploadError) throw new Error("Evidence upload failed before assessment.");

      const assessResponse = await fetch(`/api/khpos/evidence/${organisationId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "assess",
          submissionId: prepared.upload.submissionId,
          note: notes[planId] ?? "",
        }),
      });
      const assessed = (await assessResponse.json()) as {
        ok?: boolean;
        workspace?: KhposEvidenceWorkspace;
        error?: string;
      };
      if (!assessResponse.ok || !assessed.ok || !assessed.workspace) {
        throw new Error(assessed.error ?? "Evidence assessment could not be completed.");
      }

      setWorkspace(assessed.workspace);
      setFiles((current) => ({ ...current, [planId]: null }));
      setNotes((current) => ({ ...current, [planId]: "" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Evidence automation failed.");
    } finally {
      setBusyPlanId("");
    }
  }

  if (!workspace && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-mint-400" />
          <p className="mt-4 text-sm font-semibold text-slate-300">Opening evidence intelligence…</p>
        </div>
      </main>
    );
  }

  if (error && !workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <ShieldCheck className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Evidence workspace unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <Link href={`/khpos/${organisationId}`} className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950">
            Return to Command Centre
          </Link>
        </div>
      </main>
    );
  }

  if (!workspace) return null;

  const plans = workspace.implementation.plans;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <Link href={`/khpos/${organisationId}/implementation`} className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white">
            <ArrowLeft className="size-4" /> Implementation
          </Link>
          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-mint-300">KHP-OS | Evidence & Verification</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Provide reality. KHP-OS does the evidence work.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                Upload the document, photo, PDF or record. Do not classify it. KHP-OS identifies what it apparently proves, tests sufficiency, updates implementation progress and prepares the next review.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-300">
              <BrainCircuit className="mb-2 size-5 text-mint-300" />
              System-assessed sufficiency is not a claim that a file is unquestionably authentic.
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 sm:py-10">
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <CircleAlert className="mt-0.5 size-5 shrink-0" /> {error}
          </div>
        )}

        {!plans.length && (
          <section className="rounded-[30px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <FileCheck2 className="mx-auto size-9 text-slate-400" />
            <h2 className="mt-4 text-2xl font-black">No active implementation plan yet.</h2>
            <p className="mt-2 text-sm text-slate-500">Approve a transformation priority first. KHP-OS will generate the plan and its evidence requirements automatically.</p>
          </section>
        )}

        {plans.map((plan) => {
          const planSubmissions = workspace.submissions.filter((item) => item.planId === plan.id);
          const preparations = workspace.reviewPreparations.filter((item) => item.planId === plan.id);
          const outcomePrep = preparations.find((item) =>
            plan.reviews.some((review) => review.id === item.reviewScheduleId && review.reviewType === "outcome"),
          );
          const acceptedRequirements = plan.evidenceRequirements.filter((r) => r.status === "accepted").length;
          const requiredRequirements = plan.evidenceRequirements.filter((r) => r.required).length;
          const coverage = outcomePrep?.coveragePercent ?? (requiredRequirements ? Math.round((acceptedRequirements / requiredRequirements) * 100) : 0);
          const busy = busyPlanId === plan.id;

          return (
            <section key={plan.id} className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-950 p-6 text-white sm:p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint-300">{plan.priority.systemName}</p>
                    <h2 className="mt-2 text-2xl font-black">{plan.intervention.title}</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{plan.objective}</p>
                  </div>
                  <div className="min-w-44 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Evidence coverage</p>
                    <p className="mt-1 text-3xl font-black">{coverage}%</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-mint-300" style={{ width: `${Math.min(100, Math.max(0, coverage))}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 p-6 sm:p-8 xl:grid-cols-[0.95fr_1.05fr]">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">System-generated requirements</p>
                  <div className="mt-4 space-y-3">
                    {plan.evidenceRequirements.map((requirement) => (
                      <div key={requirement.id} className={`rounded-2xl border p-4 ${requirementTone(requirement.status)}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-extrabold">{requirement.title}</p>
                            <p className="mt-1 text-xs leading-5 opacity-80">{requirement.description}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide">{requirement.status.replaceAll("_", " ")}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!!preparations.length && (
                    <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50 p-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Review preparation</p>
                      {preparations.map((prep) => {
                        const schedule = plan.reviews.find((review) => review.id === prep.reviewScheduleId);
                        return (
                          <div key={prep.reviewScheduleId} className="mt-3 border-t border-brand-100 pt-3 first:border-0 first:pt-0">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-extrabold capitalize">{schedule?.reviewType ?? "review"}</p>
                              <span className="text-xs font-bold uppercase text-brand-700">{prep.readiness.replaceAll("_", " ")}</span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{prep.acceptedCount}/{prep.requiredCount} required evidence items accepted · {prep.coveragePercent}% coverage</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <div className="rounded-3xl border border-dashed border-brand-300 bg-brand-50/50 p-5 sm:p-6">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-2xl bg-brand-950 text-white"><UploadCloud className="size-5" /></span>
                      <div>
                        <p className="font-black">Provide evidence</p>
                        <p className="text-xs text-slate-500">No category selection required.</p>
                      </div>
                    </div>
                    <input
                      className="mt-5 block w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                      type="file"
                      accept={ACCEPT}
                      disabled={busy}
                      onChange={(event) => setFiles((current) => ({ ...current, [plan.id]: event.target.files?.[0] ?? null }))}
                    />
                    <textarea
                      className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-brand-500"
                      placeholder="Optional context: what happened, when, or anything KHP-OS should know. Do not classify the evidence."
                      value={notes[plan.id] ?? ""}
                      maxLength={2000}
                      disabled={busy}
                      onChange={(event) => setNotes((current) => ({ ...current, [plan.id]: event.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => void submitEvidence(plan.id)}
                      disabled={busy || !files[plan.id]}
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-950 px-5 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
                      {busy ? "Uploading and assessing…" : "Submit evidence"}
                    </button>
                    <p className="mt-3 text-[11px] leading-5 text-slate-400">Private storage · PDF/JPG/PNG/WebP/TXT · maximum 8 MB · KHP-OS chooses the matching requirement automatically.</p>
                  </div>

                  <div className="mt-5 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Evidence intelligence history</p>
                    {!planSubmissions.length && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No evidence has been supplied for this intervention yet.</p>}
                    {planSubmissions.map((submission) => (
                      <div key={submission.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-extrabold text-slate-900">{submission.filename ?? submission.title}</p>
                            <p className="mt-1 text-xs text-slate-400">{formatDate(submission.createdAt)}</p>
                          </div>
                          {submission.assessment && (
                            <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${assessmentTone(submission.assessment.state)}`}>
                              {submission.assessment.state.replaceAll("_", " ")}
                            </span>
                          )}
                        </div>
                        {submission.assessment && <p className="mt-3 text-xs leading-5 text-slate-600">{submission.assessment.summary}</p>}
                        {!!submission.matches.length && (
                          <div className="mt-3 space-y-2">
                            {submission.matches.map((match) => {
                              const requirement = plan.evidenceRequirements.find((item) => item.id === match.requirementId);
                              return (
                                <div key={match.requirementId} className="rounded-xl bg-slate-50 p-3 text-xs">
                                  <p className="font-bold text-slate-800">{requirement?.title ?? "Matched requirement"}</p>
                                  <p className="mt-1 leading-5 text-slate-500">{match.whatItProves}</p>
                                  <p className="mt-2 font-semibold text-slate-400">Match {Math.round(match.confidence)}% · Sufficiency {Math.round(match.sufficiencyScore)}%</p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {submission.viewUrl && (
                          <a href={submission.viewUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:underline">
                            View private evidence <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        {!!plans.length && (
          <section className="rounded-[30px] bg-slate-950 p-6 text-white sm:p-8">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="mt-1 size-6 shrink-0 text-mint-300" />
              <div>
                <p className="text-lg font-black">Human workload stays narrow.</p>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">People execute the real intervention and provide real evidence. KHP-OS handles classification, sufficiency scoring, progress updates, evidence gaps and review preparation. Ambiguous evidence is flagged rather than silently accepted.</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
