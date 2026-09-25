"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { CouncilWorkspace } from "@/lib/khpos/ops/council";

export function BuildersCouncilWorkspace({ organisationId }: { organisationId: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [data, setData] = useState<CouncilWorkspace | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (key: string, value: string) => setFields((old) => ({ ...old, [key]: value }));

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(async ({ data: session }) => {
      if (!session.session?.access_token) { if (active) setError("Sign in to continue."); return; }
      try {
        const response = await fetch(`/api/khpos/ops/council/${organisationId}`, {
          headers: { Authorization: `Bearer ${session.session.access_token}` }, cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Council could not be loaded.");
        if (active) setData(result.council);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Council could not be loaded."); }
    });
    return () => { active = false; };
  }, [organisationId, supabase]);

  async function act(mode: string, input: Record<string, unknown>) {
    if (!supabase) return;
    setBusy(true); setError("");
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error("Sign in to continue.");
      const response = await fetch(`/api/khpos/ops/council/${organisationId}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.session.access_token}` },
        body: JSON.stringify({ mode, ...input }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Council action failed.");
      setData(result.council); setFields({});
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Council action failed."); }
    finally { setBusy(false); }
  }

  const input = (key: string, label: string, placeholder = "") => <label className="block text-sm font-medium text-slate-700">{label}<input aria-label={label} value={fields[key] || ""} placeholder={placeholder} onChange={(event) => set(key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900" /></label>;
  const select = (key: string, label: string, options: { value: string; label: string }[]) => <label className="block text-sm font-medium text-slate-700">{label}<select aria-label={label} value={fields[key] || ""} onChange={(event) => set(key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900"><option value="">Choose…</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  const button = (label: string, onClick: () => void, disabled = false) => <button type="button" disabled={busy || disabled} onClick={onClick} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : label}</button>;
  const learners = data?.learners.map((l) => ({ value: l.id, label: `${l.name} · ${l.classLabel}` })) || [];

  return <main className="mx-auto max-w-6xl space-y-6 p-5 text-slate-900">
    <div><h1 className="text-3xl font-bold">Builders Council</h1><p className="mt-2 text-slate-600">Student representation, service and accountable leadership. Student voice is recorded with evidence; this is not an online ballot.</p></div>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-800">{error}</p>}
    {!data && !error && <p>Loading council…</p>}
    {data && !data.canManage && <p>You can view council decisions. A School Guardian or Sectional Promoter manages council records.</p>}
    {data?.canManage && <section className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-3"><h2 className="md:col-span-3 text-xl font-bold">Start a session</h2>{select("campus", "Campus", data.campuses.map((c) => ({ value: c.id, label: c.name })))}{input("session", "Session", "2026/2027")}{button("Create council cycle", () => void act("create_cycle", { campusId: fields.campus, sessionLabel: fields.session }), !fields.campus || !fields.session)}</section>}
    {data?.cycles.map((cycle) => <section key={cycle.id} className="space-y-4 rounded-xl border border-slate-200 p-4"><h2 className="text-xl font-bold">{cycle.sessionLabel} · {data.campuses.find((c) => c.id === cycle.campusId)?.name || "Campus"}</h2>
      {data.canManage && cycle.status === "open" && <div className="grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-3">{input(`title-${cycle.id}`, "Seat title", "Community Catalyst")}{select(`type-${cycle.id}`, "Seat type", [{ value: "class_representative", label: "Class representative" }, { value: "senior_leadership", label: "Senior leadership" }])}{input(`class-${cycle.id}`, "Class for representative", "JSS1")}{input(`mission-${cycle.id}`, "Service mission", "Gather learner concerns and lead a response")}{button("Create seat", () => void act("create_seat", { cycleId: cycle.id, title: fields[`title-${cycle.id}`], seatType: fields[`type-${cycle.id}`], classLabel: fields[`type-${cycle.id}`] === "class_representative" ? fields[`class-${cycle.id}`] : null, mission: fields[`mission-${cycle.id}`] }), !fields[`title-${cycle.id}`] || !fields[`type-${cycle.id}`] || !fields[`mission-${cycle.id}`])}</div>}
      {cycle.seats.map((seat) => <article key={seat.id} className="space-y-3 rounded-lg border border-slate-200 p-3"><h3 className="font-bold">{seat.title} · {seat.status}</h3><p className="text-sm text-slate-600">{seat.mission}{seat.classLabel ? ` · ${seat.classLabel}` : ""}</p>
        {data.canManage && seat.status === "open" && <div className="grid gap-2 md:grid-cols-3">{select(`learner-${seat.id}`, "Nominee", learners.filter((l) => { const student = data.learners.find((x) => x.id === l.value); return student?.campusId === cycle.campusId && (seat.seatType === "class_representative" ? student.classLabel.toLowerCase() === seat.classLabel?.toLowerCase() : /^SS[12]/i.test(student?.classLabel.replace(/[^a-z0-9]/gi, "") || "")); }))}{input(`statement-${seat.id}`, "Why this learner? ")}{input(`evidence-${seat.id}`, "Nomination evidence reference")}{button("Nominate", () => void act("nominate", { seatId: seat.id, learnerId: fields[`learner-${seat.id}`], statement: fields[`statement-${seat.id}`], evidence: fields[`evidence-${seat.id}`] }), !fields[`learner-${seat.id}`] || !fields[`statement-${seat.id}`] || !fields[`evidence-${seat.id}`])}</div>}
        {seat.candidates.map((candidate) => <div key={candidate.id} className="space-y-2 border-t border-slate-200 pt-3"><p className="font-semibold">{data.learners.find((l) => l.id === candidate.learnerId)?.name || "Learner"} · {candidate.status}</p><p className="text-sm">{candidate.nominationStatement}</p>{candidate.studentVoiceSummary && <p className="text-sm">Student voice: {candidate.studentVoiceSummary}</p>}
          {data.canManage && candidate.status === "nominated" && <div className="flex flex-wrap gap-2">{input(`eligibility-${candidate.id}`, "Eligibility finding")}{button("Eligible", () => void act("eligibility", { candidateId: candidate.id, outcome: "eligible", note: fields[`eligibility-${candidate.id}`] }), !fields[`eligibility-${candidate.id}`])}{button("Ineligible", () => void act("eligibility", { candidateId: candidate.id, outcome: "ineligible", note: fields[`eligibility-${candidate.id}`] }), !fields[`eligibility-${candidate.id}`])}</div>}
          {data.canManage && candidate.status === "eligible" && <div className="grid gap-2 md:grid-cols-2">{input(`voice-${candidate.id}`, "Student voice summary")}{input(`voice-evidence-${candidate.id}`, "Student voice evidence reference")}{button("Record student voice", () => void act("voice", { candidateId: candidate.id, summary: fields[`voice-${candidate.id}`], evidence: fields[`voice-evidence-${candidate.id}`] }), !fields[`voice-${candidate.id}`] || !fields[`voice-evidence-${candidate.id}`])}{candidate.studentVoiceEvidence && seat.status === "open" && button("Validate appointment", () => void act("appoint", { candidateId: candidate.id }))}</div>}
          {candidate.reviews.map((review) => <p key={review.id} className="text-sm text-slate-600">{review.type}: {review.decision} — {review.finding}</p>)}
          {data.canManage && candidate.status === "appointed" && <div className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-3">{select(`type-${candidate.id}`, "Review type", [{ value: "routine", label: "Routine" }, { value: "concern", label: "Concern" }, { value: "recall", label: "Recall hearing" }])}{select(`decision-${candidate.id}`, "Decision", [{ value: "continue", label: "Continue" }, { value: "support_plan", label: "Support plan" }, { value: "remove", label: "Recall and reopen seat" }])}{input(`finding-${candidate.id}`, "Finding")}{input(`review-evidence-${candidate.id}`, "Evidence reference")}{fields[`decision-${candidate.id}`] === "support_plan" && <>{select(`owner-${candidate.id}`, "Support owner", data.assignments.map((a) => ({ value: a.id, label: a.title })))}{input(`due-${candidate.id}`, "Support due date YYYY-MM-DD")}</>}{fields[`decision-${candidate.id}`] === "remove" && <>{input(`response-${candidate.id}`, "Learner response or recorded decline")}{input(`offered-${candidate.id}`, "Response offered at ISO date/time")}</>}{button("Record review", () => void act("review", { candidateId: candidate.id, type: fields[`type-${candidate.id}`], decision: fields[`decision-${candidate.id}`], finding: fields[`finding-${candidate.id}`], evidence: fields[`review-evidence-${candidate.id}`], actionOwnerId: fields[`owner-${candidate.id}`] || null, actionDueDate: fields[`due-${candidate.id}`] || null, response: fields[`response-${candidate.id}`] || null, responseOfferedAt: fields[`offered-${candidate.id}`] || null }), !fields[`type-${candidate.id}`] || !fields[`decision-${candidate.id}`] || !fields[`finding-${candidate.id}`] || !fields[`review-evidence-${candidate.id}`])}</div>}
        </div>)}
      </article>)}
    </section>)}
  </main>;
}
