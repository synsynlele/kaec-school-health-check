"use client";
import { useEffect, useState } from "react";
import type { Meeting } from "@/lib/khpos/ops/meetings";
import { callProgress } from "@/lib/khpos/ops/call-plan";

export function MeetingCallPanel({ meeting, host, busy, serverOffsetMs, onStart }: {
 meeting: Meeting; host: boolean; busy: boolean; serverOffsetMs: number; onStart: (part: number) => void;
}) {
 const [now, setNow] = useState(() => Date.now());
 const running=meeting.active_call_part>0&&!["closed","cancelled"].includes(meeting.status);
 useEffect(() => {
  if(!running)return;
  const tick = () => { if (document.visibilityState === "visible") setNow(Date.now()); };
  const timer = setInterval(tick, 1000);
  document.addEventListener("visibilitychange", tick);
  return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
 }, [running]);
 const parts = meeting.call_parts ?? (meeting.call_url ? [meeting.call_url] : []);
 if (!parts.length || ["closed", "cancelled"].includes(meeting.status)) return null;
 const active = meeting.active_call_part ?? 0;
 const progress = callProgress(meeting.call_part_started_at, active, parts.length, now + serverOffsetMs);
 const next = progress.nextPart;
 const minutes = Math.floor(progress.remainingSeconds / 60);
 const seconds = String(progress.remainingSeconds % 60).padStart(2, "0");
 return <section className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4" aria-label="Voice and video call parts">
  <h3 className="text-lg font-bold">Voice / video · {parts.length} {parts.length === 1 ? "part" : "parts"}</h3>
  <p className="text-sm">One KHP-OS room keeps the agenda, discussion and follow-ups together throughout.</p>
  <ol className="flex flex-wrap gap-2" aria-label="Call order">{parts.map((_, index) => <li key={index} aria-current={index + 1 === active ? "step" : undefined} className={`rounded-full px-3 py-1 text-sm ${index + 1 === active ? "bg-blue-800 text-white" : "bg-white text-slate-700"}`}>Part {index + 1} · {index + 1 < active ? "Previous" : index + 1 === active ? "Current" : "Waiting"}</li>)}</ol>
  {active > 0 ? <>
   <p>Part {active} · <span role="timer" aria-live="off">{minutes}:{seconds}</span> left on the KHP-OS timer</p>
   <a href={parts[active - 1]} target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white">Join part {active} in Google Meet ↗</a>
   {progress.warn && <p role="status" className="rounded-xl border border-amber-400 bg-amber-50 p-3 text-amber-950">{progress.remainingSeconds ? "This call part has five minutes or less remaining." : "This call part has reached one hour on the KHP-OS timer."} {progress.hasNext ? `Return here for part ${next}. The host will make its joining button available.` : "Save the decisions and agree any remaining follow-ups."}</p>}
  </> : <p>Waiting for the host to start part 1.</p>}
  {host && progress.hasNext && <button disabled={busy} onClick={() => onStart(next)} className="rounded-xl border border-blue-700 bg-white px-4 py-3 font-semibold text-blue-800 disabled:opacity-50">{active === 0 ? "Start part 1 timer" : `Start part ${next} timer`}</button>}
  <p className="text-sm text-slate-700">{host ? "Start each timer when you are ready to join its call. Tell participants to leave the previous call and tap the current joining button here." : "When the host changes parts, leave the previous call, return here and tap the new joining button."}</p>
  <p className="text-xs text-slate-600">This timer is an estimate. KHP-OS cannot read Google’s call timer, end its calls or transfer people automatically. Keep this room available in a browser tab; on a phone, return from Meet to KHP-OS.</p>
 </section>;
}
