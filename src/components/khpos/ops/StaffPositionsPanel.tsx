"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { SchoolPositions } from "@/lib/khpos/ops/positions";
import type { KhposOpsPeopleWorkspace } from "@/lib/khpos/ops/people";

export function StaffPositionsPanel({ organisationId, people }: {
  organisationId: string; people?: KhposOpsPeopleWorkspace;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [refresh, setRefresh] = useState(0);
  const [staffId, setStaffId] = useState("");
  const [positions, setPositions] = useState<SchoolPositions | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [roleId, setRoleId] = useState("");
  const [campusId, setCampusId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editingAcceptance, setEditingAcceptance] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const endpoint = `/api/khpos/ops/positions/${organisationId}`;
  const staff = people?.items.filter((item) => item.status === "active" && item.accountLinked) ?? [];
  const roles = people?.roles.filter((role) => ["SCHOOL_GUARDIAN", "ACADEMIC_INSPECTOR", "SKILL_INSPECTOR", "FINANCE_ADMIN_OFFICER", "SCHOOL_CARE_OPERATIONS_OFFICER", "SECTIONAL_PROMOTER", "TEACHER", "SKILLS_FACILITATOR"].includes(role.code) && (role.code !== "SCHOOL_GUARDIAN" || positions?.canAppointGuardian)) ?? [];

  useEffect(() => {
    let active = true;
    if (people && !staffId) return;
    void (async () => {
      if (!supabase) throw new Error("Sign in to view positions.");
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Sign in to view positions.");
      const response = await fetch(`${endpoint}${staffId ? `?staffId=${staffId}` : ""}`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Positions could not be loaded.");
      if (active) { setPositions(body.positions); setError(""); }
    })().catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Positions could not be loaded."); });
    return () => { active = false; };
  }, [endpoint, staffId, supabase, people, refresh]);

  async function act(mode: string, input: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!supabase) throw new Error("Sign in to continue.");
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Sign in to continue.");
      const response = await fetch(endpoint, {
        method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ mode, ...(staffId ? { staffId } : {}), ...input }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "The position could not be updated.");
      setPositions(body.positions);
      if (mode === "acknowledge") {
        setEditingAcceptance(null);
        setNotes((current) => ({ ...current, [String(input.positionId)]: "" }));
        setNotice("Your position responsibilities have been accepted and recorded. A leader must separately approve activation after every required policy and guided practice are complete.");
      } else if (mode === "policy_acknowledge") {
        setNotice("Policy acknowledgement recorded. Review the remaining readiness requirements below.");
      } else if (mode === "activate") {
        setNotice("Additional position activated.");
      } else {
        setNotice("Position details updated.");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The position could not be updated."); }
    finally { setBusy(false); }
  }

  const field = "w-full rounded-xl border border-slate-300 bg-white p-3 text-sm";
  return <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5" aria-busy={busy}>
    <div><h2 className="text-lg font-bold">{people ? "Staff positions" : "My positions"}</h2>
      <p className="mt-1 text-sm text-slate-600">One account can hold several positions. Each position has its own duties and school area. The staff member must accept a new position and acknowledge its current required policies in their own account; a different authorised leader then reviews readiness and activates it.</p></div>
    {people && <label className="block text-sm font-semibold">Staff member<select className={`${field} mt-2`} value={staffId} disabled={busy} onChange={(event) => { setStaffId(event.target.value); setPositions(null); setError(""); }}><option value="">Choose an active staff member</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>}
    <button disabled={busy || !!people && !staffId} className="rounded-lg border px-3 py-2 text-sm" onClick={() => setRefresh((value) => value + 1)}>Refresh readiness</button>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{notice}</p>}
    {positions && <>
      <ul className="space-y-2">{positions.activePositions.map((position) => <li key={position.assignmentId} className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{position.title}</strong>{position.primary ? " · Primary appointment" : " · Additional position"}<p>{[position.campusName, position.unitName].filter(Boolean).join(" · ") || "School-wide"}</p>{position.reportsTo && <p className="text-slate-600">Reports to {position.reportsTo}</p>}</li>)}</ul>
      {people && positions.canManage && <form className="space-y-3 border-t pt-4" onSubmit={(event) => { event.preventDefault(); void act("propose", { roleId, campusId, unitId: unitId || null }); }}>
        <h3 className="font-semibold">Add a position</h3>
        <label className="block text-sm">Position<select required className={field} value={roleId} onChange={(event) => setRoleId(event.target.value)}><option value="">Choose a position</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.title}</option>)}</select></label>
        <label className="block text-sm">Campus<select required className={field} value={campusId} onChange={(event) => { setCampusId(event.target.value); setUnitId(""); }}><option value="">Choose a campus</option>{people.campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select></label>
        <label className="block text-sm">Section or programme<select className={field} value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="">Entire campus</option>{people.units.filter((unit) => !unit.campusId || unit.campusId === campusId).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
        <button disabled={busy} className="rounded-xl bg-brand-700 px-4 py-2 font-semibold text-white">Propose additional position</button>
      </form>}
      {positions.appointments.filter((position) => position.status === "pending" || position.status === "active" && position.canManage).map((position) => <article key={position.id} className="space-y-3 rounded-2xl border border-slate-200 p-4">
        <h3 className="font-semibold">{position.title} · {position.status === "pending"
          ? position.acknowledged
            ? position.blockers.length === 0 ? "Awaiting leadership activation" : "Accepted · awaiting readiness completion"
            : "Awaiting staff acceptance"
          : position.status}</h3>
        {position.status === "pending" && <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="font-bold text-slate-900">Position readiness</p>
          <p className={position.acknowledged ? "mt-1 font-semibold text-emerald-800" : "mt-1 font-semibold text-amber-800"}>
            {position.acknowledged ? "Responsibilities accepted ✓" : "Responsibilities not yet accepted"}
          </p>
          <p className="mt-1 text-slate-700">
            {position.blockers.length === 0
              ? "All recorded readiness requirements are complete. An authorised leader can now perform the independent review and activate this position."
              : position.acknowledged
                ? "Your acceptance is saved. Finish the remaining requirements listed below; repeating acceptance will not resolve them."
                : "Read and accept your position responsibilities. Also complete all required policies and guided practice."}
          </p>
          <p className="mt-1 text-xs text-slate-600">Acceptance does not itself activate the additional position.</p>
        </div>}{position.status === "pending" && <p className="text-sm text-slate-600">{position.canAcknowledge ? "This is your additional position. Read and acknowledge each required policy, accept the charter, and complete shared guided practice. A school leader activates the position afterward." : position.canManage ? "Waiting for the staff member to complete their own onboarding. Policy acknowledgements and charter acceptance cannot be completed on their behalf." : "This position is awaiting onboarding."}</p>}<p className="text-sm">{position.campusName}{position.unitName ? ` · ${position.unitName}` : ""}</p>
        {position.status === "pending" && <><p className="text-sm">{position.charter.mission}</p><ul className="list-disc space-y-1 pl-5 text-sm">{position.charter.responsibilities?.map((duty) => <li key={duty}>{duty}</li>)}</ul>
          {!!position.charter.decisionRights?.length && <div className="text-sm"><strong>Decisions you may make</strong><ul className="list-disc pl-5">{position.charter.decisionRights.map((right) => <li key={right}>{right}</li>)}</ul></div>}
          {!!position.charter.escalation?.length && <div className="text-sm"><strong>When to escalate</strong><ul className="list-disc pl-5">{position.charter.escalation.map((rule) => <li key={rule}>{rule}</li>)}</ul></div>}
          {position.requiredPolicies.map((policy) => <div key={policy.code} className="flex flex-wrap items-center gap-3 text-sm"><Link className="font-semibold text-brand-700 underline" href={`/khpos/${organisationId}/library?tab=policies&q=${encodeURIComponent(policy.code)}`}>Read {policy.name ?? policy.code}</Link><span>{policy.acknowledged ? "Acknowledged" : policy.published ? "Acknowledgement needed" : "Awaiting publication"}</span>{position.canAcknowledge && policy.versionId && !policy.acknowledged && <button disabled={busy} className="rounded-lg border px-3 py-2" onClick={() => void act("policy_acknowledge", { versionId: policy.versionId })}>I have read and understood this policy</button>}</div>)}
          {position.blockers.length > 0 && <div className="text-sm text-amber-900"><strong>Needed before activation</strong><ul className="list-disc pl-5">{position.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>{position.canAcknowledge ? <Link className="underline" href={`/khpos/${organisationId}/onboarding`}>Open My Onboarding for shared practice</Link> : <p className="mt-2">Ask the staff member to open <strong>My Onboarding → My positions</strong> in their own account to resolve these requirements. Refresh readiness after they finish.</p>}</div>}
        </>}
        {(position.canAcknowledge || position.canManage) && position.status !== "ended" && <>
          {(!position.canAcknowledge || !position.acknowledged || editingAcceptance === position.id) && <label className="block text-sm">{position.canAcknowledge ? "How will you fulfil these responsibilities?" : position.status === "pending" ? "Independent readiness review" : "Reason for ending this additional position"}<textarea className={`${field} mt-1`} value={notes[position.id] ?? ""} maxLength={2000} onChange={(event) => setNotes((current) => ({ ...current, [position.id]: event.target.value }))} /></label>}
          {position.canAcknowledge && (position.acknowledged && editingAcceptance !== position.id
            ? <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">Acceptance already recorded</span>
                <button type="button" disabled={busy} className="rounded-xl border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-800"
                  onClick={() => setEditingAcceptance(position.id)}>Revise acceptance statement</button>
              </div>
            : <div className="space-y-2">
                <p className="text-xs text-slate-600">Write at least 20 characters about how you will carry out this responsibility. This is separate from acknowledging school policies.</p>
                <button type="button" disabled={busy || (notes[position.id]?.trim().length ?? 0) < 20}
                  className="rounded-xl bg-brand-700 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => void act("acknowledge", { positionId: position.id, note: notes[position.id] })}>
                  {position.acknowledged ? "Save revised acceptance" : "Accept responsibilities"}
                </button>
                {position.acknowledged && <button type="button" disabled={busy}
                  className="ml-2 rounded-xl border px-4 py-2 text-sm font-semibold"
                  onClick={() => { setEditingAcceptance(null); setNotes((current) => ({ ...current, [position.id]: "" })); }}>Cancel revision</button>}
              </div>)}
          {position.canManage && <button disabled={busy || (notes[position.id]?.trim().length ?? 0) < (position.status === "pending" ? 20 : 10) || (position.status === "pending" && position.blockers.length > 0)} className="rounded-xl border border-brand-700 px-4 py-2 font-semibold text-brand-700" onClick={() => void act(position.status === "pending" ? "activate" : "end", { positionId: position.id, note: notes[position.id] })}>{position.status === "pending" ? "Confirm readiness and activate" : "End additional position"}</button>}
        </>}
      </article>)}
      {positions.appointments.some((position) => position.status === "ended") && <details className="rounded-xl border p-3 text-sm"><summary className="cursor-pointer font-semibold">Past positions</summary><ul className="mt-2 space-y-2">{positions.appointments.filter((position) => position.status === "ended").map((position) => <li key={position.id}>{position.title} · {position.campusName}{position.unitName ? ` · ${position.unitName}` : ""}</li>)}</ul></details>}
      {!positions.activePositions.length && !positions.appointments.length && <p className="text-sm text-slate-600">No positions have been recorded yet.</p>}
    </>}
  </section>;
}
