"use client";

import { useEffect, useRef, useState } from "react";
import { captureAttendanceLocation, type LocationCapture } from "@/lib/khpos/attendance-location";

function failureMessage(status: LocationCapture["status"]) {
  switch (status) {
    case "denied":
      return "Location access is blocked. Allow it in your phone or Chrome website settings, then retry here.";
    case "timeout":
      return "Your phone took too long to find its position. Turn on Location, try outdoors or near a window, then retry.";
    case "unsupported":
      return "Location is not supported by the browser currently opening KHP-OS. Try the installed KHP-OS app or Chrome.";
    default:
      return "The phone could not provide its location. Check phone Location, precise location and your internet connection, then retry.";
  }
}

/**
 * A single location reading is requested only after the teacher taps an attendance
 * action, "Retry location", or "Test location access". Never background-tracks staff.
 * A failed GPS reading never modifies an existing attendance record.
 */
export function useAttendanceLocation() {
  const [pending, setPending] = useState<LocationCapture | null>(null);
  const [failure, setFailure] = useState<LocationCapture | null>(null);
  const [reason, setReason] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<LocationCapture | null>(null);
  const resolveRef = useRef<((value: LocationCapture | null) => void) | null>(null);
  const noteRef = useRef("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => () => {
    resolveRef.current?.(null);
    resolveRef.current = null;
  }, []);
  useEffect(() => {
    const element = dialogRef.current;
    if (pending && element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  }, [pending]);

  async function capture(note = "") {
    // Do not start two unresolved attendance actions.
    if (resolveRef.current) return null;
    const value = await captureAttendanceLocation();
    if (value.status === "captured") return { ...value, reason: note };
    return new Promise<LocationCapture | null>(resolve => {
      resolveRef.current = resolve;
      noteRef.current = note;
      setReason(note);
      setFailure(value);
      setCheckResult(null);
      setPending(value);
    });
  }

  function finish(value: LocationCapture | null) {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setPending(null);
    setFailure(null);
  }

  async function retry() {
    if (!pending || retrying) return;
    setRetrying(true);
    try {
      const value = await captureAttendanceLocation({ timeoutMs: 20000 });
      if (value.status === "captured") {
        // Continue the ORIGINAL attendance action exactly once, with real GPS evidence.
        finish({ ...value, reason: noteRef.current });
      } else {
        setFailure(value);
      }
    } finally {
      setRetrying(false);
    }
  }

  async function checkNow() {
    if (checking || pending) return;
    setChecking(true);
    setCheckResult(null);
    try {
      // Diagnostic only: never sends, saves or backfills attendance.
      setCheckResult(await captureAttendanceLocation({ timeoutMs: 20000 }));
    } finally {
      setChecking(false);
    }
  }

  const instructions = <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
    <li>Turn on <strong>Location</strong> in your phone&apos;s quick settings.</li>
    <li>Long-press the <strong>KHP-OS</strong> icon, open <strong>App info → Permissions → Location</strong> and choose <strong>Allow while using the app</strong> if Location is listed. Enable precise location if available.</li>
    <li>If Location is not listed in the app permissions, open <strong>Chrome</strong>, visit <strong>www.kshc.name.ng</strong>, open the site&apos;s <strong>Permissions</strong> and set <strong>Location → Allow</strong>. You may need Chrome <strong>Settings → Site settings → Location</strong> to unblock this exact website.</li>
    <li>Return to KHP-OS and tap <strong>Retry location</strong> or <strong>Test location access</strong>. You do not need to log out or reinstall.</li>
  </ol>;

  const dialog = pending ? <dialog ref={dialogRef} aria-labelledby="location-exception-title"
    onCancel={event => { event.preventDefault(); if (!retrying) finish(null); }}
    className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-0 backdrop:bg-slate-950/70">
    <div className="w-full space-y-4 rounded-2xl bg-white p-6 text-slate-950">
      <h2 id="location-exception-title" className="text-lg font-black">Enable location for KHP-OS</h2>
      <p className="text-sm leading-6">Your attendance has not been saved yet. Allow location, then retry without starting over.</p>
      <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-950">
        {failureMessage((failure ?? pending).status)}
      </p>
      <button type="button" disabled={retrying} onClick={() => void retry()}
        className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
        {retrying ? "Checking your location…" : "Retry location"}
      </button>
      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-bold">How to enable location on my phone</summary>
        <div className="mt-3">{instructions}</div>
      </details>
      <form className="space-y-3 border-t border-slate-200 pt-4" onSubmit={event => {
        event.preventDefault();
        if (reason.trim().length >= 5 && !retrying) finish({ ...(failure ?? pending), reason: reason.trim() });
      }}>
        <p className="text-sm font-bold">Still cannot get location?</p>
        <p className="text-xs leading-5 text-slate-600">You may record attendance with an explanation for your supervisor to review. This is not GPS verification.</p>
        <label className="block text-sm font-bold">Explanation
          <textarea required minLength={5} maxLength={500} value={reason} onChange={event => setReason(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-base" />
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={reason.trim().length < 5 || retrying}
            className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
            Record with explanation
          </button>
          <button type="button" disabled={retrying} onClick={() => finish(null)}
            className="rounded-lg border px-4 py-3 text-sm font-bold disabled:opacity-40">
            Cancel attendance action
          </button>
        </div>
      </form>
    </div>
  </dialog> : null;

  const help = <details className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
    <summary className="cursor-pointer font-bold text-brand-800">Location not working? Enable or check access</summary>
    <p className="mt-3 leading-6">You can test location at any time, even if you already signed in without it. This test does not create, duplicate or change attendance records.</p>
    <div className="mt-3">{instructions}</div>
    <button type="button" disabled={checking || pending !== null} onClick={() => void checkNow()}
      className="mt-4 rounded-xl bg-brand-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
      {checking ? "Checking location…" : "Test location access"}
    </button>
    {checkResult && <p role="status" className={"mt-3 rounded-xl p-3 text-sm leading-6 " +
      (checkResult.status === "captured" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950")}>
      {checkResult.status === "captured"
        ? "Location is working" + (checkResult.accuracy != null ? " (accuracy ±" + Math.round(checkResult.accuracy) + " m)." : ".") +
          " It will be checked again on your next school attendance action. Earlier attendance remains unchanged."
        : failureMessage(checkResult.status)}
    </p>}
  </details>;

  return { capture, dialog, help };
}
