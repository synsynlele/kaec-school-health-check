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
  const endpoint = `/api/khpos/ops/positions/${organisationId}`;
  const staff = people?.items.filter((item) => item.status === "active" && item.accountLinked) ?? [];
  const roles = people?.roles.filter((role) => ["SCHOOL_GUARDIAN", "ACADEMIC_INSPECTOR", "SKILL_INSPECTOR", "SECTIONAL_PROMOTER", "TEACHER", "SKILLS_FACILITATOR"].includes(role.code) && (role.code !== "SCHOOL_GUARDIAN" || positions?.canAppointGuardian)) ?? [];

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
    setBusy(true); setError("");
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The position could not be updated."); }
    finally { setBusy(false); }
  }

  const field = "w-full rounded-xl border border-slate-300 bg-white p-3 text-sm";
  return <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5" aria-busy={busy}>
    <div><h2 className="text-lg font-bold">{people ? "Staff positions" : "My positions"}</h2>
      <p className="mt-1 text-sm text-slate-600">One account can hold several positions. Each position has its own duties and school area. Additional positions become active after staff acceptance and an independent readiness review.</p></div>
    {people && <label className="block text-sm font-semibold">Staff member<select className={`${field} mt-2`} value={staffId} disabled={busy} onChange={(event) => { setStaffId(event.target.value); setPositions(null); setError(""); }}><option value="">Choose an active staff member</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>}
    <button disabled={busy || !!people && !staffId} className="rounded-lg border px-3 py-2 text-sm" onClick={() => setRefresh((value) => value + 1)}>Refresh readiness</button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
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
        <h3 className="font-semibold">{position.title} · {position.status}</h3><p className="text-sm">{position.campusName}{position.unitName ? ` · ${position.unitName}` : ""}</p>
        {position.status === "pending" && <><p className="text-sm">{position.charter.mission}</p><ul className="list-disc space-y-1 pl-5 text-sm">{position.charter.responsibilities?.map((duty) => <li key={duty}>{duty}</li>)}</ul>
          {!!position.charter.decisionRights?.length && <div className="text-sm"><strong>Decisions you may make</strong><ul className="list-disc pl-5">{position.charter.decisionRights.map((right) => <li key={right}>{right}</li>)}</ul></div>}
          {!!position.charter.escalation?.length && <div className="text-sm"><strong>When to escalate</strong><ul className="list-disc pl-5">{position.charter.escalation.map((rule) => <li key={rule}>{rule}</li>)}</ul></div>}
          {position.requiredPolicies.map((policy) => <div key={policy.code} className="flex flex-wrap items-center gap-3 text-sm"><Link className="font-semibold text-brand-700 underline" href={`/khpos/${organisationId}/library?tab=policies&q=${encodeURIComponent(policy.code)}`}>Read {policy.name ?? policy.code}</Link><span>{policy.acknowledged ? "Acknowledged" : policy.published ? "Acknowledgement needed" : "Awaiting publication"}</span>{position.canAcknowledge && policy.versionId && !policy.acknowledged && <button disabled={busy} className="rounded-lg border px-3 py-2" onClick={() => void act("policy_acknowledge", { versionId: policy.versionId })}>I have read and understood this policy</button>}</div>)}
          {position.blockers.length > 0 && <div className="text-sm text-amber-900"><strong>Needed before activation</strong><ul className="list-disc pl-5">{position.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul><Link className="underline" href={`/khpos/${organisationId}/onboarding`}>Open My Onboarding for shared practice</Link></div>}
        </>}
        {(position.canAcknowledge || position.canManage) && position.status !== "ended" && <>
          <label className="block text-sm">{position.canAcknowledge ? "How will you fulfil these responsibilities?" : position.status === "pending" ? "Independent readiness review" : "Reason for ending this additional position"}<textarea className={`${field} mt-1`} value={notes[position.id] ?? ""} maxLength={2000} onChange={(event) => setNotes((current) => ({ ...current, [position.id]: event.target.value }))} /></label>
          {position.canAcknowledge && <button disabled={busy || (notes[position.id]?.trim().length ?? 0) < 20} className="rounded-xl bg-brand-700 px-4 py-2 text-white" onClick={() => void act("acknowledge", { positionId: position.id, note: notes[position.id] })}>{position.acknowledged ? "Update acceptance" : "Accept responsibilities"}</button>}
          {position.canManage && <button disabled={busy || (notes[position.id]?.trim().length ?? 0) < (position.status === "pending" ? 20 : 10) || (position.status === "pending" && position.blockers.length > 0)} className="rounded-xl border border-brand-700 px-4 py-2 font-semibold text-brand-700" onClick={() => void act(position.status === "pending" ? "activate" : "end", { positionId: position.id, note: notes[position.id] })}>{position.status === "pending" ? "Confirm readiness and activate" : "End additional position"}</button>}
        </>}
      </article>)}
      {positions.appointments.some((position) => position.status === "ended") && <details className="rounded-xl border p-3 text-sm"><summary className="cursor-pointer font-semibold">Past positions</summary><ul className="mt-2 space-y-2">{positions.appointments.filter((position) => position.status === "ended").map((position) => <li key={position.id}>{position.title} · {position.campusName}{position.unitName ? ` · ${position.unitName}` : ""}</li>)}</ul></details>}
      {!positions.activePositions.length && !positions.appointments.length && <p className="text-sm text-slate-600">No positions have been recorded yet.</p>}
    </>}
  </section>;
}
