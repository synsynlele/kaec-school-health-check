"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, School, BookOpenCheck, AlertCircle, Loader2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { announceKhposActivityChanged, KHPOS_ACTIVITY_CHANGED } from "@/lib/khpos/ops/action-events";
import { attendanceSteps, type AttendanceStep } from "@/lib/khpos/ops/attendance-guidance";
import type { KhposPresenceWorkspace } from "@/lib/khpos/ops/presence";

function recordedAt(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value)) : "Not recorded";
}

function statusLabel(step: AttendanceStep) {
  switch (step.status) {
    case "done": return "Recorded";
    case "due": return "Do this now";
    case "blocked": return "Finish the step before this";
    case "missed": return "Check-in window closed";
    default: return "Not due yet";
  }
}

function AttendanceRow({
  step, organisationId, busy, onRecord,
}: {
  step: AttendanceStep; organisationId: string; busy: boolean;
  onRecord: (kind: "school_in" | "school_out" | "class_in", periodId: string | null) => void;
}) {
  const lessonUrl = `/khpos/${organisationId}/teaching-presence?tab=lessons${step.periodId ? "&period=" + encodeURIComponent(step.periodId) : ""}`;
  const schoolUrl = `/khpos/${organisationId}/teaching-presence?tab=day`;
  const direct = step.kind === "school_in" || step.kind === "school_out" || step.kind === "class_in";
  const canRecord = direct && step.status !== "done" && step.status !== "missed" &&
    (step.kind === "school_in" || step.kind === "school_out"
      ? step.status !== "blocked"
      : step.status === "due");
  const destination = step.kind.startsWith("class") ? lessonUrl : schoolUrl;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-black text-slate-900">{step.title}</p>
          {step.schedule && <p className="mt-1 text-xs text-slate-600">Scheduled: {step.schedule} (Nigeria time)</p>}
        </div>
        <span className={"rounded-full px-3 py-1 text-xs font-bold " +
          (step.status === "done" ? "bg-emerald-50 text-emerald-800" :
            step.status === "due" ? "bg-amber-100 text-amber-900" :
            step.status === "missed" ? "bg-rose-50 text-rose-800" :
            "bg-slate-100 text-slate-700")}>{statusLabel(step)}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{step.instruction}</p>
      {step.recordedAt && (
        <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="size-4" /> Recorded: {recordedAt(step.recordedAt)}
        </p>
      )}
      {step.status !== "done" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canRecord && step.kind !== "school_out" &&
            <button type="button" disabled={busy} onClick={() => onRecord(step.kind as "school_in" | "class_in", step.periodId)}
              className="rounded-full bg-brand-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50">
              {step.actionLabel}
            </button>}
          {canRecord && step.kind === "school_out" &&
            <button type="button" disabled={busy} onClick={() => onRecord("school_out", null)}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white disabled:opacity-50">
              Record school departure
            </button>}
          <Link href={destination} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-black text-slate-800">
            {step.kind === "class_out" ? "Record lesson outcome" : step.status === "missed" ? "Open attendance help" : "Open attendance"}
          </Link>
        </div>
      )}
    </div>
  );
}

