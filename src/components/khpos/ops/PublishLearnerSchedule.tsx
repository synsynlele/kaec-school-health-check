"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ActionFeedback } from "./ActionFeedback";

export function PublishLearnerSchedule({ school, kind, id }: { school: string; kind: "lesson" | "assessment"; id: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function publish() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const session = (await createBrowserSupabaseClient()?.auth.getSession())?.data.session;
      if (!session) throw new Error("Sign in to publish this entry.");
      const response = await fetch(`/api/khpos/ops/learner-timetable/${school}`, {
        method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ kind, sourceId: id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setNotice("Published to the learner timetable.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  }
  return <div>
    <button type="button" disabled={busy} onClick={() => void publish()} className="min-h-10 text-sm font-bold text-brand-700 underline disabled:opacity-50">
      Publish to learners
    </button>
    <ActionFeedback busy={busy} error={error} notice={notice} onDismiss={() => { setError(""); setNotice(""); }} />
  </div>;
}
