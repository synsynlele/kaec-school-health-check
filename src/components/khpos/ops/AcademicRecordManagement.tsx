"use client";

import { useState } from "react";
import type { AcademicRecordHistory } from "@/lib/khpos/ops/academic-delivery";

type LifecycleAction = "archive" | "restore" | "remove";

export function AcademicRecordManagement({
  kind, status, revisionNumber, archivedAt, archiveReason, removedAt,
  history = [], busy, onManage,
}: {
  kind: "term" | "stream";
  status: string;
  revisionNumber?: number;
  archivedAt?: string | null;
  archiveReason?: string | null;
  removedAt?: string | null;
  history?: AcademicRecordHistory[];
  busy: boolean;
  onManage: (action: LifecycleAction, reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState("");
  const [removeConfirm, setRemoveConfirm] = useState("");
  const [feedback, setFeedback] = useState("");
  const archived = status === "archived" || status === "removed";
  const mayRemove = ["draft", "approved", "cancelled"].includes(status);
  const enabled = !busy && reason.trim().length >= 10;

  async function run(action: LifecycleAction) {
    setFeedback("");
    const ok = await onManage(action, reason.trim());
    if (ok) {
      setReason("");
      setRemoveConfirm("");
      setFeedback(action === "restore" ? "Record restored." : action === "archive"
        ? "Record archived with its history retained." : "Unused record removed from normal use. It remains recoverable.");
    }
  }

  return (
    <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer text-xs font-black text-brand-800">
        Manage {kind === "term" ? "academic term" : "curriculum execution"} · revision {revisionNumber ?? 1}
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs leading-5 text-slate-600">
          Edits preserve the change history. Archiving or removing a record hides it from routine planning,
          without erasing school evidence. Removal is reversible, not permanent deletion.
        </p>
        {archived && (
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
            {removedAt ? "Removed" : "Archived"} {archivedAt ? new Date(archivedAt).toLocaleString() : ""}
            {archiveReason ? " · " + archiveReason : ""}
          </p>
        )}
        <label className="block text-xs font-bold text-slate-800">
          Reason for this action (required, at least 10 characters)
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={2000}
            placeholder="Explain why you are changing this school record"
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-normal"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button" disabled={!enabled}
            onClick={() => void run(archived ? "restore" : "archive")}
            className="rounded-full border border-brand-300 bg-white px-3 py-2 text-xs font-bold text-brand-800 disabled:opacity-40"
          >{archived ? "Restore record" : "Archive record"}</button>
        </div>
        {mayRemove && (
          <div className="space-y-2 rounded-xl border border-rose-200 bg-white p-3">
            <p className="text-xs font-bold text-rose-800">Remove an unused record</p>
            <p className="text-xs text-slate-600">
              Only unused drafts or cancelled records without linked teaching or assessment work can be removed.
              This hides the item from ordinary lists; it does NOT erase the record or its audit history.
              You can restore it by selecting Show archived and removed records.
            </p>
            <label className="block text-xs font-bold text-slate-700">
              Type REMOVE to confirm
              <input value={removeConfirm} onChange={(event) => setRemoveConfirm(event.target.value)}
                placeholder="REMOVE" autoComplete="off"
                className="mt-1 w-full rounded-lg border border-rose-200 p-2 text-xs font-normal" />
            </label>
            <button type="button" disabled={!enabled || removeConfirm !== "REMOVE"}
              onClick={() => void run("remove")}
              className="rounded-full border border-rose-500 px-3 py-2 text-xs font-bold text-rose-800 disabled:opacity-40">
              Remove unused record
            </button>
          </div>
        )}
        {feedback && <p role="status" className="text-xs font-semibold text-emerald-800">{feedback}</p>}
        <details className="rounded-lg border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-xs font-bold text-slate-700">
            Change history ({history.length})
          </summary>
          {history.length ? (
            <ul className="mt-2 space-y-2">
              {history.slice(0, 10).map((entry) => (
                <li key={entry.id} className="text-xs leading-5 text-slate-600">
                  <strong className="capitalize">{entry.action}</strong> · {new Date(entry.createdAt).toLocaleString()} · {entry.reason}
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-xs text-slate-500">No amendments have been recorded in the new lifecycle register.</p>}
        </details>
      </div>
    </details>
  );
}
