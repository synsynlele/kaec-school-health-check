"use client";
import { useEffect, useRef, useState } from "react";
import { captureAttendanceLocation, type LocationCapture } from "@/lib/khpos/attendance-location";

export function useAttendanceLocation() {
  const [pending, setPending] = useState<LocationCapture | null>(null);
  const [reason, setReason] = useState("");
  const resolveRef = useRef<((value: LocationCapture | null) => void) | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => () => resolveRef.current?.(null), []);
  useEffect(() => {
    const element = dialogRef.current;
    if (pending && element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  }, [pending]);
  async function capture(note = "") {
    const value = await captureAttendanceLocation();
    if (value.status === "captured") return { ...value, reason: note };
    return new Promise<LocationCapture | null>(resolve => {
      resolveRef.current = resolve; setReason(note); setPending(value);
    });
  }
  function finish(value: LocationCapture | null) {
    resolveRef.current?.(value); resolveRef.current = null; setPending(null);
  }
  const dialog = pending ? <dialog ref={dialogRef} aria-labelledby="location-exception-title" onCancel={e => { e.preventDefault(); finish(null); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-0 backdrop:bg-slate-950/70">
    <form className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 text-slate-950" onSubmit={e => { e.preventDefault(); finish({ ...pending, reason: reason.trim() }); }}>
      <h2 id="location-exception-title" className="text-lg font-black">Location could not be captured</h2>
      <p className="text-sm leading-6">You can still record attendance. Explain why location is unavailable for your supervisor. Your phone may need location enabled or site permission.</p>
      <label className="block text-sm font-bold">Explanation<textarea autoFocus required minLength={5} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-base" /></label>
      <div className="flex flex-wrap gap-3"><button disabled={reason.trim().length < 5} className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Record with explanation</button><button type="button" className="rounded-lg border px-4 py-3 text-sm font-bold" onClick={() => finish(null)}>Cancel attendance action</button></div>
    </form>
  </dialog> : null;
  return { capture, dialog };
}
