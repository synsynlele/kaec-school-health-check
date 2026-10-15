"use client";
import { useState } from "react";
import type { ManagedAssignment } from "@/lib/khpos/ops/positions";
type Mode = "disable" | "restore" | "end" | "make_primary";
const labels: Record<Mode, string> = {disable: "Disable position", restore: "Restore position", end: "End / remove position", make_primary: "Make primary position"};
const field = "mt-1 block min-h-12 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-950";
export function PositionLifecycleControls({assignments, staffId, busy, onAction}: {
 assignments: ManagedAssignment[]; staffId: string | null; busy: boolean;
 onAction: (mode: string, input: Record<string, unknown>) => Promise<string | null>;
}) {
 const [selection, setSelection] = useState<{id: string; mode: Mode} | null>(null);
 const [feedback, setFeedback] = useState<{error: boolean; message: string} | null>(null);
 const current = assignments.find(a => a.assignmentId === selection?.id);
 const active = assignments.filter(a => a.status === "active");
 async function submit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (!selection || !staffId || busy) return;
  const form = new FormData(event.currentTarget);
  setFeedback(null);
  const error = await onAction(`assignment_${selection.mode}`, {staffId, assignmentId: selection.id, note: form.get("note"), handover: form.get("handover"), replacementId: form.get("replacementId") || null, confirmLastPosition: form.get("confirmLastPosition") === "on"});
  setFeedback({error: !!error, message: error || "Position updated. Other active positions and the staff profile are preserved."});
  if (!error) setSelection(null);
 }
 function row(a: ManagedAssignment) {
  return <article key={a.assignmentId} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
   <div><h4 className="font-bold">{a.title} · {a.primary ? "Primary" : "Additional"} · {a.status}</h4><p className="text-sm text-slate-600">{[a.campusName,a.unitName].filter(Boolean).join(" · ") || "School-wide"}</p></div>
   {a.handoverBlockers.length > 0 && <p className="text-sm font-semibold text-amber-900">Handover needed: {a.handoverBlockers.join(", ")}.</p>}
   {a.reason && <p className="break-words text-sm text-slate-600">Last change: {a.reason}</p>}
   {a.handover && <p className="break-words text-sm text-slate-600">Handover: {a.handover}</p>}
   {a.canManage && a.status !== "ended" && <div className="flex flex-wrap gap-2">{(a.status === "active" ? ["disable", "end", ...(!a.primary ? ["make_primary"] : [])] : a.status === "disabled" ? ["restore", "end"] : ["end"]).map(mode => <button key={mode} type="button" disabled={busy} className="min-h-12 touch-manipulation rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold disabled:opacity-50" onClick={() => {setSelection({id:a.assignmentId,mode:mode as Mode});setFeedback(null);}}>{labels[mode as Mode]}</button>)}</div>}
   {!a.canManage && ["SCHOOL_CUSTODIAN","VISION_CUSTODIAN"].includes(a.roleCode) && <p className="text-sm text-slate-600">Custodian changes require separate governance approval.</p>}
   {current?.assignmentId === a.assignmentId && selection && <form key={`${a.assignmentId}-${selection.mode}`} onSubmit={submit} className="space-y-3 rounded-xl bg-slate-50 p-4">
    <h5 className="font-bold">Confirm: {labels[selection.mode]}</h5>
    {feedback && <p role={feedback.error ? "alert" : "status"} className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">{feedback.message}</p>}
    <p className="text-sm">{selection.mode === "disable" ? "This position will stop granting permissions until it is restored." : selection.mode === "restore" ? "Restoring this position returns its existing permissions after readiness checks." : selection.mode === "make_primary" ? "This already active position becomes primary. The previous primary remains assigned with its current status." : "This ends the assignment and retains its history. Returning later requires a new appointment."}</p>
    <label className="block text-sm font-semibold">Reason · at least 10 characters<textarea required minLength={10} maxLength={2000} name="note" className={field} /></label>
    {["disable","end"].includes(selection.mode) && <>
     <label className="block text-sm font-semibold">Handover arrangements · at least 10 characters<textarea required minLength={10} maxLength={2000} name="handover" className={field} placeholder="Who takes over, or why no handover is needed" /></label>
     <p className="text-sm">Complete or reassign open work, issues, decisions and any responsibilities listed above first.</p>
     {selection.mode === "end" && a.primary && a.remainingActiveCount > 0 && <label className="block text-sm font-semibold">Replacement primary position<select required name="replacementId" className={field}><option value="">Choose an already active position</option>{active.filter(x => x.assignmentId !== a.assignmentId && x.canManage).map(x => <option key={x.assignmentId} value={x.assignmentId}>{x.title} · {x.campusName || "School-wide"}</option>)}</select></label>}
     {a.remainingActiveCount === 0 && <label className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950"><input type="checkbox" required name="confirmLastPosition" className="mt-1 size-5 shrink-0" />I confirm this leaves no active operating position. Operating permissions will stop; the staff account and history remain.</label>}
    </>}
    <div className="flex flex-wrap gap-3"><button disabled={busy} className="min-h-12 rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Confirm change"}</button><button disabled={busy} type="button" onClick={() => setSelection(null)} className="min-h-12 rounded-xl border px-4 py-3">Cancel</button></div>
   </form>}
  </article>;
 }
 return <section className="space-y-3 border-t border-slate-200 pt-4"><h3 className="font-bold">Primary & additional position controls</h3><p className="text-sm text-slate-600">Manage each assignment separately. Staff profiles, school accounts and historical records are retained. Changing the primary role uses an already active appointment; new responsibilities follow normal onboarding.</p>
  {feedback && !selection && <p role={feedback.error ? "alert" : "status"} className={`rounded-xl p-3 text-sm font-semibold ${feedback.error ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-900"}`}>{feedback.message}</p>}
  {assignments.filter(a=>a.status!=="ended").map(row)}
  {assignments.some(a=>a.status==="ended") && <details className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">Ended assignments</summary><div className="mt-3 space-y-3">{assignments.filter(a=>a.status==="ended").map(row)}</div></details>}
  {assignments.length===0 && <p className="text-sm text-slate-600">No operating assignments recorded.</p>}
 </section>;
}
