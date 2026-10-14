"use client";

import { useState } from "react";
import type { AcademicRecordHistory } from "@/lib/khpos/ops/academic-delivery";

type LifecycleAction = "archive" | "restore" | "delete";

export function AcademicRecordManagement({
  kind, status, revisionNumber, archivedAt, archiveReason,
  history = [], busy, onManage,
}: {
  kind: "term" | "stream";
  status: string;
  revisionNumber?: number;
  archivedAt?: string | null;
  archiveReason?: string | null;
  history?: AcademicRecordHistory[];
  busy: boolean;
  onManage: (action: LifecycleAction, reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [feedback, setFeedback] = useState("");
  const archived = status === "archived";
  const mayRequestDelete = !["active", "closed"].includes(status);
  const enabled = !busy && reason.trim().length >= 10;

  async function run(action: LifecycleAction) {
    setFeedback("");
    const ok = await onManage(action, reason.trim());
    if (ok) {
      setReason("");
      setDeleteConfirm("");
      setFeedback(action === "restore" ? "Record restored." : action === "archive" ? "Record archived." : "Record deleted.");
    }
  }

  return (
    <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer text-xs font-black text-brand-800">
        Manage {kind === "term" ? "academic term" : "curriculum execution"} · revision {revisionNumber ?? 1}
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs leading-5 text-slate-600">
          Edits retain their history. Archiving hides an item from routine planning without deleting school evidence.
          Permanent deletion is restricted to records with no linked school work.
        </p>
        {archived && (
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
            Archived {archivedAt ? new Date(archivedAt).toLocaleString() : ""}
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
        {mayRequestDelete && (
          <div className="space-y-2 rounded-xl border border-rose-200 bg-white p-3">
            <p className="text-xs font-bold text-rose-800">Permanent deletion cannot be undone.</p>
            <p className="text-xs text-slate-600">
              Deletion will be refused if any teaching targets, assessment, learner progress or other linked school records exist.
              A separate audit entry is retained.
            </p>
            <label className="block text-xs font-bold text-slate-700">
              Type DELETE to confirm
              <input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)}
                placeholder="DELETE" autoComplete="off"
                className="mt-1 w-full rounded-lg border border-rose-200 p-2 text-xs font-normal" />
            </label>
            <button type="button" disabled={!enabled || deleteConfirm !== "DELETE"}
              onClick={() => void run("delete")}
              className="rounded-full border border-rose-500 px-3 py-2 text-xs font-bold text-rose-800 disabled:opacity-40">
              Delete permanently
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
