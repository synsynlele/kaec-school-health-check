"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CircleAlert,
  Loader2,
  Play,
  Save,
  Sparkles,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  KHPOSEventTypes,
  KHPOSConditionKeys,
  type ConfigureKhposExecutionInput,
  type KhposExecutionMode,
  type KhposExecutionSnapshot,
  type KhposManualProcessStartResult,
  type KhposSafeExecutionMappingResult,
} from "@/lib/khpos/ops/execution";

const readable = (value: string) => value.replaceAll("_", " ");
const numeric = (value: string) => value.trim() ? Number(value) : null;

export function ExecutionControlWorkspace({ organisationId }: { organisationId: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [snapshot, setSnapshot] = useState<KhposExecutionSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<ConfigureKhposExecutionInput | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mappingBusy, setMappingBusy] = useState(false);
  const [startBusy, setStartBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const token = useCallback(async () => {
    if (!supabase) throw new Error("KHP-OS sign-in is not configured.");
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error("Your session has ended. Sign in again.");
    return data.session.access_token;
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void token().then(async (accessToken) => {
      const response = await fetch("/api/khpos/ops/execution/" + organisationId, {
        headers: { Authorization: "Bearer " + accessToken },
        cache: "no-store",
      });
      const body = await response.json() as { ok?: boolean; execution?: KhposExecutionSnapshot; error?: string };
      if (!active) return;
      if (!response.ok || !body.ok || !body.execution) {
        setError(body.error ?? "Execution control could not be loaded.");
        return;
      }
      setSnapshot(body.execution);
    }).catch((cause) => active && setError(cause instanceof Error ? cause.message : "Execution control could not be loaded."));
    return () => { active = false; };
  }, [organisationId, supabase, token]);

  const selected = snapshot?.items.find((item) => item.processId === selectedId) ?? null;

  function selectProcess(processId: string) {
    const item = snapshot?.items.find((process) => process.processId === processId);
    if (!item) return;
    setSelectedId(processId);
    setForm({
      processId: item.processId,
      mode: item.mode,
      ownerRoleId: item.ownerRoleId ?? item.ownerParticipationRoleId,
      eventType: item.eventType,
      conditionKey: item.conditionKey,
      triggerSummary: item.triggerSummary,
      dueOffsetMinutes: item.dueOffsetMinutes,
      evidenceRequired: item.evidenceRequired,
      verificationRequired: item.verificationRequired,
      escalationMinutes: item.escalationMinutes,
      kpiCodes: item.kpiCodes,
    });
  }

  async function save() {
    if (!form) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const accessToken = await token();
      const response = await fetch("/api/khpos/ops/execution/" + organisationId, {
        method: "PATCH",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json() as { ok?: boolean; execution?: KhposExecutionSnapshot; error?: string };
      if (!response.ok || !body.ok || !body.execution) throw new Error(body.error ?? "Execution mapping could not be saved.");
      setSnapshot(body.execution);
      setMessage("Execution mapping saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Execution mapping could not be saved.");
    } finally { setBusy(false); }
  }


  async function applySafeMappings() {
    setMappingBusy(true);
    setError("");
    setMessage("");
    try {
      const accessToken = await token();
      const response = await fetch(
        "/api/khpos/ops/execution/" + organisationId,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "apply_safe_mappings" }),
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        execution?: KhposExecutionSnapshot;
        mapping?: KhposSafeExecutionMappingResult;
        error?: string;
      };
      if (!response.ok || !body.ok || !body.execution || !body.mapping) {
        throw new Error(
          body.error ?? "Safe execution mappings could not be applied.",
        );
      }

      setSnapshot(body.execution);
      setSelectedId("");
      setForm(null);
      setMessage(
        String(body.mapping.mapped) +
          " process" +
          (body.mapping.mapped === 1 ? " was" : "es were") +
          " safely mapped to governed owner roles. " +
          String(body.mapping.blockedMissingAssignment) +
          " remain blocked by missing role assignments; " +
          String(body.mapping.multipleOwner + body.mapping.noOwner) +
          " still require an ownership decision.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Safe execution mappings could not be applied.",
      );
    } finally {
      setMappingBusy(false);
    }
  }

  async function startManualProcess() {
    if (!selected || selected.status !== "configured") return;
    setStartBusy(true);
    setError("");
    setMessage("");
    try {
      const accessToken = await token();
      const response = await fetch(
        "/api/khpos/ops/execution/" + organisationId,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "start_manual",
            processId: selected.processId,
          }),
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        started?: KhposManualProcessStartResult;
        error?: string;
      };
      if (!response.ok || !body.ok || !body.started) {
        throw new Error(body.error ?? "The process could not be started.");
      }

      setMessage(
        body.started.ownerIsActor
          ? body.started.processCode +
              " started. The work is now in your Today queue."
          : body.started.processCode +
              " started and routed to " +
              body.started.ownerRoleTitle +
              ".",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The process could not be started.",
      );
    } finally {
      setStartBusy(false);
    }
  }

  if (!snapshot && !error) return <main className="grid min-h-screen place-items-center bg-slate-950"><Loader2 className="size-9 animate-spin text-mint-300" /></main>;
  if (!snapshot) return <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white"><div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center"><CircleAlert className="mx-auto size-9 text-amber-300" /><h1 className="mt-4 text-2xl font-black">Execution control unavailable</h1><p className="mt-3 text-sm text-slate-300">{error}</p></div></main>;

  const visible = showAll ? snapshot.items : snapshot.items.filter((item) => item.status !== "configured");

  return <main className="min-h-screen bg-slate-50 text-slate-950">
    <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-black text-mint-200">Execution Control</span>
          <Link href={"/khpos/" + organisationId + "/activation"} className="rounded-full border border-white/20 px-4 py-2 text-xs font-black">Activation Centre</Link>
        </div>
        <h1 className="mt-5 max-w-4xl text-3xl font-black sm:text-5xl">Every approved process must know how it becomes real work.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-100">Define the operating mode, accountable role, evidence, verification and escalation once.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ["Approved", snapshot.summary.approvedProcesses],
            ["Configured", snapshot.summary.configured],
            ["Need mapping", snapshot.summary.needsMapping],
            ["Safe now", snapshot.summary.safeMappingCandidates],
            ["Automated", snapshot.summary.recurring + snapshot.summary.eventDriven + snapshot.summary.conditionDriven],
            ["Trigger failures", snapshot.summary.triggerFailures7d],
          ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/10 p-4"><p className="text-xs font-bold text-brand-100">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>)}
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{message}</div>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>}

      {snapshot.canConfigure && snapshot.summary.safeMappingCandidates > 0 && (
        <section className="rounded-[30px] border border-brand-200 bg-brand-50 p-6 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-700 text-white">
                <Sparkles className="size-5" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
                  Safe execution closure
                </p>
                <h2 className="mt-1 text-xl font-black">
                  {snapshot.summary.safeMappingCandidates} processes already have one governed owner and an active role holder.
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  KHP-OS can map these to manual/on-demand execution without inventing authority or starting any work.
                  {snapshot.summary.blockedMissingAssignment > 0
                    ? " " + snapshot.summary.blockedMissingAssignment + " otherwise-clear process(es) remain blocked until the owner role is staffed."
                    : ""}
                  {snapshot.summary.multipleOwner + snapshot.summary.noOwner > 0
                    ? " " + (snapshot.summary.multipleOwner + snapshot.summary.noOwner) + " process(es) still need a human ownership decision."
                    : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={mappingBusy}
              onClick={() => void applySafeMappings()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {mappingBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Apply safe mappings
            </button>
          </div>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">Process coverage</p><h2 className="mt-2 text-xl font-black">{showAll ? "All approved processes" : "Processes needing mapping"}</h2></div><button type="button" onClick={() => setShowAll((value) => !value)} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-black">{showAll ? "Show gaps" : "Show all"}</button></div>
          <div className="mt-5 max-h-[70vh] space-y-2 overflow-y-auto">
            {visible.map((item) => <button key={item.processId} type="button" onClick={() => selectProcess(item.processId)} className={"w-full rounded-2xl border p-4 text-left " + (selectedId === item.processId ? "border-brand-400 bg-brand-50" : "border-slate-200 bg-slate-50")}>
              <div className="flex items-start justify-between gap-3"><div><div className="flex gap-2"><span className="text-xs font-black text-brand-700">{item.code}</span><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black">{item.criticality}</span></div><p className="mt-2 text-sm font-black">{item.title}</p><p className="mt-1 text-xs text-slate-500">
                {item.status === "configured"
                  ? readable(item.mode)
                  : item.safeMappingCandidate
                    ? "safe owner mapping ready"
                    : item.blockedByMissingAssignment
                      ? "owner role is not staffed"
                      : item.ownerParticipationCount > 1
                        ? "multiple governed owners · choose one"
                        : "no governed owner · choose one"}
              </p></div>{item.status === "configured" ? <CheckCircle2 className="size-5 text-emerald-700" /> : <CircleAlert className="size-5 text-amber-700" />}</div>
            </button>)}
            {!visible.length && <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 p-6 text-center text-sm font-semibold text-emerald-900">Every approved process in this view is mapped.</div>}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          {!selected || !form ? <div className="grid min-h-[28rem] place-items-center text-center"><div><h2 className="text-xl font-black">Choose a process</h2><p className="mt-2 text-sm text-slate-600">Configure how this approved procedure becomes work.</p></div></div> : <div>
            <p className="text-xs font-black text-brand-700">{selected.code}</p><h2 className="mt-1 text-2xl font-black">{selected.title}</h2>
            <p className="mt-2 text-sm text-slate-500">Controlled records: {selected.controlledRecordCount}{selected.recurringRule ? " · " + selected.recurringRule.code + " (" + selected.recurringRule.cadence + ")" : ""}</p>
            {selected.safeMappingCandidate && (
              <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-950">
                This process has one governed owner role with an active assignment. The accountable role has been prefilled for a safe individual mapping.
              </div>
            )}
            {selected.blockedByMissingAssignment && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                The governed owner is clear, but no active person currently holds that role. Keep this process unmapped until the real appointment exists.
              </div>
            )}


            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-bold">Execution mode<select value={form.mode} disabled={!snapshot.canConfigure} onChange={(e) => setForm({ ...form, mode: e.target.value as KhposExecutionMode })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal"><option value="recurring">Recurring schedule</option><option value="event">Institutional event</option><option value="condition">Detected condition</option><option value="manual_on_demand">Manual / on demand</option><option value="continuous_control">Continuous control</option><option value="external_system">External system</option></select></label>
              <label className="text-sm font-bold">Accountable role<select value={form.ownerRoleId ?? ""} disabled={!snapshot.canConfigure || form.mode === "recurring"} onChange={(e) => setForm({ ...form, ownerRoleId: e.target.value || null })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal"><option value="">Choose role…</option>{snapshot.roles.map((role) => <option key={role.id} value={role.id}>{role.title}</option>)}</select></label>
              {form.mode === "event" && <label className="text-sm font-bold">Event<select value={form.eventType ?? ""} disabled={!snapshot.canConfigure} onChange={(e) => setForm({ ...form, eventType: e.target.value || null })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal"><option value="">Choose event…</option>{KHPOSEventTypes.map((value) => <option key={value} value={value}>{readable(value)}</option>)}</select></label>}
              {form.mode === "condition" && <label className="text-sm font-bold">Condition<select value={form.conditionKey ?? ""} disabled={!snapshot.canConfigure} onChange={(e) => setForm({ ...form, conditionKey: e.target.value || null })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal"><option value="">Choose condition…</option>{KHPOSConditionKeys.map((value) => <option key={value} value={value}>{readable(value)}</option>)}</select></label>}
              <label className="text-sm font-bold">Due after trigger (minutes)<input type="number" min={0} disabled={!snapshot.canConfigure} value={form.dueOffsetMinutes ?? ""} onChange={(e) => setForm({ ...form, dueOffsetMinutes: numeric(e.target.value) })} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label>
              <label className="text-sm font-bold">Escalate after (minutes)<input type="number" min={1} disabled={!snapshot.canConfigure} value={form.escalationMinutes ?? ""} onChange={(e) => setForm({ ...form, escalationMinutes: numeric(e.target.value) })} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label>
            </div>

            <label className="mt-5 block text-sm font-bold">Trigger / execution summary<textarea rows={4} disabled={!snapshot.canConfigure} value={form.triggerSummary ?? ""} onChange={(e) => setForm({ ...form, triggerSummary: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal leading-6" /></label>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold"><input type="checkbox" disabled={!snapshot.canConfigure} checked={form.evidenceRequired ?? false} onChange={(e) => setForm({ ...form, evidenceRequired: e.target.checked })} /> Evidence required</label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold"><input type="checkbox" disabled={!snapshot.canConfigure} checked={form.verificationRequired ?? false} onChange={(e) => setForm({ ...form, verificationRequired: e.target.checked })} /> Independent verification</label>
            </div>
            {selected.recentTriggerFailures > 0 && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{selected.recentTriggerFailures} trigger failure(s) in the last seven days.</div>}
            <div className="mt-6 flex flex-wrap gap-3">
              {selected.status === "configured" &&
                selected.mode === "manual_on_demand" && (
                  <button
                    type="button"
                    disabled={startBusy}
                    onClick={() => void startManualProcess()}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                  >
                    {startBusy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                    Start Process
                  </button>
                )}
              {snapshot.canConfigure && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save()}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save execution mapping
                </button>
              )}
            </div>
          </div>}
        </div>
      </section>
    </div>
  </main>;
}
