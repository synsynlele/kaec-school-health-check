"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ActionFeedback } from "./ActionFeedback";

type Selection = { kind: "lesson"; campus: string | null } | { kind: "assessment"; from: string; to: string };

export function PublishLearnerSchedule({ school, selection, disabled }: { school: string; selection: Selection; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const weekly = selection.kind === "lesson";
  async function publish() {
    if (busy || disabled) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const session = (await createBrowserSupabaseClient()?.auth.getSession())?.data.session;
      if (!session) throw new Error("Sign in to publish the timetable.");
      const response = await fetch(`/api/khpos/ops/learner-timetable/${school}`, {
        method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setNotice(`Published ${body.count} ${weekly ? "weekly lesson entries" : "test and exam entries"} to learners.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="my-3 space-y-2">
    <p className="text-sm text-slate-600">{selection.kind === "lesson"
      ? "Publishes all eligible lessons for the current term in the selected campus scope, across all days."
      : `Publishes all tests and exams you manage from ${selection.from} to ${selection.to}, across all types.`}</p>
    <button type="button" disabled={busy || disabled} onClick={() => void publish()} className="min-h-11 rounded-lg bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
      {weekly ? "Publish weekly timetable to learners" : "Publish tests and exams timetable to learners"}
    </button>
    <ActionFeedback busy={busy} error={error} notice={notice} onDismiss={() => { setError(""); setNotice(""); }} />
  </div>;
}
