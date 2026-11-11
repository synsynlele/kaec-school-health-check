"use client";

import { actionDestination } from "@/components/khpos/actionDestination";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ActionFeedback } from "./ActionFeedback";

type Entry = { id: string; campusId: string | null; label: string; section: string; available: boolean };
type Mutation = Omit<Entry, "id" | "available">
  | { action: "edit"; id: string; label: string; section: string }
  | { action: "availability"; id: string; available: boolean }
  | { action: "delete"; id: string };
type Campus = { id: string; name: string };

export function useClassSubjectCatalog(school: string) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const request = useCallback(async (input?: Mutation, signal?: AbortSignal) => {
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
  return { entries, error, save: async (input: Mutation) => setEntries(await request(input)) };
}

const field = "block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm";

export function CatalogClassPicker({ entries, campusId, onPick }: {
  entries: Entry[]; campusId: string; onPick: (label: string, section: string) => void;
}) {
  const classes = entries.filter(entry => entry.available !== false && entry.campusId === campusId);
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
  const [editing, setEditing] = useState<Entry | null>(null);
  const [kind, setKind] = useState("class");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const label = String(fields.get("label"));
    const section = kind === "class" ? String(fields.get("section")) : "";
    const saved = await mutate(editing
      ? { action: "edit", id: editing.id, label, section }
      : { campusId: kind === "class" ? String(fields.get("campusId")) : null, label, section },
      editing ? "Changes saved." : "Saved to Classes & subjects.");
    if (saved) { form.reset(); setEditing(null); }
  }

  async function mutate(input: Mutation, message: string) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await catalog.save(input);
      setNotice(message);
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update the list entry.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return <details className="rounded-2xl border border-slate-200 bg-white p-4">
    <summary className="font-bold">Classes &amp; subjects</summary>
    <p className="my-2 text-sm text-slate-600">Save classes by campus and subjects for the whole school. Use the same names when setting up teaching assignments.</p>
    {catalog.error && <p role="alert" className="text-sm text-rose-900">{catalog.error}</p>}
    <ActionFeedback busy={busy} error={error} notice={notice} onDismiss={() => { setError(""); setNotice(""); }} />
    <form {...(editing ? actionDestination : {})} key={editing?.id ?? kind} onSubmit={save}>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        <label>List<select className={field} value={kind} disabled={Boolean(editing)} onChange={event => setKind(event.target.value)}>
          <option value="class">Class</option><option value="subject">Subject</option>
        </select></label>
        {kind === "class" && !editing && <label>Campus<select name="campusId" className={field} required>
          <option value="">Choose campus</option>
          {campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
        </select></label>}
        <label>{kind === "class" ? "Class name" : "Subject name"}<input name="label" defaultValue={editing?.label} className={field} required maxLength={120} /></label>
        {kind === "class" && <label>Section (optional)<input name="section" defaultValue={editing?.section} className={field} maxLength={120} /></label>}
        <button className="rounded-xl bg-brand-700 px-4 py-2 font-bold text-white" type="submit">{editing ? "Save changes" : "Add to list"}</button>
        {editing && <button type="button" onClick={() => setEditing(null)}>Cancel edit</button>}
      </fieldset>
    </form>
    <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-sm">
      {catalog.entries.filter(entry => kind === "class" ? entry.campusId !== null : entry.campusId === null).map(entry =>
        <li key={entry.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-2">
          <span className="mr-auto">{entry.label}{entry.section && ` · ${entry.section}`}{entry.campusId && ` · ${campuses.find(c => c.id === entry.campusId)?.name ?? "Campus"}`}
            {entry.available === false && " · Unavailable"}
          </span>
          <button type="button" disabled={busy} onClick={() => setEditing(entry)}>Edit</button>
          <button type="button" disabled={busy || Boolean(editing)} onClick={() => {
            const available = entry.available === false;
            void mutate({ action: "availability", id: entry.id, available }, available ? "Available for selection." : "Hidden from selection.");
          }}>{entry.available === false ? "Make available" : "Make unavailable"}</button>
          <button type="button" disabled={busy || Boolean(editing)} className="text-rose-800" onClick={() => {
            if (window.confirm(`Delete ${entry.label} from the list? Existing records keep their saved names.`)) {
              void mutate({ action: "delete", id: entry.id }, "Removed from the list.");
            }
          }}>Delete</button>
        </li>)}
    </ul>
  </details>;
}