export function TodayAttendanceCard({ organisationId }: { organisationId: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [presence, setPresence] = useState<KhposPresenceWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [campusId, setCampusId] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!supabase) { setError("Sign in to see school attendance."); setLoading(false); return; }
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) throw new Error("Your session has ended. Sign in to continue.");
      const response = await fetch(`/api/khpos/ops/presence/${organisationId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store",
      });
      const body = await response.json() as { ok?: boolean; workspace?: KhposPresenceWorkspace; error?: string };
      if (!response.ok || !body.ok || !body.workspace) throw new Error(body.error || "School attendance could not load.");
      setPresence(body.workspace);
      setCampusId((current) => current || body.workspace?.staff?.campusId || body.workspace?.campuses[0]?.id || "");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load school attendance.");
    } finally {
      setLoading(false);
    }
  }, [organisationId, supabase]);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    const clock = window.setInterval(() => { setNowMs(Date.now()); }, 60_000);
    const onFocus = () => { setNowMs(Date.now()); void load(); };
    const onVisibility = () => { if (document.visibilityState === "visible") onFocus(); };
    const onActivity = (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.organisationId === organisationId) {
        void load();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(KHPOS_ACTIVITY_CHANGED, onActivity);
    return () => {
      window.clearTimeout(initial); window.clearInterval(clock);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(KHPOS_ACTIVITY_CHANGED, onActivity);
    };
  }, [load, organisationId]);

  async function record(kind: "school_in" | "school_out" | "class_in", periodId: string | null) {
    if (!supabase || !presence || busy) return;
    if (kind === "school_out" && !window.confirm("Are you leaving school now? Your departure time will be recorded.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) throw new Error("Your session has ended. Sign in again.");
      const response = await fetch(`/api/khpos/ops/presence/${organisationId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: kind, ...(kind === "school_in" ? { campusId } : {}),
          ...(kind === "class_in" ? { periodId } : {}) }),
      });
      const body = await response.json() as { ok?: boolean; workspace?: KhposPresenceWorkspace; error?: string };
      if (!response.ok || !body.ok || !body.workspace) throw new Error(body.error || "Attendance could not be recorded.");
      setPresence(body.workspace);
      setNowMs(Date.now());
      setNotice(kind === "school_in" ? "School arrival saved with date and time." :
        kind === "school_out" ? "School departure saved with date and time." : "Class start saved with date and time.");
      announceKhposActivityChanged(organisationId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Attendance could not be saved. Please try again.");
    } finally { setBusy(false); }
  }

  const steps = presence ? attendanceSteps(presence, nowMs) : [];
  const schoolSteps = steps.filter((step) => step.kind.startsWith("school"));
  const classSteps = steps.filter((step) => step.kind.startsWith("class"));
  const due = steps.filter((step) => step.status === "due").length;
  const done = steps.filter((step) => step.status === "done").length;
  const classCount = classSteps.length / 2;
  const schoolUrl = `/khpos/${organisationId}/teaching-presence`;

  return (
    <section aria-label="Today's school attendance and classes" className="rounded-[30px] border border-brand-200 bg-white p-5 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-brand-700">Daily attendance</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">School and class check-in / check-out</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Record your arrival at school separately from each class you teach. Finish each class before recording your departure from school.
          </p>
          {presence && <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Clock3 className="size-4" /> School date: {presence.localDay} · Times are recorded in Nigeria time (WAT).
          </p>}
        </div>
        <Link href={schoolUrl} className="rounded-full border border-brand-300 px-4 py-2 text-xs font-black text-brand-800">
          Open full attendance page
        </Link>
      </div>
      {loading && <p role="status" className="mt-5 flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="size-4 animate-spin" /> Checking your attendance…
      </p>}
      {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-900">
        <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
      </p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{notice}</p>}
      {presence && !presence.pilotEnabled && <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Attendance is not yet switched on for your school.</strong>{" "}
        {presence.canEnablePilot ? "Open the attendance page and choose Turn on school attendance to begin." :
          "Ask your School Custodian to turn on attendance. Reminders will start only after it is enabled."}
        <div className="mt-3"><Link href={schoolUrl} className="font-black underline">Open attendance setup →</Link></div>
      </div>}
      {presence?.pilotEnabled && !presence.staff && <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Your staff profile is not yet active.</strong> Ask your School Guardian to complete your staff setup before recording attendance.
        <div className="mt-3"><Link href={`/khpos/${organisationId}/people`} className="font-black underline">Open People & Staff →</Link></div>
      </div>}
      {presence?.pilotEnabled && presence.staff && (
        <>
          <p className="mt-5 text-sm font-semibold text-slate-700">{due} action{due === 1 ? "" : "s"} due now · {done} recorded</p>
          {schoolSteps.length > 0 &&
            <div className="mt-4">
              <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-900"><School className="size-5 text-brand-700" /> 1. Your school day</h3>
              {!presence.todayPresence && presence.campuses.length > 1 &&
                <label className="mb-4 block max-w-md text-sm font-bold text-slate-800">Which campus are you at?
                  <select className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" value={campusId}
                    onChange={(event) => setCampusId(event.target.value)}>
                    <option value="">Choose your campus</option>
                    {presence.campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
                  </select>
                </label>}
              <div className="grid gap-3 lg:grid-cols-2">
                {schoolSteps.map((step) => <AttendanceRow key={step.id} step={step} organisationId={organisationId}
                  busy={busy || (step.kind === "school_in" && !campusId)} onRecord={record} />)}
              </div>
            </div>}
          <div className="mt-6">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-900">
              <BookOpenCheck className="size-5 text-brand-700" /> 2. Your scheduled classes
            </h3>
            {classCount === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              No classes are scheduled for your teaching assignment today. This does not mean that classes have been recorded as taught.
              If you expected a class, ask your School Guardian or Academic Inspector to check the timetable.
            </p> : <div className="grid gap-3 lg:grid-cols-2">
              {classSteps.map((step) => <AttendanceRow key={step.id} step={step}
                organisationId={organisationId} busy={busy} onRecord={record} />)}
            </div>}
          </div>
          <p className="mt-5 rounded-xl bg-brand-50 p-3 text-sm leading-6 text-brand-950">
            <strong>Need phone reminders?</strong> Open the bell icon and select <strong>Enable device alerts</strong>.
            Reminders appear only for actions that are due, and stop once you record them.
          </p>
        </>
      )}
    </section>
  );
}
