"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ActionFeedback } from "./ActionFeedback";

type Entry = { id: string; campusId: string | null; label: string; section: string };
type Campus = { id: string; name: string };

export function useClassSubjectCatalog(school: string) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const request = useCallback(async (input?: Omit<Entry, "id">, signal?: AbortSignal) => {
    const token = (await createBrowserSupabaseClient()?.auth.getSession())?.data.session?.access_token;
    if (!token) throw new Error("Sign in to view classes and subjects.");
    const response = await fetch(`/api/khpos/ops/class-subjects/${school}`, {
      method: input ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: input ? JSON.stringify(input) : undefined,
      signal,
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Could not load classes and subjects.");
    return body.entries as Entry[];
  }, [school]);
  useEffect(() => {
    const controller = new AbortController();
    void request(undefined, controller.signal).then(result => {
      if (!controller.signal.aborted) { setEntries(result); setError(""); }
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [request]);
  return { entries, error, save: async (input: Omit<Entry, "id">) => setEntries(await request(input)) };
}

const field = "block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm";

export function CatalogClassPicker({ entries, campusId, onPick }: {
  entries: Entry[]; campusId: string; onPick: (label: string, section: string) => void;
}) {
  const classes = entries.filter(entry => entry.campusId === campusId);
  if (!classes.length) return null;
  return <label className="grid gap-1 text-sm font-semibold">
    Choose a saved class
    <select className={field} value="" onChange={event => {
      const entry = classes.find(item => item.id === event.target.value);
      if (entry) onPick(entry.label, entry.section);
    }}>
      <option value="">Select to fill class and section</option>
      {classes.map(entry => <option key={entry.id} value={entry.id}>{entry.label}{entry.section && ` · ${entry.section}`}</option>)}
    </select>
  </label>;
}

export function ClassSubjectSetup({ catalog, campuses }: {
  catalog: ReturnType<typeof useClassSubjectCatalog>; campuses: Campus[];
}) {
  const [kind, setKind] = useState("class");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await catalog.save({
        campusId: kind === "class" ? String(fields.get("campusId")) : null,
        label: String(fields.get("label")),
        section: kind === "class" ? String(fields.get("section")) : "",
      });
      form.reset();
      setNotice("Saved to Classes & subjects.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save the list entry.");
    } finally {
      setBusy(false);
    }
  }

  return <details className="rounded-2xl border border-slate-200 bg-white p-4">
    <summary className="font-bold">Classes &amp; subjects</summary>
    <p className="my-2 text-sm text-slate-600">Save classes by campus and subjects for the whole school. Use the same names when setting up teaching assignments.</p>
    {catalog.error && <p role="alert" className="text-sm text-rose-900">{catalog.error}</p>}
    <ActionFeedback busy={busy} error={error} notice={notice} onDismiss={() => { setError(""); setNotice(""); }} />
    <form onSubmit={save}>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        <label>List<select className={field} value={kind} onChange={event => setKind(event.target.value)}>
          <option value="class">Class</option><option value="subject">Subject</option>
        </select></label>
        {kind === "class" && <label>Campus<select name="campusId" className={field} required>
          <option value="">Choose campus</option>
          {campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
        </select></label>}
        <label>{kind === "class" ? "Class name" : "Subject name"}<input name="label" className={field} required maxLength={120} /></label>
        {kind === "class" && <label>Section (optional)<input name="section" className={field} maxLength={120} /></label>}
        <button className="rounded-xl bg-brand-700 px-4 py-2 font-bold text-white" type="submit">Add to list</button>
      </fieldset>
    </form>
    <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-sm">
      {catalog.entries.filter(entry => kind === "class" ? entry.campusId !== null : entry.campusId === null).map(entry =>
        <li key={entry.id}>{entry.label}{entry.section && ` · ${entry.section}`}{entry.campusId && ` · ${campuses.find(c => c.id === entry.campusId)?.name ?? "Campus"}`}</li>)}
    </ul>
  </details>;
}
